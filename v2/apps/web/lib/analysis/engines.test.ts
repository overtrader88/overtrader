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

describe("buildClassPlan (independente do Motor 1, derivado do ATR)", () => {
  it("venda: stop acima e alvos abaixo do preço (orientação correta)", () => {
    const d = dto({ atr: 5, analysis: { risk: { entry: 100, distSL: 0 }, meta: {} } });
    const p = buildClassPlan(d, "sell")!;
    expect(p.entry).toBe(100);
    expect(p.stopLoss).toBeGreaterThan(100);
    expect(p.takeProfit1).toBeLessThan(100);
    expect(p.takeProfit3).toBeLessThan(p.takeProfit1);
    expect(p.rr1).toBeGreaterThan(0);
  });

  it("compra: stop abaixo e alvos acima — usa ATR mesmo SEM plano do Motor 1", () => {
    const d = dto({ atr: 4, analysis: { risk: { entry: 100, distSL: 0 }, meta: { atrRatio: 0.04 } } });
    const p = buildClassPlan(d, "buy")!;
    expect(p.stopLoss).toBeLessThan(100);
    expect(p.takeProfit1).toBeGreaterThan(100);
  });

  it("não usa as distâncias do Motor 1 (ignora distSL/TPs do plano principal)", () => {
    // Motor 1 com distSL gigante; o plano do Motor 2 deve seguir o ATR, não o Motor 1.
    const d = dto({ atr: 2, analysis: { risk: { entry: 100, stopLoss: 50, takeProfit1: 200, distSL: 50 }, meta: {} } });
    const p = buildClassPlan(d, "buy")!;
    expect(Math.abs(p.entry - p.stopLoss)).toBeLessThan(20); // ~ATR*mult, não 50
  });

  it("retorna null quando neutro ou sem ATR", () => {
    expect(buildClassPlan(dto({ atr: 5, analysis: { risk: { entry: 100 }, meta: {} } }), "neutral")).toBeNull();
    expect(buildClassPlan(dto({ analysis: { risk: { entry: 100, distSL: 0 }, meta: {} } }), "buy")).toBeNull();
  });
});
