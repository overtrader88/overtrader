import { describe, it, expect } from "vitest";
import { computeHeat, replayBank, RISK_NORMAL, RISK_STRONG } from "./survival";

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
