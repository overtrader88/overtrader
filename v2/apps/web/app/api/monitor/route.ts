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
import { resolveLifecycle, type SignalPlan } from "@tradeai/engine";
import { analyzeSymbol } from "@/lib/analysis/service";
import { TRACKED_MARKETS, type TrackedMarket } from "@/lib/signals/tracked";
import { findAsset } from "@/lib/market/catalog";
import { supabaseService } from "@/lib/supabase/server";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TFS = ["15m", "1h", "4h", "1d", "1w", "1M"];
/** Mesma janela/volume do cron resolve-signals — para o ciclo de vida ao vivo bater com o oficial. */
const LC_MAX_DURATION = 60;
const LC_FETCH_LIMIT = 400;

/** Sinal aberto cru, o suficiente para reconstruir o ciclo de vida contra o mercado. */
interface OpenSignalRow {
  symbol: string; asset_type: string; timeframe: string; side: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number; emitted_at: string;
}

/** Estado do ciclo de vida calculado AO VIVO (candles desde a emissão). */
interface LiveLifecycle {
  tp1Hit: boolean; tp2Hit: boolean; tp3Hit: boolean;
  stopStage: "initial" | "breakeven" | "tp1";
  currentStop: number;
  closedFraction: number;
  status: "open" | "resolved";
  outcome: string | null;
  pnlR: number | null;
  price: number | null;
}

/**
 * Reconstrói o ciclo de vida de um sinal aberto contra o mercado AGORA — sem
 * esperar o cron. Aplica a gestão real (1/3 por alvo + stop móvel: → breakeven
 * após TP1, → TP1 após TP2) e CONFIRMA, varrendo os candles em ordem, se um alvo
 * maior foi tocado antes de o preço voltar e zerar no stop deslocado.
 */
async function liveLifecycle(
  s: OpenSignalRow,
  providers: ReturnType<typeof realProviders>,
  cache: ReturnType<typeof getMarketCache>,
): Promise<LiveLifecycle | null> {
  try {
    const candles = await getCandles(s.symbol, s.asset_type as AssetType, s.timeframe as Timeframe, LC_FETCH_LIMIT, {
      providers, cache, cacheTtlSeconds: 120, minCandles: 30,
    });
    const emittedMs = Date.parse(s.emitted_at);
    const future = candles.filter((c) => c.time > emittedMs);
    const plan: SignalPlan = {
      side: s.side === "sell" ? "sell" : "buy",
      entry: s.entry, stopLoss: s.stop_loss, takeProfit1: s.tp1, takeProfit2: s.tp2, takeProfit3: s.tp3,
    };
    const r = resolveLifecycle(plan, future, LC_MAX_DURATION);
    return {
      tp1Hit: r.tp1Hit, tp2Hit: r.tp2Hit, tp3Hit: r.tp3Hit, stopStage: r.stopStage,
      currentStop: r.currentStop, closedFraction: r.closedFraction, status: r.status,
      outcome: r.outcome, pnlR: r.pnlR, price: candles.length ? candles[candles.length - 1]!.close : null,
    };
  } catch {
    return null;
  }
}

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
    const core = "symbol,asset_type,timeframe,direction,side,seal,entry,stop_loss,tp1,tp2,tp3,regime,emitted_at,tp1_hit,tp2_hit,tp3_hit,stop_stage";
    const q = (cols: string) => sb.from("signals").select(cols).is("outcome", null).order("emitted_at", { ascending: false }).limit(12);
    // tenta com narrative (migration 0005); se a coluna ainda não existe, faz fallback.
    const withNarr = await q(`${core},narrative`);
    const rows = ((withNarr.error ? (await q(core)).data : withNarr.data) as unknown[]) ?? [];
    // Ciclo de vida AO VIVO: marca a mercado cada sinal aberto (gestão em terços + stop móvel).
    const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
    const cache = getMarketCache();
    signals = await Promise.all(
      rows.map(async (row) => ({ ...(row as object), live: await liveLifecycle(row as OpenSignalRow, providers, cache) })),
    );
  }

  return NextResponse.json({ markets, signals, ts: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
