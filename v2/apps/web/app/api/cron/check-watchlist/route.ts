/**
 * Cron: varre a watchlist (todos os usuários, service-role), reanalisa cada item
 * (modo simple) e dispara alerta quando o sinal de COMPRA atinge o limiar
 * configurado — via RPC atômico `process_watchlist_alert` (que deduplica e marca
 * last_checked_at). Protegido por CRON_SECRET.
 *
 *   GET/POST /api/cron/check-watchlist?secret=...&limit=25
 *   (ou header Authorization: Bearer <CRON_SECRET>)
 */
import { NextResponse } from "next/server";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import { analyzeSymbol } from "@/lib/analysis/service";
import { findAsset } from "@/lib/market/catalog";
import { dispatchUserAlert } from "@/lib/notify/dispatch";
import { computeClassReading, classReadingToSignal } from "@/lib/analysis/engines";
import { loadServerExtras } from "@/lib/analysis/class-extras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUY_RANK: Record<string, number> = { WEAK_BUY: 1, BUY: 2, STRONG_BUY: 3 };
const SELL_RANK: Record<string, number> = { WEAK_SELL: 1, SELL: 2, STRONG_SELL: 3 };

/** O sinal atual atende o gatilho escolhido (mesmo lado + força ≥ mínima)? */
function meetsTrigger(sig: SignalDirection, want: string): boolean {
  const side = signalSide(sig);
  const wantSide = signalSide(want as SignalDirection);
  if (wantSide === "buy") return side === "buy" && (BUY_RANK[sig] ?? 0) >= (BUY_RANK[want] ?? 99);
  if (wantSide === "sell") return side === "sell" && (SELL_RANK[sig] ?? 0) >= (SELL_RANK[want] ?? 99);
  return false;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

function resolveType(symbol: string): AssetType | null {
  const a = findAsset(symbol);
  if (a) return a.assetType;
  return symbol.toUpperCase().endsWith("USDT") ? "crypto" : null;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const limit = Math.min(50, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? "25") || 25));
  const { data: items, error } = await sb
    .from("watchlist")
    .select("*") // select("*") tolera a coluna `engine` ausente antes da migration
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let checked = 0;
  let alerted = 0;
  let skipped = 0;
  for (const it of (items ?? []) as { id: string; user_id: string; symbol: string; timeframe: string; min_signal_strength: string; engine?: string }[]) {
    const assetType = resolveType(it.symbol);
    if (!assetType) {
      skipped++;
      continue;
    }
    try {
      // Motor 2 ("classe") precisa da análise COMPLETA + extras (custo extra só p/
      // quem optou); Motor 1 ("padrao") segue no modo simple, barato.
      const isClasse = it.engine === "classe";
      const dto = await analyzeSymbol(it.symbol, assetType, it.timeframe as Timeframe, isClasse ? "complete" : "simple");
      checked++;
      let sig: SignalDirection;
      if (isClasse) {
        const extras = await loadServerExtras(it.symbol, assetType);
        sig = classReadingToSignal(computeClassReading(dto, assetType, extras));
      } else {
        sig = dto.analysis.signal.signal;
      }
      const meets = meetsTrigger(sig, it.min_signal_strength);
      if (meets) {
        const message = `${it.symbol} ${it.timeframe.toUpperCase()}: ${sig} (força ${dto.analysis.signal.strength})`;
        const { data: fired } = await sb.rpc("process_watchlist_alert", { p_item_id: it.id, p_signal: sig, p_message: message });
        if (fired === true) {
          alerted++;
          // Entrega nos canais do usuário (Telegram/e-mail) — best-effort (C2).
          await dispatchUserAlert(sb, it.user_id, { symbol: it.symbol, timeframe: it.timeframe, signal: sig, strength: dto.analysis.signal.strength });
        }
      } else {
        await sb.from("watchlist").update({ last_checked_at: new Date().toISOString() }).eq("id", it.id);
      }
    } catch {
      skipped++;
    }
  }
  return NextResponse.json({ total: items?.length ?? 0, checked, alerted, skipped });
}

export const GET = handle;
export const POST = handle;
