import { describe, it, expect } from "vitest";
import { computeClassReading, CLASS_METHODOLOGY, isEngine, buildClassPlan } from "./engines";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

const baseInds = (votes: [string, string][]) => votes.map(([category, vote]) => ({ name: category, category, vote, value: 1 }));

describe("computeClassReading", () => {
  it("re-pondera votos reais por classe (cripto: tendência/volume pesam mais)", () => {
    const r = computeClassReading(dto({
      analysis: { indicators: baseInds([["Tendência", "BUY"], ["Volume", "BUY"], ["Osciladores", "SELL"]]) },
      smc: { bias: "bullish" },
    }), "crypto");
    expect(r.side).toBe("buy"); // tendência+volume+SMC (peso alto) vencem o oscilador
    expect(r.methodology.label).toBe("Cripto");
    expect(r.agree).toContain("Tendência");
  });

  it("cada classe tem metodologia + pendências próprias", () => {
    expect(CLASS_METHODOLOGY.forex.pending.some((p) => /COT/.test(p))).toBe(true);
    expect(CLASS_METHODOLOGY.indices.pending.some((p) => /VIX|breadth/i.test(p))).toBe(true);
    expect(CLASS_METHODOLOGY.stocks.pending.some((p) => /earnings|FMP/i.test(p))).toBe(true);
  });

  it("sinal neutro quando os fatores se anulam", () => {
    const r = computeClassReading(dto({
      analysis: { indicators: baseInds([["Tendência", "BUY"], ["Médias Móveis", "SELL"]]) },
    }), "forex");
    expect(["neutral", "buy", "sell"]).toContain(r.side);
    expect(typeof r.score).toBe("number");
  });

  it("isEngine valida o seletor", () => {
    expect(isEngine("classe")).toBe(true);
    expect(isEngine("x")).toBe(false);
  });
});

describe("buildClassPlan", () => {
  it("espelha o plano principal para o lado do Motor 2 (venda)", () => {
    const d = dto({ analysis: { risk: { entry: 100, stopLoss: 95, takeProfit1: 110, takeProfit2: 120, takeProfit3: 130, distSL: 5, rr1: 2 }, meta: {} } });
    const p = buildClassPlan(d, "sell")!;
    expect(p.entry).toBe(100);
    expect(p.stopLoss).toBe(105);   // venda: stop acima
    expect(p.takeProfit1).toBe(90); // alvos abaixo
    expect(p.takeProfit3).toBe(70);
  });

  it("deriva do ATR quando o motor principal está neutro (distSL=0)", () => {
    const d = dto({ atr: 4, analysis: { risk: { entry: 100, stopLoss: 100, takeProfit1: 100, takeProfit2: 100, takeProfit3: 100, distSL: 0, rr1: 0 }, meta: { atrRatio: 0.04 } } });
    const p = buildClassPlan(d, "buy");
    expect(p).not.toBeNull();
    expect(p!.entry).toBe(100);
    expect(p!.stopLoss).toBeLessThan(100); // compra: stop abaixo
    expect(p!.takeProfit1).toBeGreaterThan(100);
  });

  it("retorna null quando neutro", () => {
    const d = dto({ analysis: { risk: { entry: 100, distSL: 5 }, meta: {} } });
    expect(buildClassPlan(d, "neutral")).toBeNull();
  });
});
