import { describe, it, expect } from "vitest";
import { syntheticCandles, type AnalysisInput } from "@tradeai/engine";
import { runFullAnalysis } from "./full";

function input(): AnalysisInput {
  return {
    symbol: "BTCUSDT",
    assetType: "crypto",
    timeframe: "4h",
    candles: syntheticCandles("crypto", "4h", 700, 42),
  };
}

describe("runFullAnalysis", () => {
  it("compõe todas as camadas no modo complete", () => {
    const r = runFullAnalysis(input(), { generatedAt: 1_700_000_000_000, type: "complete" });
    expect(r.type).toBe("complete");
    expect(r.generatedAt).toBe(1_700_000_000_000);
    expect(r.analysis.meta.generatedAt).toBe(1_700_000_000_000);
    expect(r.montecarlo).toBeDefined();
    expect(r.scenarios).toBeDefined();
    expect(r.backtest).toBeDefined();
    expect(r.quality).toBeDefined();
    expect(r.equityCurve).toBeDefined();
    expect(r.smc).toBeDefined();
    expect(r.smc?.kind).toBe("qualitative");
    expect(r.harmonics).toBeDefined();
    expect(r.harmonics?.kind).toBe("qualitative");
    expect(r.wegd).toBeDefined();
    expect(r.wegd?.kind).toBe("qualitative");
    expect(r.seasonality).toBeDefined();
    expect(r.seasonality?.monthly).toHaveLength(12);
    expect(r.multiTimeframe).toBeUndefined(); // só a borda compõe (precisa buscar TFs superiores)
  });

  it("o modo simple pula as camadas probabilísticas", () => {
    const r = runFullAnalysis(input(), { generatedAt: 1, type: "simple" });
    expect(r.type).toBe("simple");
    expect(r.analysis).toBeDefined();
    expect(r.montecarlo).toBeUndefined();
    expect(r.scenarios).toBeUndefined();
    expect(r.backtest).toBeUndefined();
    expect(r.smc).toBeUndefined();
    expect(r.harmonics).toBeUndefined();
    expect(r.wegd).toBeUndefined();
    expect(r.seasonality).toBeUndefined();
    expect(r.multiTimeframe).toBeUndefined();
  });

  it("é determinístico (mesma entrada → mesma saída)", () => {
    const a = runFullAnalysis(input(), { generatedAt: 7, type: "complete" });
    const b = runFullAnalysis(input(), { generatedAt: 7, type: "complete" });
    expect(b).toEqual(a);
  });

  it("a curva de capital começa em zero", () => {
    const r = runFullAnalysis(input(), { generatedAt: 7, type: "complete" });
    expect(r.equityCurve?.[0]).toBe(0);
    expect((r.equityCurve?.length ?? 0)).toBeGreaterThan(0);
  });

  it("o período tem formato legível mmm/aa–mmm/aa", () => {
    const r = runFullAnalysis(input(), { generatedAt: 7 });
    expect(r.period).toMatch(/^[a-z]{3}\/\d{2}–[a-z]{3}\/\d{2}$/);
  });

  it("winRateUp do Monte Carlo é uma proporção válida com IC em [0,1]", () => {
    const r = runFullAnalysis(input(), { generatedAt: 7, type: "complete" });
    const wr = r.montecarlo!.winRateUp;
    expect(wr.value).toBeGreaterThanOrEqual(0);
    expect(wr.value).toBeLessThanOrEqual(1);
    expect(wr.ci95[0]).toBeGreaterThanOrEqual(0);
    expect(wr.ci95[1]).toBeLessThanOrEqual(1);
  });

  it("compõe a confluência multi-timeframe quando a borda passa TFs superiores", () => {
    const higher: AnalysisInput = {
      symbol: "BTCUSDT", assetType: "crypto", timeframe: "1d",
      candles: syntheticCandles("crypto", "1d", 400, 7),
    };
    const r = runFullAnalysis(input(), { generatedAt: 7, type: "complete", higherTimeframes: [higher, null] });
    expect(r.multiTimeframe).toBeDefined();
    expect(r.multiTimeframe!.current.timeframe).toBe("4h");
    expect(r.multiTimeframe!.confluenceScore).toBeGreaterThanOrEqual(0);
    expect(r.multiTimeframe!.confluenceScore).toBeLessThanOrEqual(100);
  });
});
