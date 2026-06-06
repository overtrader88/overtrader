import { describe, it, expect } from "vitest";
import { fmtIndicatorValue } from "./format-indicator";

describe("fmtIndicatorValue", () => {
  it("formata número simples", () => {
    expect(fmtIndicatorValue(91.64)).toBe("91.64");   // 1–999: 2 casas
    expect(fmtIndicatorValue(0.012345)).toBe("0.0123"); // <1: 3 sig
    expect(fmtIndicatorValue(4330.16)).toBe("4.330");   // ≥1000: milhar pt-BR, 0 casas
  });

  it("valor composto → 1º número relevante", () => {
    expect(fmtIndicatorValue({ macdLine: -43.39, signal: -37.29, histogram: -6.09 })).toBe("-43.39");
  });

  // REGRESSÃO: VWMA em ativo sem volume (forex/commodities/índices) vem null e
  // antes quebrava a página ao vivo com "Cannot convert undefined or null to object".
  it("não quebra com value null/undefined/NaN", () => {
    expect(fmtIndicatorValue(null)).toBe("—");
    expect(fmtIndicatorValue(undefined)).toBe("—");
    expect(fmtIndicatorValue(NaN)).toBe("—");
    expect(fmtIndicatorValue({})).toBe("·");
  });
});
