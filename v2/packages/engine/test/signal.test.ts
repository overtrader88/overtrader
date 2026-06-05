import { describe, expect, it } from "vitest";
import { ratioToSignal } from "../src/signal/levels";
import { computeSignal } from "../src/signal/aggregate";
import { buildIndicatorResults } from "../src/signal/votes";
import { computeIndicatorValues } from "../src/indicators";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import { signalSide } from "@tradeai/shared";
import { upTrendCandles, downTrendCandles } from "./fixtures/candles";

describe("ratioToSignal — fronteiras", () => {
  it("mapeia os extremos e o centro", () => {
    expect(ratioToSignal(0.1)).toBe("STRONG_SELL");
    expect(ratioToSignal(0.3)).toBe("SELL");
    expect(ratioToSignal(0.4)).toBe("WEAK_SELL");
    expect(ratioToSignal(0.5)).toBe("NEUTRAL");
    expect(ratioToSignal(0.6)).toBe("WEAK_BUY");
    expect(ratioToSignal(0.75)).toBe("BUY");
    expect(ratioToSignal(0.95)).toBe("STRONG_BUY");
  });

  it("é monótono: ratio maior nunca dá sinal mais vendedor", () => {
    const order = ["STRONG_SELL", "SELL", "WEAK_SELL", "NEUTRAL", "WEAK_BUY", "BUY", "STRONG_BUY"];
    let prev = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const idx = order.indexOf(ratioToSignal(Math.min(1, r)));
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});

describe("computeSignal — através do caminho real", () => {
  it("uptrend forte vota majoritariamente COMPRA", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(upTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.votes.buy).toBeGreaterThan(sig.votes.sell);
    expect(signalSide(sig.signal)).toBe("buy");
  });

  it("downtrend forte vota majoritariamente VENDA", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(downTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.votes.sell).toBeGreaterThan(sig.votes.buy);
    expect(signalSide(sig.signal)).toBe("sell");
  });

  it("força fica em 0..100 e confluência em 0..10", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(upTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.strength).toBeGreaterThanOrEqual(0);
    expect(sig.strength).toBeLessThanOrEqual(100);
    expect(sig.confluence).toBeGreaterThanOrEqual(0);
    expect(sig.confluence).toBeLessThanOrEqual(10);
  });
});
