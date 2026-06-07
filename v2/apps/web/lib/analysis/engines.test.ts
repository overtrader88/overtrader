import { describe, it, expect } from "vitest";
import { computeClassReading, CLASS_METHODOLOGY, isEngine } from "./engines";
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
