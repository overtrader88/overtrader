import { describe, expect, it } from "vitest";
import { computeConditionalSignal } from "../src/signal/conditional";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import { signalSide } from "@tradeai/shared";
import type { IndicatorValues } from "../src/indicators";

function mk(over: Partial<IndicatorValues> = {}): IndicatorValues {
  return {
    lastClose: 100,
    ema20: 100, ema50: 100, ema200: 100, sma50: 100, vwma20: 100,
    rsi14: 50,
    macd: { macdLine: 0, signal: 0, histogram: 0 },
    stoch: { k: 50, d: 50 },
    cci20: 0, williamsR14: -50, awesome: 0, mfi14: 50, roc14: 0,
    adx14: { adx: 30, plusDI: 25, minusDI: 25 },
    supertrend: { value: 100, trend: "up" },
    trix14: 0,
    bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 },
    atr14: 2,
    obv: { current: 0, slope: 0 },
    cmf20: 0,
    ...over,
  };
}

describe("computeConditionalSignal", () => {
  it("trending + alta alinhada → compra (trend-following)", () => {
    const v = mk({ lastClose: 110, ema20: 105, ema50: 103, ema200: 100, adx14: { adx: 35, plusDI: 30, minusDI: 15 }, macd: { macdLine: 1, signal: 0.5, histogram: 0.5 } });
    const s = computeConditionalSignal(v, "trending", DEFAULT_ENGINE_CONFIG);
    expect(signalSide(s.signal)).toBe("buy");
    expect(s.strength).toBeGreaterThan(0);
  });

  it("trending + baixa alinhada → venda", () => {
    const v = mk({ lastClose: 90, ema20: 95, ema50: 97, ema200: 100, adx14: { adx: 35, plusDI: 15, minusDI: 30 }, macd: { macdLine: -1, signal: -0.5, histogram: -0.5 } });
    expect(signalSide(computeConditionalSignal(v, "trending", DEFAULT_ENGINE_CONFIG).signal)).toBe("sell");
  });

  it("ranging + sobrevendido → compra (fade)", () => {
    const v = mk({ lastClose: 94, rsi14: 28, williamsR14: -85, stoch: { k: 12, d: 15 }, bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 } });
    expect(signalSide(computeConditionalSignal(v, "ranging", DEFAULT_ENGINE_CONFIG).signal)).toBe("buy");
  });

  it("ranging + sobrecomprado → venda (fade)", () => {
    const v = mk({ lastClose: 106, rsi14: 72, williamsR14: -10, stoch: { k: 88, d: 85 }, bollinger: { upper: 105, middle: 100, lower: 95, bandwidth: 0.1 } });
    expect(signalSide(computeConditionalSignal(v, "ranging", DEFAULT_ENGINE_CONFIG).signal)).toBe("sell");
  });

  it("transitional/explosive → NEUTRO", () => {
    expect(computeConditionalSignal(mk(), "transitional", DEFAULT_ENGINE_CONFIG).signal).toBe("NEUTRAL");
    expect(computeConditionalSignal(mk(), "explosive", DEFAULT_ENGINE_CONFIG).signal).toBe("NEUTRAL");
  });

  it("ranging sem extremo → NEUTRO (só opera nos extremos)", () => {
    expect(computeConditionalSignal(mk(), "ranging", DEFAULT_ENGINE_CONFIG).signal).toBe("NEUTRAL");
  });

  it("filtro macroAlign bloqueia compra de fundo abaixo da EMA200", () => {
    const v = mk({ lastClose: 94, ema200: 110, rsi14: 28, williamsR14: -85, stoch: { k: 12, d: 15 } });
    expect(signalSide(computeConditionalSignal(v, "ranging", DEFAULT_ENGINE_CONFIG).signal)).toBe("buy"); // sem filtro
    const cfg = structuredClone(DEFAULT_ENGINE_CONFIG);
    cfg.signal.filters.macroAlign = true;
    expect(computeConditionalSignal(v, "ranging", cfg).signal).toBe("NEUTRAL"); // com filtro
  });

  it("filtro volumeConfirm bloqueia compra com OBV caindo", () => {
    const base = { lastClose: 94, ema200: 90, rsi14: 28, williamsR14: -85, stoch: { k: 12, d: 15 } };
    const cfg = structuredClone(DEFAULT_ENGINE_CONFIG);
    cfg.signal.filters.volumeConfirm = true;
    expect(computeConditionalSignal(mk({ ...base, obv: { current: 0, slope: -5 } }), "ranging", cfg).signal).toBe("NEUTRAL");
    expect(signalSide(computeConditionalSignal(mk({ ...base, obv: { current: 0, slope: 5 } }), "ranging", cfg).signal)).toBe("buy");
  });
});
