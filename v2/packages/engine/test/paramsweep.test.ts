import { describe, expect, it } from "vitest";
import { runParamSweep, syntheticCandles, type SweepCase, type ConfigVariant } from "../src/calibration";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";

function cases(): SweepCase[] {
  return [
    { label: "A", input: { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", candles: syntheticCandles("crypto", "1h", 900, 1) } },
    { label: "B", input: { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h", candles: syntheticCandles("crypto", "4h", 900, 2) } },
  ];
}

function variants(): ConfigVariant[] {
  const tight = structuredClone(DEFAULT_ENGINE_CONFIG);
  tight.gates.minConfluence = 7;
  return [
    { label: "DEFAULT", config: DEFAULT_ENGINE_CONFIG },
    { label: "conf7", config: tight },
  ];
}

describe("runParamSweep", () => {
  it("retorna um resultado por variante, ordenado por OOS PF desc", () => {
    const r = runParamSweep(cases(), variants());
    expect(r).toHaveLength(2);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1]!.oosPfMedian).toBeGreaterThanOrEqual(r[i]!.oosPfMedian);
    }
    for (const v of r) {
      expect(v.totalCases).toBe(2);
      expect(v.sufficientCases).toBeLessThanOrEqual(v.totalCases);
      expect(v.positiveOosCases).toBeLessThanOrEqual(v.sufficientCases);
      expect(["DEFAULT", "conf7"]).toContain(v.label);
    }
  });

  it("expõe oosPfIqr/totalDecisive/byRegime (regra 1-SE — Pacote C)", () => {
    const r = runParamSweep(cases(), variants());
    for (const v of r) {
      expect(v.oosPfIqr).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(v.totalDecisive)).toBe(true);
      expect(v.totalDecisive).toBeGreaterThanOrEqual(0);
      expect(typeof v.byRegime).toBe("object");
      for (const pf of Object.values(v.byRegime)) {
        expect(Number.isFinite(pf)).toBe(true);
      }
    }
  });
});
