import { describe, it, expect } from "vitest";
import { buildTradeGuard } from "./trade-guard";
import type { FullAnalysis } from "./full";

/** DTO mínimo "operável/verde" — cada teste clona e altera só o que precisa. */
function base(): FullAnalysis {
  return {
    generatedAt: 1,
    type: "complete",
    period: "jan/24–jun/26",
    analysis: {
      signal: { signal: "BUY", strength: 80, confluence: 8, votes: { buy: 8, neutral: 2, sell: 0 } },
      risk: { entry: 100, stopLoss: 95, takeProfit1: 110, takeProfit2: 120, takeProfit3: 130, distSL: 5, rr1: 2 },
      explanation: { summary: "" },
      indicators: [],
      meta: { regime: "trending", adxValue: 30 },
    },
    quality: { status: "green", reason: "ok" },
    backtest: {
      sampleSufficient: true,
      avgR: { value: 0.2, ci95: [0.05, 0.4], n: 120 },
      winRate: { value: 0.55, ci95: [0.5, 0.6], n: 120 },
      profitFactor: { value: 1.8, ci95: [1.5, 2.1], n: 120 },
    },
    scenarios: {
      recommended: "buy",
      edge: 0.2,
      buy: { side: "buy", expectedR: 0.4, stopProbability: { value: 0.3, ci95: [0.2, 0.4] }, tp1: { probability: { value: 0.55, ci95: [0.5, 0.6] } } },
      sell: { side: "sell", expectedR: -0.1, stopProbability: { value: 0.5, ci95: [0.4, 0.6] }, tp1: { probability: { value: 0.3, ci95: [0.25, 0.35] } } },
    },
    seasonality: {
      currentMonthStats: { month: 6, avgReturn: { value: 2, ci95: [0.5, 3.5], n: 8 }, winRate: { value: 0.7, ci95: [0.4, 0.9], n: 8 }, sampleSize: 8, sufficient: true },
      monthly: [],
      currentMonth: 6,
      yearsAnalyzed: 8,
      minSampleSize: 5,
      summary: "",
    },
    multiTimeframe: { alignment: "fully_aligned", confluenceScore: 90, current: null, higher: null, highest: null, summary: "" },
  } as unknown as FullAnalysis;
}

describe("buildTradeGuard", () => {
  it("cenário verde/operável: opera, sem blocks, com prós", () => {
    const g = buildTradeGuard(base());
    expect(g.operate).toBe(true);
    expect(g.reasons.some((r) => r.severity === "block")).toBe(false);
    expect(g.pros.length).toBeGreaterThan(0);
    expect(g.tone).toBe("green");
  });

  it("sinal neutro → block e não opera", () => {
    const d = base();
    d.analysis.signal.signal = "NEUTRAL";
    const g = buildTradeGuard(d);
    expect(g.operate).toBe(false);
    expect(g.headline).toBe("Por que NÃO operar agora");
    expect(g.reasons[0]?.title).toBe("Sinal neutro");
  });

  it("selo cinza (amostra insuficiente) → block", () => {
    const d = base();
    d.quality = { status: "grey", reason: "Amostra insuficiente (10 trades; mínimo 30)." } as FullAnalysis["quality"];
    const g = buildTradeGuard(d);
    expect(g.operate).toBe(false);
    expect(g.tone).toBe("grey");
    expect(g.reasons.some((r) => r.severity === "block" && r.title === "Amostra insuficiente")).toBe(true);
  });

  it("selo vermelho → block", () => {
    const d = base();
    d.quality = { status: "red", reason: "Fraco." } as FullAnalysis["quality"];
    const g = buildTradeGuard(d);
    expect(g.operate).toBe(false);
    expect(g.tone).toBe("red");
  });

  it("selo amarelo → caution (ainda opera se o resto estiver ok)", () => {
    const d = base();
    d.quality = { status: "yellow", reason: "Out-of-sample enfraquece." } as FullAnalysis["quality"];
    const g = buildTradeGuard(d);
    expect(g.operate).toBe(true);
    expect(g.reasons.some((r) => r.severity === "caution" && r.title === "Selo com ressalva")).toBe(true);
  });

  it("R médio negativo (amostra suficiente) → block de expectativa negativa", () => {
    const d = base();
    d.backtest!.avgR = { value: -0.12, ci95: [-0.3, 0.05], n: 120 };
    const g = buildTradeGuard(d);
    expect(g.operate).toBe(false);
    expect(g.reasons.some((r) => r.title === "Expectativa negativa")).toBe(true);
  });

  it("R:R < 1 → caution", () => {
    const d = base();
    d.analysis.risk.rr1 = 0.8;
    const g = buildTradeGuard(d);
    expect(g.reasons.some((r) => r.title === "Risco/retorno baixo")).toBe(true);
  });

  it("stop mais provável que o TP1 → caution", () => {
    const d = base();
    d.scenarios!.buy.stopProbability.value = 0.6;
    d.scenarios!.buy.tp1.probability.value = 0.4;
    const g = buildTradeGuard(d);
    expect(g.reasons.some((r) => r.title === "Stop mais provável que o alvo")).toBe(true);
  });

  it("sazonalidade do mês contra a compra → caution", () => {
    const d = base();
    d.seasonality!.currentMonthStats!.avgReturn = { value: -3, ci95: [-6, -1], n: 9 };
    const g = buildTradeGuard(d);
    expect(g.reasons.some((r) => r.title === "Sazonalidade desfavorável")).toBe(true);
  });

  it("timeframes divergentes → caution", () => {
    const d = base();
    d.multiTimeframe!.alignment = "divergent";
    const g = buildTradeGuard(d);
    expect(g.reasons.some((r) => r.title === "Timeframes divergentes")).toBe(true);
  });
});
