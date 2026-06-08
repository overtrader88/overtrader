/**
 * Comparação de performance entre os MOTORES (padrão × por classe) para o painel
 * admin. Lê os sinais (ambos os motores), agrega o REALIZADO (win rate, PF, R, com
 * a mesma matemática do track record público) e calcula o NÃO-REALIZADO das
 * posições abertas — marcando a mercado o preço atual para saber se cada operação
 * fecharia hoje em lucro ou prejuízo. Tudo server-side, best-effort.
 */
import { aggregateTrackRecord, type SignalOutcome } from "@tradeai/engine";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import type { EngineComparison, EngineStat, OpenPosition } from "@/components/admin-shared";

interface Row {
  engine: string | null;
  symbol: string;
  asset_type: string;
  timeframe: string;
  side: string;
  direction: string;
  entry: number;
  stop_loss: number;
  outcome: SignalOutcome | null;
  pnl_r: number | null;
  emitted_at: string;
}

const ENGINE_LABELS: Record<string, string> = { padrao: "Motor padrão", classe: "Motor por classe" };
const DAY = 86_400_000;

/** Marca a mercado: R não-realizado de uma posição aberta dado o preço atual. */
function unrealizedR(side: string, entry: number, stop: number, price: number): number | null {
  const dist = Math.abs(entry - stop);
  if (!(dist > 0)) return null;
  return side === "sell" ? (entry - price) / dist : (price - entry) / dist;
}

export async function getEngineComparison(): Promise<EngineComparison | null> {
  const sb = supabaseService();
  if (!sb) return null;

  const { data, error } = await sb
    .from("signals")
    .select("engine, symbol, asset_type, timeframe, side, direction, entry, stop_loss, outcome, pnl_r, emitted_at")
    .order("emitted_at", { ascending: false })
    .limit(5000);
  if (error) return null;
  const rows = (data ?? []) as Row[];

  const byEngine = new Map<string, Row[]>();
  for (const r of rows) {
    const e = r.engine ?? "padrao";
    (byEngine.get(e) ?? byEngine.set(e, []).get(e)!).push(r);
  }

  // Preço atual das posições abertas (marca a mercado). Cap p/ não estourar a página.
  const openRows = rows.filter((r) => r.outcome == null).slice(0, 40);
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  const priceOf = new Map<string, number | null>();
  await Promise.all(
    [...new Map(openRows.map((r) => [`${r.symbol}|${r.asset_type}|${r.timeframe}`, r])).values()].map(async (r) => {
      const key = `${r.symbol}|${r.asset_type}|${r.timeframe}`;
      try {
        const candles = await getCandles(r.symbol, r.asset_type as AssetType, r.timeframe as Timeframe, 3, {
          providers, cache, cacheTtlSeconds: 300, minCandles: 1,
        });
        priceOf.set(key, candles.length ? candles[candles.length - 1]!.close : null);
      } catch {
        priceOf.set(key, null);
      }
    }),
  );

  const open: OpenPosition[] = openRows.map((r) => {
    const price = priceOf.get(`${r.symbol}|${r.asset_type}|${r.timeframe}`) ?? null;
    const ur = price != null ? unrealizedR(r.side, r.entry, r.stop_loss, price) : null;
    const status: OpenPosition["status"] = ur == null ? "unknown" : ur > 0.03 ? "profit" : ur < -0.03 ? "loss" : "flat";
    return {
      engine: r.engine ?? "padrao", symbol: r.symbol, timeframe: r.timeframe, side: r.side, direction: r.direction,
      entry: r.entry, emittedAt: r.emitted_at, currentPrice: price, unrealizedR: ur, status,
    };
  });

  const engines: EngineStat[] = ["padrao", "classe"].map((e) => {
    const list = byEngine.get(e) ?? [];
    const resolved = list.filter((r) => r.outcome != null && r.pnl_r != null);
    const stats = aggregateTrackRecord(resolved.map((r) => ({ outcome: r.outcome as SignalOutcome, pnlR: Number(r.pnl_r) })));
    const wins = stats.outcomes.TP1 + stats.outcomes.TP2 + stats.outcomes.TP3;
    const openList = open.filter((o) => o.engine === e);
    const emittedAts = list.map((r) => r.emitted_at).sort();
    const first = emittedAts[0] ?? null;
    const last = emittedAts[emittedAts.length - 1] ?? null;
    const spanDays = first && last ? Math.max(1, (new Date(last).getTime() - new Date(first).getTime()) / DAY) : 1;
    return {
      engine: e as "padrao" | "classe",
      label: ENGINE_LABELS[e] ?? e,
      resolved: stats.n,
      decisive: stats.decisive,
      wins,
      losses: stats.outcomes.SL,
      expired: stats.outcomes.EXPIRED,
      winRatePct: stats.winRate.value * 100,
      profitFactor: stats.profitFactor.value,
      avgR: stats.avgR.value,
      totalR: stats.totalR,
      open: list.filter((r) => r.outcome == null).length,
      emittedTotal: list.length,
      firstEmittedAt: first,
      lastEmittedAt: last,
      perDay: list.length / spanDays,
      openInProfit: openList.filter((o) => o.status === "profit").length,
      openInLoss: openList.filter((o) => o.status === "loss").length,
      openUnrealizedR: openList.reduce((s, o) => s + (o.unrealizedR ?? 0), 0),
    };
  });

  return { engines, open };
}
