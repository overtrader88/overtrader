import { describe, expect, it } from "vitest";
import { runAnalysis, ENGINE_VERSION } from "../src/analysis/run";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import type { AnalysisInput } from "../src/types";
import { seededWalk, upTrendCandles } from "./fixtures/candles";

function input(candles: AnalysisInput["candles"]): AnalysisInput {
  return { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", candles };
}

describe("runAnalysis — pipeline e2e", () => {
  it("produz resultado completo sobre dados realistas", () => {
    const r = runAnalysis(input(seededWalk(250)), { generatedAt: 123 });
    expect(r.indicators).toHaveLength(20);
    expect(r.gates).toHaveLength(8);
    expect(r.meta.engineVersion).toBe(ENGINE_VERSION);
    expect(r.meta.generatedAt).toBe(123);
    expect(r.meta.candlesUsed).toBe(250);
    expect(r.explanation.summary.length).toBeGreaterThan(0);
    // a explicação cita "/8" gates (correção do bug "/6" do v1)
    if (r.signal.signal !== "NEUTRAL") {
      expect(r.explanation.summary).toContain(`/${r.gates.length} gates`);
    }
  });

  it("é determinístico — mesma entrada, mesma saída", () => {
    const a = runAnalysis(input(seededWalk(250, 7)), { generatedAt: 0 });
    const b = runAnalysis(input(seededWalk(250, 7)), { generatedAt: 0 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("uptrend forte → votação majoritária de compra", () => {
    const r = runAnalysis(input(upTrendCandles(250)));
    expect(r.signal.votes.buy).toBeGreaterThan(r.signal.votes.sell);
  });

  it("lança erro com candles insuficientes", () => {
    expect(() => runAnalysis(input(seededWalk(30)))).toThrow(/Mínimo/);
  });

  it("respeita config injetado (minCandles maior)", () => {
    expect(() =>
      runAnalysis(input(seededWalk(80)), {
        config: { ...DEFAULT_ENGINE_CONFIG, minCandles: 100 },
      }),
    ).toThrow(/Mínimo 100/);
  });
});
