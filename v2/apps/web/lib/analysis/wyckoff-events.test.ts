import { describe, it, expect } from "vitest";
import { detectWyckoffEvents } from "./wyckoff-events";
import type { Candle } from "@tradeai/shared";

// base lateral: 20 candles num range estreito ~100, range ~2, volume ~100
function flat(n: number, start = 0): Candle[] {
  return Array.from({ length: n }, (_, k) => {
    const t = (start + k) * 60_000;
    return { time: t, open: 100, high: 101, low: 99, close: 100, volume: 100 } as Candle;
  });
}

describe("detectWyckoffEvents", () => {
  it("Spring: varre a mínima e recupera", () => {
    const c = flat(21);
    c.push({ time: 21 * 60_000, open: 100, high: 100.5, low: 95, close: 100.2, volume: 120 });
    const ev = detectWyckoffEvents(c);
    expect(ev.some((e) => e.type === "Spring" && e.side === "bull")).toBe(true);
  });

  it("UTAD: varre a máxima e rejeita", () => {
    const c = flat(21);
    c.push({ time: 21 * 60_000, open: 100, high: 106, low: 99.5, close: 99.8, volume: 120 });
    const ev = detectWyckoffEvents(c);
    expect(ev.some((e) => e.type === "UTAD" && e.side === "bear")).toBe(true);
  });

  it("SOS: rompe a resistência com candle largo de alta e volume", () => {
    const c = flat(21);
    // fecha acima do swingHigh (101), range largo (>1.3*2), volume alto (>1.2*100)
    c.push({ time: 21 * 60_000, open: 100.5, high: 105, low: 100.4, close: 104.5, volume: 400 });
    const ev = detectWyckoffEvents(c);
    expect(ev.some((e) => e.type === "SOS" && e.side === "bull")).toBe(true);
  });

  it("SOW: perde o suporte com candle largo de baixa e volume", () => {
    const c = flat(21);
    c.push({ time: 21 * 60_000, open: 99.5, high: 99.6, low: 95, close: 95.5, volume: 400 });
    const ev = detectWyckoffEvents(c);
    expect(ev.some((e) => e.type === "SOW" && e.side === "bear")).toBe(true);
  });

  it("sem candles suficientes → vazio", () => {
    expect(detectWyckoffEvents(flat(5))).toEqual([]);
  });
});
