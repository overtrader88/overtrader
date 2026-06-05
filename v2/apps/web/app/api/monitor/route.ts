/**
 * GET /api/monitor — estado ao vivo do monitor (Fase D1). Devolve:
 *  - markets: leitura SIMPLES (barata) dos mercados monitorados (preço/regime/sinal);
 *  - signals: sinais de QUALIDADE ainda abertos (tabela `signals`) + narrativa IA já
 *    gerada na emissão — é o que "surge" quando forma um setup de qualidade.
 * Sem auth (vitrine ao vivo, como o track record).
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import { analyzeSymbol } from "@/lib/analysis/service";
import { TRACKED_MARKETS, type TrackedMarket } from "@/lib/signals/tracked";
import { findAsset } from "@/lib/market/catalog";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TFS = ["15m", "1h", "4h", "1d", "1w", "1M"];

function resolveType(symbol: string): AssetType | null {
  const a = findAsset(symbol);
  if (a) return a.assetType;
  return symbol.toUpperCase().endsWith("USDT") ? "crypto" : null;
}

/** Parse `?watch=SYM:TF,SYM:TF` (a watchlist do usuário) → mercados extras (cap 10). */
function parseWatch(raw: string | null): TrackedMarket[] {
  if (!raw) return [];
  const out: TrackedMarket[] = [];
  for (const tok of raw.split(",").slice(0, 10)) {
    const [sym, tf] = tok.split(":");
    const symbol = (sym ?? "").trim().toUpperCase();
    if (!symbol || !TFS.includes(tf ?? "")) continue;
    const assetType = resolveType(symbol);
    if (assetType) out.push({ symbol, assetType, timeframe: tf as Timeframe });
  }
  return out;
}

export async function GET(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "monitor", 30);
  if (limited) return limited;
  const watch = parseWatch(new URL(req.url).searchParams.get("watch"));
  const watchKeys = new Set(watch.map((w) => `${w.symbol}:${w.timeframe}`));
  // curados (sem os que já estão na watchlist) + watchlist (marcados com ★)
  const list = [
    ...watch.map((m) => ({ ...m, watched: true })),
    ...TRACKED_MARKETS.filter((m) => !watchKeys.has(`${m.symbol}:${m.timeframe}`)).map((m) => ({ ...m, watched: false })),
  ];

  const markets = (
    await Promise.all(
      list.map(async (m) => {
        try {
          const dto = await analyzeSymbol(m.symbol, m.assetType, m.timeframe, "simple");
          const sig = dto.analysis.signal;
          return {
            symbol: m.symbol,
            timeframe: m.timeframe,
            signal: sig.signal,
            strength: sig.strength,
            side: signalSide(sig.signal),
            regime: dto.analysis.meta?.regime ?? null,
            price: dto.analysis.risk?.entry ?? null,
            watched: m.watched,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean);

  let signals: unknown[] = [];
  const sb = supabaseService();
  if (sb) {
    const core = "symbol,timeframe,direction,side,seal,entry,stop_loss,tp1,tp2,tp3,regime,emitted_at,tp1_hit,tp2_hit,tp3_hit,stop_stage";
    const q = (cols: string) => sb.from("signals").select(cols).is("outcome", null).order("emitted_at", { ascending: false }).limit(12);
    // tenta com narrative (migration 0005); se a coluna ainda não existe, faz fallback.
    const withNarr = await q(`${core},narrative`);
    const rows = withNarr.error ? (await q(core)).data : withNarr.data;
    signals = (rows as unknown[]) ?? [];
  }

  return NextResponse.json({ markets, signals, ts: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
