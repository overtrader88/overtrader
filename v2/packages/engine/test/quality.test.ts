import { describe, expect, it } from "vitest";
import { computeQualityBanner } from "../src/quality";
import type { BacktestSummary } from "../src/backtest";
import type { Estimate } from "../src/types";

function est(value: number, lo: number, hi: number, n: number): Estimate {
  return { value, ci95: [lo, hi], n };
}

function summary(over: Partial<BacktestSummary>): BacktestSummary {
  return {
    strategy: "exit-tp1",
    totalTrades: 100,
    decisiveTrades: 100,
    minDecisiveTrades: 30,
    winRate: est(0.6, 0.52, 0.68, 100),
    profitFactor: est(2.0, 1.6, 2.5, 100),
    avgR: est(0.4, 0.2, 0.6, 100),
    maxDrawdownR: 3,
    outcomes: { TP1: 60, TP2: 0, TP3: 0, BE: 0, SL: 40, EXPIRED: 0 },
    tp1TouchRate: 0.6,
    byRegime: {},
    outOfSample: null,
    trades: [],
    candlesAvailable: 9000,
    candlesScanned: 8000,
    targetCandles: 8760,
    truncated: true,
    sampleSufficient: true,
    ...over,
  };
}

describe("computeQualityBanner — honesto", () => {
  it("verde só quando o LIMITE INFERIOR do IC supera o limiar", () => {
    const b = computeQualityBanner(summary({}));
    expect(b.status).toBe("green");
  });

  it("amostra insuficiente nunca acende verde (grey)", () => {
    const b = computeQualityBanner(summary({ sampleSufficient: false, decisiveTrades: 12 }));
    expect(b.status).toBe("grey");
  });

  it("in-sample bom mas out-of-sample colapsa → amarelo (overfitting)", () => {
    const b = computeQualityBanner(
      summary({
        outOfSample: { n: 30, winRate: est(0.32, 0.2, 0.45, 30), profitFactor: est(0.7, 0.4, 1.0, 30), avgR: est(-0.1, -0.3, 0.1, 30) },
      }),
    );
    expect(b.status).toBe("yellow");
  });

  it("ponto-estimativa alto mas IC largo → não fica verde (yellow)", () => {
    const b = computeQualityBanner(
      summary({
        profitFactor: est(2.0, 1.1, 4.0, 35), // PF médio bom, mas IC inferior < 1.5
        winRate: est(0.6, 0.45, 0.75, 35),
      }),
    );
    expect(b.status).toBe("yellow");
  });

  it("métricas fracas → vermelho", () => {
    const b = computeQualityBanner(
      summary({
        profitFactor: est(0.8, 0.5, 1.1, 80),
        winRate: est(0.35, 0.28, 0.43, 80),
        tp1TouchRate: 0.3,
      }),
    );
    expect(b.status).toBe("red");
  });
});
