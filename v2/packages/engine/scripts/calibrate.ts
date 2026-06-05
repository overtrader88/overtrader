/**
 * Harness de calibração — executável.
 *
 *   pnpm --filter @tradeai/engine calibrate
 *
 * Hoje roda sobre candles SINTÉTICOS (sem edge real) só para exercitar o
 * encanamento e os experimentos do brainstorm. Quando a borda (M4) tiver dados
 * reais, basta trocar `syntheticCandles(...)` por candles de verdade.
 */
import type { AssetType, Timeframe } from "@tradeai/shared";
import { runCalibrationSweep, syntheticCandles, type SweepCase } from "../src/calibration";

const ASSETS: { assetType: AssetType; timeframe: Timeframe; symbol: string }[] = [
  { assetType: "crypto", timeframe: "1h", symbol: "BTCUSDT" },
  { assetType: "crypto", timeframe: "4h", symbol: "ETHUSDT" },
  { assetType: "crypto", timeframe: "1d", symbol: "BTCUSDT" },
  { assetType: "forex", timeframe: "1h", symbol: "EURUSD" },
  { assetType: "stocks", timeframe: "1d", symbol: "AAPL" },
  { assetType: "indices", timeframe: "4h", symbol: "SPX" },
];

const N = 900; // candles sintéticos por caso

const cases: SweepCase[] = ASSETS.map((a, i) => ({
  label: `${a.symbol} ${a.timeframe}`,
  input: {
    symbol: a.symbol,
    assetType: a.assetType,
    timeframe: a.timeframe,
    candles: syntheticCandles(a.assetType, a.timeframe, N, 100 + i),
  },
}));

const report = runCalibrationSweep(cases);

const pct = (x: number): string => `${x}%`;
const pad = (s: string, n: number): string => s.padEnd(n);

console.log("\n=== Harness de calibração (dados SINTÉTICOS — sem edge real) ===\n");
console.log(
  pad("Caso", 16), pad("trades", 8), pad("decis.", 8), pad("amostra", 9),
  pad("trunc.", 7), pad("PF", 7), pad("OOS⊂IC", 8), "regimes",
);
for (const c of report.cases) {
  console.log(
    pad(c.label, 16),
    pad(String(c.totalTrades), 8),
    pad(String(c.decisiveTrades), 8),
    pad(c.sampleSufficient ? "ok" : "baixa", 9),
    pad(c.truncated ? "sim" : "não", 7),
    pad(c.profitFactor.toFixed(2), 7),
    pad(c.oosWithinCI === null ? "—" : c.oosWithinCI ? "sim" : "NÃO", 8),
    c.regimes.join(",") || "—",
  );
}
console.log("\n--- Agregado ---");
console.log(`Casos: ${report.summary.n}`);
console.log(`Amostra suficiente: ${pct(report.summary.sufficientPct)} (alvo do brainstorm ≥ 80%)`);
console.log(`OOS dentro do IC in-sample: ${pct(report.summary.oosWithinPct)} (alvo ≥ 70% = sem overfitting)`);
console.log("\nNota: sintético não tem edge — números servem só para validar o encanamento.\n");
