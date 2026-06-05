import { describe, expect, it } from "vitest";
import { buildDualScenarios } from "../src/scenarios";
import { atr } from "../src/indicators/volatility";
import { seededWalk } from "./fixtures/candles";

describe("buildDualScenarios", () => {
  it("é determinístico", () => {
    const candles = seededWalk(200, 21);
    const atrVal = atr(candles, 14);
    const a = buildDualScenarios(candles, atrVal, { simulations: 3000, seed: 7 });
    const b = buildDualScenarios(candles, atrVal, { simulations: 3000, seed: 7 });
    expect(a.buy.expectedR).toBe(b.buy.expectedR);
    expect(a.recommended).toBe(b.recommended);
  });

  it("probabilidades de TP são monótonas em ambos os lados", () => {
    const candles = seededWalk(200, 22);
    const s = buildDualScenarios(candles, atr(candles, 14), { simulations: 4000 });
    for (const side of [s.buy, s.sell]) {
      expect(side.tp1.probability.value).toBeGreaterThanOrEqual(side.tp2.probability.value);
      expect(side.tp2.probability.value).toBeGreaterThanOrEqual(side.tp3.probability.value);
    }
  });

  it("recommended é o lado de maior R esperado; edge ≥ 0", () => {
    const candles = seededWalk(200, 23);
    const s = buildDualScenarios(candles, atr(candles, 14), { simulations: 4000 });
    const better = s.buy.expectedR >= s.sell.expectedR ? "buy" : "sell";
    expect(s.recommended).toBe(better);
    expect(s.edge).toBeGreaterThanOrEqual(0);
  });

  it("distância % do TP1 tem o sinal correto por lado", () => {
    const candles = seededWalk(200, 24);
    const s = buildDualScenarios(candles, atr(candles, 14), { simulations: 1000 });
    expect(s.buy.tp1.distancePct).toBeGreaterThan(0);
    expect(s.sell.tp1.distancePct).toBeLessThan(0);
  });
});
