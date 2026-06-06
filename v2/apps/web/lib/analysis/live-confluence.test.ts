import { describe, it, expect } from "vitest";
import { computeLiveConfluence } from "./live-confluence";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

const baseBuy = {
  analysis: {
    signal: { signal: "BUY" },
    risk: { entry: 100 },
    indicators: [
      { name: "EMA (20)", value: 102 },
      { name: "EMA (50)", value: 99 },
      { name: "EMA (200)", value: 95 },
    ],
  },
  montecarlo: { currentPrice: 105 },
  smc: { bias: "bullish" },
};

describe("computeLiveConfluence", () => {
  it("SOS + LPS + preço acima da EMA50 → entrada compradora reforçada", () => {
    const c = computeLiveConfluence(dto({
      ...baseBuy,
      wyckoffEvents: [
        { type: "SOS", side: "bull", time: 1, price: 100 },
        { type: "LPS", side: "bull", time: 2, price: 101 },
      ],
    }), 105);
    expect(c.side).toBe("buy");
    expect(c.reinforced).toBe(true);
    expect(c.verdict).toBe("entrada compradora reforçada");
    expect(c.phrase).toMatch(/SOS \+ LPS/);
    expect(c.phrase).toMatch(/EMA50/);
  });

  it("sinais conflitantes → mistos/cautela", () => {
    const c = computeLiveConfluence(dto({
      analysis: {
        signal: { signal: "BUY" },
        risk: { entry: 100 },
        indicators: [
          { name: "EMA (20)", value: 95 },
          { name: "EMA (50)", value: 99 },
          { name: "EMA (200)", value: 110 },
        ],
      },
      montecarlo: { currentPrice: 96 }, // abaixo da EMA50 e EMA200 → contra o BUY
      smc: { bias: "bearish" },
      wyckoffEvents: [{ type: "UTAD", side: "bear", time: 1, price: 100 }],
    }), 96);
    expect(c.againstCount).toBeGreaterThan(c.agreeCount);
    expect(c.verdict).toBe("sinais mistos — cautela");
    expect(c.reinforced).toBe(false);
  });

  it("sinal neutro → sem direção definida", () => {
    const c = computeLiveConfluence(dto({
      analysis: { signal: { signal: "NEUTRAL" }, risk: {}, indicators: [] },
      montecarlo: { currentPrice: 100 },
    }), 100);
    expect(c.side).toBe("neutral");
    expect(c.reinforced).toBe(false);
    expect(c.phrase).toMatch(/sem direção/);
  });
});
