import { describe, it, expect } from "vitest";
import { computeSetupScore } from "./setup-score";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

describe("computeSetupScore", () => {
  it("alta confiança quando tudo confirma a compra + selo verde", () => {
    const s = computeSetupScore(dto({
      analysis: { signal: { signal: "BUY", strength: 70, votes: { buy: 8, sell: 1, neutral: 1 } }, gates: [{ passed: true }, { passed: true }, { passed: true }] },
      smc: { bias: "bullish" },
      wegd: { wyckoff: { phase: "accumulation" } },
      montecarlo: { winRateUp: { value: 0.62 } },
      multiTimeframe: { confluenceScore: 80 },
      quality: { status: "green" },
    }));
    expect(s.side).toBe("buy");
    expect(s.agree.length).toBeGreaterThan(s.against.length);
    expect(s.score).toBeGreaterThanOrEqual(72);
    expect(s.label).toBe("Alta confiança");
  });

  it("conflitante quando sistemas divergem do sinal", () => {
    const s = computeSetupScore(dto({
      analysis: { signal: { signal: "BUY", strength: 52, votes: { buy: 4, sell: 5, neutral: 1 } }, gates: [{ passed: false }] },
      smc: { bias: "bearish" },
      wegd: { wyckoff: { phase: "distribution" } },
      montecarlo: { winRateUp: { value: 0.4 } },
      quality: { status: "red" },
    }));
    expect(s.against.length).toBeGreaterThan(s.agree.length);
    expect(s.label).toMatch(/Conflitante/);
  });

  it("neutro → aguardar", () => {
    const s = computeSetupScore(dto({ analysis: { signal: { signal: "NEUTRAL", strength: 50, votes: { buy: 3, sell: 3, neutral: 4 } } } }));
    expect(s.side).toBe("neutral");
    expect(s.label).toMatch(/aguardar/);
  });
});
