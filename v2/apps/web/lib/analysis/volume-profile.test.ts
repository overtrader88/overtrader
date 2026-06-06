import { describe, it, expect } from "vitest";
import { computeVolumeProfile } from "./volume-profile";
import { detectWyckoffEvents } from "./wyckoff-events";
import type { Candle } from "@tradeai/shared";

function c(time: number, o: number, h: number, l: number, close: number, volume = 100): Candle {
  return { time, open: o, high: h, low: l, close, volume };
}

describe("computeVolumeProfile", () => {
  it("acha POC na faixa de maior volume e VAL≤POC≤VAH", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 50; i++) {
      // concentra volume perto de 100 (a maioria oscila 99-101), poucos em 90/110
      const base = i % 10 === 0 ? 90 : i % 7 === 0 ? 110 : 100;
      candles.push(c(i, base, base + 1, base - 1, base, base === 100 ? 500 : 50));
    }
    const vp = computeVolumeProfile(candles, 24)!;
    expect(vp).not.toBeNull();
    expect(vp.poc).toBeGreaterThan(95);
    expect(vp.poc).toBeLessThan(105);
    expect(vp.val).toBeLessThanOrEqual(vp.poc);
    expect(vp.vah).toBeGreaterThanOrEqual(vp.poc);
  });

  it("retorna null sem volume", () => {
    const candles = Array.from({ length: 20 }, (_, i) => c(i, 100, 101, 99, 100, 0));
    expect(computeVolumeProfile(candles)).toBeNull();
  });
});

describe("detectWyckoffEvents", () => {
  it("detecta Spring (varre mínima e recupera)", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 25; i++) candles.push(c(i, 100, 101, 99, 100)); // range estável 99-101
    // candle que fura 99 mas fecha em 100.5 → Spring
    candles.push(c(25, 100, 100.6, 97, 100.5));
    const ev = detectWyckoffEvents(candles, 20);
    expect(ev.some((e) => e.type === "Spring")).toBe(true);
  });

  it("detecta UTAD (varre máxima e rejeita)", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 25; i++) candles.push(c(i, 100, 101, 99, 100));
    candles.push(c(25, 100, 104, 99.5, 99.8)); // fura 101, fecha abaixo → UTAD
    const ev = detectWyckoffEvents(candles, 20);
    expect(ev.some((e) => e.type === "UTAD")).toBe(true);
  });
});
