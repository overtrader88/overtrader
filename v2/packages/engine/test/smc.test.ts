import { describe, expect, it } from "vitest";
import type { Candle } from "@tradeai/shared";
import { analyzeSmc } from "../src/smc";
import { atr } from "../src/indicators/volatility";
import { seededWalk } from "./fixtures/candles";

const STEP = 3_600_000;
function flat(price: number, n: number, startTime = 0, range = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: startTime + i * STEP, open: price, high: price + range / 2, low: price - range / 2, close: price, volume: 1000,
  }));
}

describe("analyzeSmc", () => {
  it("é qualitativo e determinístico", () => {
    const c = seededWalk(300, 41);
    const a = analyzeSmc(c, atr(c, 14));
    const b = analyzeSmc(c, atr(c, 14));
    expect(a.kind).toBe("qualitative");
    expect(a.disclaimer.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("respeita os limites de quantidade do config", () => {
    const c = seededWalk(400, 42);
    const r = analyzeSmc(c, atr(c, 14));
    expect(r.orderBlocks.length).toBeLessThanOrEqual(5);
    expect(r.fvgs.length).toBeLessThanOrEqual(8);
    expect(r.liquidityZones.length).toBeLessThanOrEqual(5);
    for (const ob of r.orderBlocks) {
      expect(ob.strength).toBeGreaterThanOrEqual(0);
      expect(ob.strength).toBeLessThanOrEqual(100);
    }
  });

  it("detecta um Fair Value Gap bullish construído", () => {
    // 30 velas a 100, um gap de 3 velas (100 → salto → 105), depois 105.
    const pre = flat(100, 30, 0);
    const gapMid: Candle = { time: 30 * STEP, open: 100.5, high: 104, low: 100.4, close: 103.8, volume: 1500 };
    const gapEnd: Candle = { time: 31 * STEP, open: 104, high: 106, low: 105, close: 105.5, volume: 1500 };
    const post = flat(105.5, 30, 32 * STEP);
    const candles = [...pre, gapMid, gapEnd, ...post];
    const r = analyzeSmc(candles, atr(candles, 14));
    const bullishFvg = r.fvgs.find((f) => f.type === "bullish");
    expect(bullishFvg).toBeTruthy();
  });

  it("dados insuficientes → neutro com aviso", () => {
    const r = analyzeSmc(flat(100, 20, 0), 1);
    expect(r.bias).toBe("neutral");
    expect(r.summary).toMatch(/insuficiente/i);
  });
});
