import { describe, expect, it } from "vitest";
import type { Candle } from "@tradeai/shared";
import { analyzeWegd } from "../src/wegd";
import { seededWalk } from "./fixtures/candles";

const STEP = 3_600_000;

/** Zigzag ascendente: pernas de alta com pullbacks menores → HH + HL. */
function ascendingZigzag(legs: number): Candle[] {
  const out: Candle[] = [];
  let price = 100;
  let t = 0;
  const push = (p: number): void => {
    out.push({ time: t * STEP, open: p, high: p + 0.4, low: p - 0.4, close: p, volume: 1000 });
    t++;
  };
  for (let l = 0; l < legs; l++) {
    for (let i = 0; i < 8; i++) { price += 2; push(price); }   // sobe
    for (let i = 0; i < 4; i++) { price -= 1; push(price); }   // pullback menor
  }
  // termina numa perna de alta limpa (últimos candles em alta → Wyckoff markup)
  for (let i = 0; i < 14; i++) { price += 2; push(price); }
  return out;
}

describe("analyzeWegd", () => {
  it("é qualitativo e determinístico", () => {
    const c = seededWalk(300, 61);
    const a = analyzeWegd(c);
    const b = analyzeWegd(c);
    expect(a.kind).toBe("qualitative");
    expect(a.disclaimer.length).toBeGreaterThan(0);
    expect(a.summary.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("Gann projeta 0 ou 5 níveis; contadores Dow não-negativos", () => {
    const c = seededWalk(300, 62);
    const r = analyzeWegd(c);
    expect([0, 5]).toContain(r.gann.levels.length);
    expect(r.dow.higherHighs).toBeGreaterThanOrEqual(0);
    expect(r.dow.lowerLows).toBeGreaterThanOrEqual(0);
  });

  it("zigzag ascendente → Dow alta primária e Wyckoff markup", () => {
    const c = ascendingZigzag(8);
    const r = analyzeWegd(c);
    expect(r.dow.primaryTrend).toBe("primary_uptrend");
    expect(r.dow.higherHighs).toBeGreaterThan(0);
    expect(r.wyckoff.phase).toBe("markup");
  });
});
