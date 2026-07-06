import { describe, it, expect } from "vitest";
import { resolveOutcome, resolveLifecycle, aggregateTrackRecord, type SignalPlan } from "../src/track-record";
import type { Candle } from "@tradeai/shared";

function c(high: number, low: number, close = (high + low) / 2): Candle {
  return { time: 0, open: close, high, low, close, volume: 0 };
}

/** Candle com OPEN explícito (p/ cenários de gap). */
function g(open: number, high: number, low: number, close = (high + low) / 2): Candle {
  return { time: 0, open, high, low, close, volume: 0 };
}

const BUY: SignalPlan = { side: "buy", entry: 100, stopLoss: 95, takeProfit1: 110, takeProfit2: 120, takeProfit3: 130 };
const SELL: SignalPlan = { side: "sell", entry: 100, stopLoss: 105, takeProfit1: 90, takeProfit2: 80, takeProfit3: 70 };

describe("resolveOutcome", () => {
  it("compra atinge TP1 → pnlR = +2 (risco 5, ganho 10)", () => {
    const r = resolveOutcome(BUY, [c(105, 101), c(111, 108)], 50);
    expect(r.status).toBe("resolved");
    expect(r.outcome).toBe("TP1");
    expect(r.pnlR).toBeCloseTo(2, 5);
    expect(r.exitIndex).toBe(1);
  });

  it("compra bate o stop → SL, pnlR = -1", () => {
    const r = resolveOutcome(BUY, [c(102, 94)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.pnlR).toBeCloseTo(-1, 5);
  });

  it("stop tem prioridade sobre alvo no mesmo candle (conservador)", () => {
    // candle toca SL (94) e TP1 (110) no mesmo período → SL vence
    const r = resolveOutcome(BUY, [c(115, 94)], 50);
    expect(r.outcome).toBe("SL");
  });

  it("compra atinge TP3 quando o candle estoura tudo (sem tocar stop)", () => {
    const r = resolveOutcome(BUY, [c(135, 101)], 50);
    expect(r.outcome).toBe("TP3");
    expect(r.pnlR).toBeCloseTo(6, 5);
  });

  it("venda atinge TP1 (espelhado)", () => {
    const r = resolveOutcome(SELL, [c(99, 89)], 50);
    expect(r.outcome).toBe("TP1");
    expect(r.pnlR).toBeCloseTo(2, 5);
  });

  it("fica ABERTO enquanto não toca nada e não atingiu maxDuration", () => {
    const r = resolveOutcome(BUY, [c(105, 101), c(106, 102)], 50);
    expect(r.status).toBe("open");
    expect(r.outcome).toBeNull();
    expect(r.pnlR).toBeNull();
  });

  it("EXPIRA (marca-a-mercado) ao atingir maxDuration sem tocar nível", () => {
    const candles = Array.from({ length: 10 }, () => c(105, 101, 103));
    const r = resolveOutcome(BUY, candles, 10);
    expect(r.status).toBe("resolved");
    expect(r.outcome).toBe("EXPIRED");
    expect(r.pnlR).toBeCloseTo((103 - 100) / 5, 5);
  });

  it("risco zero → aberto (inválido, não resolve)", () => {
    const bad: SignalPlan = { ...BUY, stopLoss: 100 };
    expect(resolveOutcome(bad, [c(120, 90)], 50).status).toBe("open");
  });

  it("gap ABAIXO do stop em compra → sai no OPEN, perda > 1R (fill realista)", () => {
    // stop 95, candle abre em 92 (gap de fim de semana) → exit 92, pnlR -1.6
    const r = resolveOutcome(BUY, [g(92, 93, 90)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.exitPrice).toBe(92);
    expect(r.pnlR).toBeCloseTo((92 - 100) / 5, 5); // -1.6
  });

  it("gap ACIMA do stop em venda → sai no OPEN (espelhado)", () => {
    // stop 105, candle abre em 108 → exit 108, pnlR -1.6
    const r = resolveOutcome(SELL, [g(108, 110, 107)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.exitPrice).toBe(108);
    expect(r.pnlR).toBeCloseTo((100 - 108) / 5, 5);
  });

  it("gap ALÉM do TP paga o preço do TP, não o open (sem crédito de gap)", () => {
    // candle abre em 135 (acima do TP3=130) → exit 130, pnlR +6 (não +7)
    const r = resolveOutcome(BUY, [g(135, 140, 132)], 50);
    expect(r.outcome).toBe("TP3");
    expect(r.exitPrice).toBe(130);
    expect(r.pnlR).toBeCloseTo(6, 5);
  });

  it("toque normal do stop (sem gap) continua saindo no preço do stop", () => {
    const r = resolveOutcome(BUY, [g(98, 99, 94, 96)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.exitPrice).toBe(95);
    expect(r.pnlR).toBeCloseTo(-1, 5);
  });
});

describe("resolveLifecycle (multi-TP + breakeven automático)", () => {
  it("stop antes do TP1 → SL, pnlR -1", () => {
    const r = resolveLifecycle(BUY, [c(102, 94)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.pnlR).toBeCloseTo(-1, 4);
    expect(r.stopStage).toBe("initial");
  });

  it("TP1 e volta ao breakeven → outcome TP1, realiza 1/3 (R1/3) e 2/3 a zero", () => {
    const r = resolveLifecycle(BUY, [c(111, 108), c(105, 99)], 50);
    expect(r.outcome).toBe("TP1");
    expect(r.tp1Hit).toBe(true);
    expect(r.pnlR).toBeCloseTo((1 / 3) * 2, 4); // 0.6667
  });

  it("TP1 → TP2 → recua ao stop em TP1 → outcome TP2", () => {
    const r = resolveLifecycle(BUY, [c(111, 108), c(121, 109), c(112, 108)], 50);
    expect(r.outcome).toBe("TP2");
    expect(r.stopStage).toBe("tp1");
    expect(r.pnlR).toBeCloseTo((2 + 4 + 2) / 3, 4); // 2.6667
  });

  it("um candle estoura tudo até o TP3 → outcome TP3, pnlR média dos 3 R", () => {
    const r = resolveLifecycle(BUY, [c(135, 101)], 50);
    expect(r.outcome).toBe("TP3");
    expect(r.tp1Hit && r.tp2Hit && r.tp3Hit).toBe(true);
    expect(r.pnlR).toBeCloseTo((2 + 4 + 6) / 3, 4); // 4
  });

  it("ABERTO após TP1 (ainda correndo, stop no breakeven)", () => {
    const r = resolveLifecycle(BUY, [c(111, 108), c(112, 105)], 50);
    expect(r.status).toBe("open");
    expect(r.tp1Hit).toBe(true);
    expect(r.stopStage).toBe("breakeven");
    expect(r.pnlR).toBeNull();
  });

  it("EXPIRA após TP1 → realiza 1/3 + marca-a-mercado o restante", () => {
    const candles = [c(111, 108, 109), ...Array.from({ length: 9 }, () => c(106, 103, 105))];
    const r = resolveLifecycle(BUY, candles, 10);
    expect(r.outcome).toBe("EXPIRED");
    expect(r.pnlR).toBeCloseTo((1 / 3) * 2 + (2 / 3) * 1, 4); // 1.3333
  });

  it("venda: TP1 e volta ao breakeven (espelhado)", () => {
    const r = resolveLifecycle(SELL, [c(99, 89), c(101, 98)], 50);
    expect(r.outcome).toBe("TP1");
    expect(r.pnlR).toBeCloseTo((1 / 3) * 2, 4);
  });

  it("gap através do stop INICIAL → SL no open (perda maior que 1R)", () => {
    const r = resolveLifecycle(BUY, [g(92, 93, 90)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.exitPrice).toBe(92);
    expect(r.pnlR).toBeCloseTo((92 - 100) / 5, 4); // -1.6
  });

  it("gap através do stop TRAILADO (breakeven após TP1) → sai no open do gap", () => {
    // TP1 (110) bate → stop sobe pro entry (100); candle seguinte abre em 97.
    const r = resolveLifecycle(BUY, [c(111, 108), g(97, 98, 96)], 50);
    expect(r.outcome).toBe("TP1");
    expect(r.exitPrice).toBe(97);
    // 1/3 travado no TP1 (+2R) + 2/3 saindo a 97 (-0.6R cada)
    expect(r.pnlR).toBeCloseTo((1 / 3) * 2 + (2 / 3) * ((97 - 100) / 5), 4);
  });

  it("venda: gap através do stop inicial → SL no open (espelhado)", () => {
    const r = resolveLifecycle(SELL, [g(108, 110, 107)], 50);
    expect(r.outcome).toBe("SL");
    expect(r.exitPrice).toBe(108);
    expect(r.pnlR).toBeCloseTo((100 - 108) / 5, 4);
  });
});

describe("aggregateTrackRecord", () => {
  it("agrega win rate / PF / R médio com IC e n", () => {
    const recs = [
      { outcome: "TP1" as const, pnlR: 2 },
      { outcome: "TP2" as const, pnlR: 4 },
      { outcome: "SL" as const, pnlR: -1 },
      { outcome: "SL" as const, pnlR: -1 },
      { outcome: "EXPIRED" as const, pnlR: 0.3 },
    ];
    const s = aggregateTrackRecord(recs);
    expect(s.n).toBe(5);
    expect(s.decisive).toBe(4); // 2 wins + 2 SL (EXPIRED não é decisivo)
    expect(s.winRate.value).toBeCloseTo(0.5, 5); // 2/4
    expect(s.winRate.n).toBe(4);
    expect(s.outcomes.TP1).toBe(1);
    expect(s.totalR).toBeCloseTo(4.3, 5);
    expect(s.profitFactor.value).toBeGreaterThan(1); // ganhos 6.3 / perdas 2
  });

  it("amostra vazia não quebra", () => {
    const s = aggregateTrackRecord([]);
    expect(s.n).toBe(0);
    expect(s.decisive).toBe(0);
  });
});
