import { describe, expect, it } from "vitest";
import { combineTimeframes, getHigherTimeframes, toTimeframeAnalysis, type TimeframeAnalysis } from "../src/multi-timeframe";
import { runAnalysis } from "../src/analysis/run";
import type { SignalDirection } from "@tradeai/shared";
import type { Timeframe } from "@tradeai/shared";
import { seededWalk } from "./fixtures/candles";

function tf(timeframe: Timeframe, signal: SignalDirection): TimeframeAnalysis {
  const side = signal.includes("BUY") ? "buy" : signal.includes("SELL") ? "sell" : "neutral";
  return { timeframe, signal, strength: 70, confluence: 7, side, trendDirection: "neutral", bias: "neutral" };
}

describe("getHigherTimeframes", () => {
  it("escada de timeframes", () => {
    expect(getHigherTimeframes("1h")).toEqual({ higher: "4h", highest: "1d" });
    expect(getHigherTimeframes("1d")).toEqual({ higher: "1w", highest: "1M" });
    expect(getHigherTimeframes("1M")).toEqual({ higher: null, highest: null });
  });
});

describe("combineTimeframes", () => {
  it("alinhamento total → score alto, fully_aligned", () => {
    const r = combineTimeframes(tf("1h", "BUY"), tf("4h", "STRONG_BUY"), tf("1d", "BUY"));
    expect(r.confluenceScore).toBeGreaterThanOrEqual(90);
    expect(r.alignment).toBe("fully_aligned");
  });

  it("ambos os superiores contra → divergente, score baixo", () => {
    const r = combineTimeframes(tf("1h", "BUY"), tf("4h", "SELL"), tf("1d", "STRONG_SELL"));
    expect(r.alignment).toBe("divergent");
    expect(r.confluenceScore).toBeLessThan(60);
  });

  it("current neutro → score informativo 50", () => {
    const r = combineTimeframes(tf("1h", "NEUTRAL"), tf("4h", "BUY"), tf("1d", "SELL"));
    expect(r.confluenceScore).toBe(50);
  });

  it("um superior a favor, outro neutro → alinhamento parcial", () => {
    const r = combineTimeframes(tf("1h", "BUY"), tf("4h", "BUY"), tf("1d", "NEUTRAL"));
    expect(r.alignment === "partially_aligned" || r.alignment === "fully_aligned").toBe(true);
    expect(r.summary).toContain("score");
  });

  it("é determinístico", () => {
    const a = combineTimeframes(tf("1h", "BUY"), tf("4h", "SELL"), null);
    const b = combineTimeframes(tf("1h", "BUY"), tf("4h", "SELL"), null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("toTimeframeAnalysis", () => {
  it("extrai do AnalysisResult", () => {
    const candles = seededWalk(250, 5);
    const result = runAnalysis({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", candles });
    const a = toTimeframeAnalysis(result, "bullish");
    expect(a.timeframe).toBe("4h");
    expect(a.signal).toBe(result.signal.signal);
    expect(a.bias).toBe("bullish");
    expect(["up", "down", "neutral"]).toContain(a.trendDirection);
  });
});
