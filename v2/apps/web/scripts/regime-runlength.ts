/**
 * MEDIÇÃO (Pacote B, achado 4 — "medir antes de mudar"): RUN-LENGTH do regime
 * de mercado sobre a série histórica de ADX. Se o rótulo troca a cada poucos
 * candles (run médio ≪ duração média do trade, ~38 candles), o regime atual é
 * ruído e a histerese 25/20 se justifica; senão, o achado morre. Também SIMULA
 * a histerese proposta (entra trending ADX≥25, sai ADX<20) como medição pura —
 * NADA muda em produção.
 *
 *   pnpm --filter @tradeai/web measure:regime
 */
import type { Timeframe, AssetType, Candle } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, precomputeBase, regimeAt } from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";
import { getCandles, realProviders } from "../lib/market/providers";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();
const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });
const START = DEFAULT_ENGINE_CONFIG.backtest.minCandlesForEngine; // 200
const TRADE_DURATION_BENCHMARK = 38; // duração média observada no forward (candles)

interface CaseDef { symbol: string; assetType: AssetType; tf: Timeframe; total: number }
const CASES: CaseDef[] = [
  { symbol: "BTCUSDT", assetType: "crypto", tf: "4h", total: 11000 },
  { symbol: "ETHUSDT", assetType: "crypto", tf: "4h", total: 11000 },
  { symbol: "SOLUSDT", assetType: "crypto", tf: "4h", total: 9000 },
  { symbol: "BTCUSDT", assetType: "crypto", tf: "1d", total: 2600 },
  { symbol: "XAUUSD", assetType: "commodities", tf: "4h", total: 3000 },
  { symbol: "EURUSD", assetType: "forex", tf: "4h", total: 3000 },
  { symbol: "SPX", assetType: "indices", tf: "4h", total: 3000 },
];

function runs(labels: string[]): number[] {
  const out: number[] = [];
  let len = 0;
  for (let i = 0; i < labels.length; i++) {
    len++;
    if (i === labels.length - 1 || labels[i + 1] !== labels[i]) { out.push(len); len = 0; }
  }
  return out;
}
const q = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

function stats(lengths: number[]): { n: number; mean: number; median: number; p90: number; under3: number } {
  const s = [...lengths].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return {
    n: s.length, mean, median: q(s, 0.5), p90: q(s, 0.9),
    under3: s.length ? s.filter((x) => x < 3).length / s.length : 0,
  };
}

/** Histerese proposta no achado 4 (só medição): entra trending com ADX≥25, sai com ADX<20. */
function hysteresisLabels(adx: number[], trendingAt: number, rangingAt: number): string[] {
  const out: string[] = [];
  let state = "transitional";
  for (const v of adx) {
    if (Number.isNaN(v)) { out.push(state); continue; }
    if (v >= trendingAt) state = "trending";
    else if (v < rangingAt) state = "ranging";
    // 20 ≤ ADX < 25 → mantém o estado anterior (a histerese em si)
    out.push(state);
  }
  return out;
}

async function main(): Promise<void> {
  console.log("\n=== Run-length do regime (série de ADX) — regra atual vs histerese 25/20 ===");
  const cfg = DEFAULT_ENGINE_CONFIG;
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const pad = (s: string, n: number): string => s.padEnd(n);
  console.log(pad("\ncaso", 15) + pad("análises", 10) + pad("run méd", 9) + pad("run p50", 9) + pad("run p90", 9) + pad("<3cd", 7) + pad("| hist méd", 11) + pad("hist p50", 10) + "explosive%");

  const allCur: number[] = [];
  const allHys: number[] = [];
  for (const cs of CASES) {
    let candles: Candle[];
    try {
      candles = cs.assetType === "crypto"
        ? await fetchBinanceHistory(cs.symbol, cs.tf, cs.total, jsonFetcher)
        : await getCandles(cs.symbol, cs.assetType, cs.tf, cs.total, { providers, minCandles: 300 });
    } catch (e) {
      console.log(`${cs.symbol} ${cs.tf}: FALHOU (${e instanceof Error ? e.message : e})`);
      continue;
    }
    if (candles.length < START + 50) { console.log(`${cs.symbol} ${cs.tf}: só ${candles.length} candles — pulado`); continue; }
    const base = precomputeBase(candles);
    const labels: string[] = [];
    const adxSeries: number[] = [];
    let explosive = 0;
    for (let i = START; i < candles.length; i++) {
      const r = regimeAt(i, base, cfg);
      labels.push(r.regime);
      adxSeries.push(r.adxValue);
      if (r.regime === "explosive") explosive++;
    }
    const cur = runs(labels);
    const hys = runs(hysteresisLabels(adxSeries, cfg.regime.adxTrending, cfg.regime.adxRanging));
    allCur.push(...cur);
    allHys.push(...hys);
    const sc = stats(cur);
    const sh = stats(hys);
    console.log(
      pad(`${cs.symbol} ${cs.tf}`, 15) + pad(String(labels.length), 10) +
      pad(sc.mean.toFixed(1), 9) + pad(String(sc.median), 9) + pad(String(sc.p90), 9) +
      pad((sc.under3 * 100).toFixed(0) + "%", 7) +
      pad("| " + sh.mean.toFixed(1), 11) + pad(String(sh.median), 10) +
      ((explosive / labels.length) * 100).toFixed(2) + "%",
    );
  }
  if (allCur.length === 0) { console.log("sem dados\n"); return; }

  const sc = stats(allCur);
  const sh = stats(allHys);
  console.log("\n--- AGREGADO ---");
  console.log(`Regra atual:      run médio ${sc.mean.toFixed(1)} candles · mediana ${sc.median} · p90 ${sc.p90} · ${(sc.under3 * 100).toFixed(0)}% dos runs <3 candles (${sc.n} runs)`);
  console.log(`Histerese 25/20:  run médio ${sh.mean.toFixed(1)} candles · mediana ${sh.median} · p90 ${sh.p90} · ${(sh.under3 * 100).toFixed(0)}% dos runs <3 candles (${sh.n} runs)`);
  console.log(`\nBenchmark de decisão (achado 4): duração média do trade ≈ ${TRADE_DURATION_BENCHMARK} candles.`);
  console.log("Só implementar a histerese se o run médio ATUAL for materialmente menor que a");
  console.log("duração do trade. Nota: a simulação de histerese ignora o ramo explosive (ATR),");
  console.log("que é praticamente inalcançável (ver % explosive por caso).\n");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
