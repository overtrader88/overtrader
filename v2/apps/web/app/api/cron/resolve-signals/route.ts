/**
 * Cron: resolve o desfecho REAL dos sinais abertos. Para cada sinal aberto, busca
 * os candles POSTERIORES à emissão e roda `resolveOutcome` (motor, puro). Grava o
 * outcome quando resolve; senão só marca `checked_at`. Protegido por CRON_SECRET.
 *
 *   GET/POST /api/cron/resolve-signals?secret=...&limit=50
 */
import { NextResponse } from "next/server";
import { resolveLifecycle, type SignalPlan } from "@tradeai/engine";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { sendScoreboardToAdmin, type ClosedOp } from "@/lib/signals/scoreboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Janela máxima (candles após a emissão) antes de marcar EXPIRED. */
const MAX_DURATION = 60;
const FETCH_LIMIT = 400;

interface SignalRow {
  id: string; symbol: string; asset_type: string; timeframe: string; side: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number; emitted_at: string;
  engine?: string | null;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? "50") || 50));
  const { data, error } = await sb
    .from("signals")
    .select("id, symbol, asset_type, timeframe, side, entry, stop_loss, tp1, tp2, tp3, emitted_at, engine")
    .is("outcome", null)
    .order("emitted_at", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  const now = new Date().toISOString();
  let resolved = 0;
  let open = 0;
  let skipped = 0;
  const closedDecisive: ClosedOp[] = []; // fechadas por lucro/prejuízo nesta rodada

  for (const s of (data ?? []) as SignalRow[]) {
    try {
      const candles = await getCandles(s.symbol, s.asset_type as AssetType, s.timeframe as Timeframe, FETCH_LIMIT, {
        providers, cache, cacheTtlSeconds: 300, minCandles: 30,
      });
      const emittedMs = Date.parse(s.emitted_at);
      const future = candles.filter((c) => c.time > emittedMs);
      const plan: SignalPlan = {
        side: s.side === "sell" ? "sell" : "buy",
        entry: s.entry, stopLoss: s.stop_loss, takeProfit1: s.tp1, takeProfit2: s.tp2, takeProfit3: s.tp3,
      };
      const res = resolveLifecycle(plan, future, MAX_DURATION);
      // Progresso do ciclo de vida (gravado mesmo em abertos, p/ a vitrine ao vivo).
      const lifecycle = {
        tp1_hit: res.tp1Hit, tp2_hit: res.tp2Hit, tp3_hit: res.tp3Hit,
        stop_stage: res.stopStage, current_stop: res.currentStop, checked_at: now,
      };
      if (res.status === "resolved") {
        await sb.from("signals").update({
          ...lifecycle,
          outcome: res.outcome, exit_price: res.exitPrice, pnl_r: res.pnlR,
          duration_candles: res.durationCandles, resolved_at: now,
        }).eq("id", s.id);
        resolved++;
        // Fechou por lucro/prejuízo (TP/SL, não expiração) → entra no placar do admin.
        if (res.outcome === "TP1" || res.outcome === "TP2" || res.outcome === "TP3" || res.outcome === "SL") {
          closedDecisive.push({
            engine: s.engine ?? "padrao", symbol: s.symbol, timeframe: s.timeframe,
            side: s.side, outcome: res.outcome, pnlR: res.pnlR ?? 0,
          });
        }
      } else {
        await sb.from("signals").update(lifecycle).eq("id", s.id);
        open++;
      }
    } catch {
      skipped++;
    }
  }
  // Placar dos motores no Telegram do admin — só quando algo fechou por lucro/prejuízo.
  let scoreboard: string = "skip";
  if (closedDecisive.length > 0) {
    scoreboard = await sendScoreboardToAdmin(closedDecisive[closedDecisive.length - 1]!);
  }

  return NextResponse.json({ total: data?.length ?? 0, resolved, open, skipped, closedDecisive: closedDecisive.length, scoreboard });
}

export const GET = handle;
export const POST = handle;
