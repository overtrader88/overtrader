import { describe, expect, it } from "vitest";
import { runMonteCarlo, firstPassageOutcomes } from "../src/montecarlo";
import type { BarrierLevels } from "../src/montecarlo";
import { seededWalk, constantCandles } from "./fixtures/candles";

describe("Monte Carlo", () => {
  it("é determinístico com a mesma seed", () => {
    const a = runMonteCarlo(seededWalk(120, 7), { assetType: "crypto", timeframe: "1h", seed: 99 });
    const b = runMonteCarlo(seededWalk(120, 7), { assetType: "crypto", timeframe: "1h", seed: 99 });
    expect(a.median).toBe(b.median);
    expect(a.winRateUp.value).toBe(b.winRateUp.value);
  });

  it("ordena os percentis (pessimista ≤ mediana ≤ otimista)", () => {
    const r = runMonteCarlo(seededWalk(200, 3), { assetType: "crypto", timeframe: "1h", simulations: 3000 });
    expect(r.pessimistic).toBeLessThanOrEqual(r.median);
    expect(r.median).toBeLessThanOrEqual(r.optimistic);
  });

  it("winRateUp vem com IC válido (0..1, n correto)", () => {
    const r = runMonteCarlo(seededWalk(200, 5), { assetType: "crypto", timeframe: "1h", simulations: 2000 });
    expect(r.winRateUp.value).toBeGreaterThanOrEqual(0);
    expect(r.winRateUp.value).toBeLessThanOrEqual(1);
    expect(r.winRateUp.ci95[0]).toBeLessThanOrEqual(r.winRateUp.value);
    expect(r.winRateUp.ci95[1]).toBeGreaterThanOrEqual(r.winRateUp.value);
    expect(r.winRateUp.n).toBe(2000);
  });

  it("mais simulações → IC mais estreito", () => {
    const few = runMonteCarlo(seededWalk(200, 5), { assetType: "crypto", timeframe: "1h", simulations: 200 });
    const many = runMonteCarlo(seededWalk(200, 5), { assetType: "crypto", timeframe: "1h", simulations: 8000 });
    const wFew = few.winRateUp.ci95[1] - few.winRateUp.ci95[0];
    const wMany = many.winRateUp.ci95[1] - many.winRateUp.ci95[0];
    expect(wMany).toBeLessThan(wFew);
  });

  it("volatilidade anualizada difere por mercado (calendário)", () => {
    const crypto = runMonteCarlo(seededWalk(200, 8), { assetType: "crypto", timeframe: "1h" });
    const stocks = runMonteCarlo(seededWalk(200, 8), { assetType: "stocks", timeframe: "1h" });
    // mesmo sigma/passo, mas periodsPerYear diferente → anualização diferente
    expect(crypto.volatilityAnnualized).not.toBeCloseTo(stocks.volatilityAnnualized, 5);
  });
});

describe("first-passage", () => {
  function levels(candles: ReturnType<typeof seededWalk>, side: "buy" | "sell", atr = 2): BarrierLevels {
    const entry = candles[candles.length - 1]!.close;
    const dir = side === "buy" ? 1 : -1;
    return {
      side,
      entry,
      stopLoss: entry - dir * atr * 1.2,
      tp1: entry + dir * atr * 1.8,
      tp2: entry + dir * atr * 3.0,
      tp3: entry + dir * atr * 4.5,
    };
  }

  it("probabilidade é monótona: TP1 ≥ TP2 ≥ TP3", () => {
    const candles = seededWalk(200, 11);
    const fp = firstPassageOutcomes(candles, levels(candles, "buy"), { simulations: 4000 });
    expect(fp.tp1.value).toBeGreaterThanOrEqual(fp.tp2.value);
    expect(fp.tp2.value).toBeGreaterThanOrEqual(fp.tp3.value);
  });

  it("TP inalcançável (muito longe) tem probabilidade ~0", () => {
    const candles = constantCandles(120, 100, 1);
    const entry = 100;
    const far: BarrierLevels = { side: "buy", entry, stopLoss: entry - 1, tp1: entry + 1000, tp2: entry + 2000, tp3: entry + 3000 };
    const fp = firstPassageOutcomes(candles, far, { simulations: 2000 });
    expect(fp.tp1.value).toBeLessThan(0.05);
  });

  it("todas as probabilidades em [0,1] com IC", () => {
    const candles = seededWalk(200, 13);
    const fp = firstPassageOutcomes(candles, levels(candles, "sell"), { simulations: 2000 });
    for (const e of [fp.tp1, fp.tp2, fp.tp3, fp.stop]) {
      expect(e.value).toBeGreaterThanOrEqual(0);
      expect(e.value).toBeLessThanOrEqual(1);
      expect(e.ci95[0]).toBeLessThanOrEqual(e.value);
      expect(e.ci95[1]).toBeGreaterThanOrEqual(e.value);
    }
  });
});
