import { describe, it, expect } from "vitest";
import { computeHeat, replayBank, fitnessBounds, RISK_NORMAL, RISK_STRONG, FITNESS_Z90, EVO_MIN_TRADES } from "./survival";

const iso = (h: number) => new Date(Date.UTC(2026, 6, 1, h)).toISOString();

describe("computeHeat (diagnóstico de exposição simultânea — achado 9, camada 1)", () => {
  it("sem posições → tudo zero", () => {
    const h = computeHeat([]);
    expect(h.maxConcurrentHeat).toBe(0);
    expect(h.currentHeat).toBe(0);
    expect(h.maxAt).toBeNull();
  });

  it("trades SEQUENCIAIS não somam heat (pico = 1 posição)", () => {
    const h = computeHeat([
      { emittedAt: iso(0), resolvedAt: iso(4), direction: "BUY" },
      { emittedAt: iso(4), resolvedAt: iso(8), direction: "SELL" },
    ]);
    expect(h.maxConcurrentHeat).toBeCloseTo(RISK_NORMAL, 10);
    expect(h.maxConcurrentPositions).toBe(1);
    expect(h.currentHeat).toBe(0);
  });

  it("posições sobrepostas somam frações (a doença que o replayBank não vê)", () => {
    const h = computeHeat([
      { emittedAt: iso(0), resolvedAt: iso(10), direction: "BUY" },
      { emittedAt: iso(1), resolvedAt: iso(9), direction: "BUY" },
      { emittedAt: iso(2), resolvedAt: iso(8), direction: "STRONG_BUY" },
    ]);
    expect(h.maxConcurrentHeat).toBeCloseTo(RISK_NORMAL * 2 + RISK_STRONG, 10);
    expect(h.maxConcurrentPositions).toBe(3);
    expect(h.maxAt).toBe(iso(2));
  });

  it("posições ainda ABERTAS contam no pico e no heat atual", () => {
    const h = computeHeat([
      { emittedAt: iso(0), resolvedAt: null, direction: "BUY" },
      { emittedAt: iso(1), resolvedAt: null, direction: "STRONG_SELL" },
    ]);
    expect(h.currentPositions).toBe(2);
    expect(h.currentHeat).toBeCloseTo(RISK_NORMAL + RISK_STRONG, 10);
    expect(h.maxConcurrentHeat).toBeCloseTo(RISK_NORMAL + RISK_STRONG, 10);
  });

  it("fechamento no MESMO instante da abertura seguinte não vira sobreposição", () => {
    const h = computeHeat([
      { emittedAt: iso(0), resolvedAt: iso(4), direction: "BUY" },
      { emittedAt: iso(4), resolvedAt: null, direction: "BUY" },
    ]);
    expect(h.maxConcurrentPositions).toBe(1);
    expect(h.maxConcurrentHeat).toBeCloseTo(RISK_NORMAL, 10);
  });

  it("datas inválidas são ignoradas sem lançar", () => {
    const h = computeHeat([
      { emittedAt: "not-a-date", resolvedAt: null, direction: "BUY" },
      { emittedAt: iso(0), resolvedAt: iso(2), direction: "BUY" },
    ]);
    expect(h.maxConcurrentPositions).toBe(1);
  });
});

describe("replayBank (regressão — a banca sequencial continua igual)", () => {
  it("ganho e perda aplicam a fração por direção", () => {
    const b = replayBank([
      { pnlR: 1, direction: "BUY" },
      { pnlR: -1, direction: "STRONG_SELL" },
    ]);
    expect(b.equity).toBeCloseTo(100 * (1 + RISK_NORMAL) * (1 - RISK_STRONG), 8);
    expect(b.deaths).toBe(0);
    expect(b.lastResults).toEqual(["G", "P"]);
  });
});

describe("fitness do replay (Darwin 2.0 — achado 25)", () => {
  it("resolved/meanR/stdR cobrem TODAS as vidas, incluindo EXPIRED (pnlR=0)", () => {
    const b = replayBank([
      { pnlR: 1.5, direction: "BUY" },
      { pnlR: -1, direction: "BUY" },
      { pnlR: 0, direction: "SELL" }, // EXPIRED conta no n e puxa a média pra baixo
      { pnlR: 0.5, direction: "BUY" },
    ]);
    expect(b.resolved).toBe(4);
    expect(b.meanR).toBeCloseTo((1.5 - 1 + 0 + 0.5) / 4, 10);
    // desvio-padrão AMOSTRAL (n−1)
    const mean = 0.25;
    const varAm = ((1.5 - mean) ** 2 + (-1 - mean) ** 2 + (0 - mean) ** 2 + (0.5 - mean) ** 2) / 3;
    expect(b.stdR).toBeCloseTo(Math.sqrt(varAm), 10);
  });

  it("sem trades → n=0, média 0, σ 0 e bounds null", () => {
    const b = replayBank([]);
    expect(b.resolved).toBe(0);
    expect(b.meanR).toBe(0);
    expect(b.stdR).toBe(0);
    expect(fitnessBounds(b)).toBeNull();
  });

  it("n=1 → σ=0 e bandas colapsam na média", () => {
    const b = replayBank([{ pnlR: -1, direction: "BUY" }]);
    expect(b.stdR).toBe(0);
    const f = fitnessBounds(b);
    expect(f).not.toBeNull();
    expect(f!.lb).toBeCloseTo(-1, 10);
    expect(f!.ub).toBeCloseTo(-1, 10);
  });

  it("bounds = média ± z·σ/√n (z=1.28 fixado a priori)", () => {
    const trades = Array.from({ length: EVO_MIN_TRADES }, (_, i) => ({ pnlR: i % 2 === 0 ? -1 : 0.5, direction: "BUY" }));
    const b = replayBank(trades);
    const f = fitnessBounds(b)!;
    const se = b.stdR / Math.sqrt(b.resolved);
    expect(f.ub).toBeCloseTo(b.meanR + FITNESS_Z90 * se, 10);
    expect(f.lb).toBeCloseTo(b.meanR - FITNESS_Z90 * se, 10);
    // núcleo claramente perdedor (média −0.25R): teto da banda negativo com n=20 ⇒ morreria
    expect(b.meanR).toBeLessThan(0);
    expect(f.ub).toBeLessThan(0);
  });

  it("os trades da morte NÃO somem do fitness (resolved atravessa as vidas)", () => {
    // 22 STRONG de −1R: a banca quebra no caminho (0.9^11 ≈ 31), reencarna e segue
    const b = replayBank(Array.from({ length: 22 }, () => ({ pnlR: -1, direction: "STRONG_BUY" })));
    expect(b.deaths).toBeGreaterThan(0);
    expect(b.resolved).toBe(22);
    expect(b.meanR).toBeCloseTo(-1, 10);
    expect(fitnessBounds(b)!.ub).toBeLessThan(0);
  });
});
