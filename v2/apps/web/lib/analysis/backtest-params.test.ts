import { describe, it, expect } from "vitest";
import { RISK_PRESETS, riskPresetById, isStrategy, monthsToCandles, STRATEGY_OPTIONS } from "./backtest-params";

describe("backtest-params", () => {
  it("R:R de cada preset bate com tp1Mult/slMult", () => {
    for (const p of RISK_PRESETS) {
      expect(p.tp1Mult / p.slMult).toBeCloseTo(p.rr, 1);
    }
  });

  it("riskPresetById cai no padrão p/ id inválido", () => {
    expect(riskPresetById("xyz").id).toBe("standard");
    expect(riskPresetById("wide").id).toBe("wide");
  });

  it("isStrategy valida as 3 estratégias", () => {
    expect(STRATEGY_OPTIONS.every((o) => isStrategy(o.value))).toBe(true);
    expect(isStrategy("foo")).toBe(false);
  });

  it("monthsToCandles cresce com o período e respeita o piso de 60", () => {
    const c12 = monthsToCandles("crypto", "4h", 12);
    const c24 = monthsToCandles("crypto", "4h", 24);
    expect(c24).toBeGreaterThan(c12);
    expect(monthsToCandles("crypto", "1M", 12)).toBeGreaterThanOrEqual(60);
  });
});
