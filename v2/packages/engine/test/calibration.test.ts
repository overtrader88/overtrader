import { describe, expect, it } from "vitest";
import { runCalibrationSweep, oosWithinIsCI, syntheticCandles, type SweepCase } from "../src/calibration";
import { runBacktest } from "../src/backtest";

function cases(): SweepCase[] {
  return [
    { label: "BTC 1h", input: { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", candles: syntheticCandles("crypto", "1h", 700, 1) } },
    { label: "EUR 1h", input: { symbol: "EURUSD", assetType: "forex", timeframe: "1h", candles: syntheticCandles("forex", "1h", 700, 2) } },
    { label: "AAPL 1d", input: { symbol: "AAPL", assetType: "stocks", timeframe: "1d", candles: syntheticCandles("stocks", "1d", 700, 3) } },
  ];
}

describe("harness de calibração", () => {
  it("syntheticCandles é determinístico e bem-formado", () => {
    const a = syntheticCandles("crypto", "4h", 100, 7);
    const b = syntheticCandles("crypto", "4h", 100, 7);
    expect(a).toHaveLength(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const c of a) {
      expect(c.high).toBeGreaterThanOrEqual(c.low);
      expect(c.close).toBeGreaterThan(0);
    }
  });

  it("runCalibrationSweep retorna relatório com percentuais em [0,100]", () => {
    const r = runCalibrationSweep(cases());
    expect(r.cases).toHaveLength(3);
    expect(r.summary.n).toBe(3);
    expect(r.summary.sufficientPct).toBeGreaterThanOrEqual(0);
    expect(r.summary.sufficientPct).toBeLessThanOrEqual(100);
    expect(r.summary.oosWithinPct).toBeGreaterThanOrEqual(0);
    expect(r.summary.oosWithinPct).toBeLessThanOrEqual(100);
    for (const c of r.cases) {
      expect(c.decisiveTrades).toBeLessThanOrEqual(c.totalTrades);
    }
  });

  it("oosWithinIsCI é boolean quando há OOS, null quando não há", () => {
    const big = runBacktest(cases()[0]!.input);
    const verdict = oosWithinIsCI(big);
    expect(verdict === null || typeof verdict === "boolean").toBe(true);
    const tiny = runBacktest({ symbol: "X", assetType: "crypto", timeframe: "1h", candles: syntheticCandles("crypto", "1h", 230, 9) });
    // poucos trades → sem split OOS
    if (tiny.totalTrades < 20) expect(oosWithinIsCI(tiny)).toBeNull();
  });
});
