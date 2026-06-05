import { describe, expect, it } from "vitest";
import { sma, ema, atrSeries } from "../src/math/series";
import { rsi, macd, williamsR, stoch } from "../src/indicators/oscillators";
import { atr, bollinger } from "../src/indicators/volatility";
import { adx } from "../src/indicators/trend";
import { constantCandles, upTrendCandles, downTrendCandles } from "./fixtures/candles";

describe("primitivos — valores analíticos", () => {
  it("SMA(5) de 1..10 termina na média de 6..10 = 8", () => {
    const out = sma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(out[out.length - 1]).toBeCloseTo(8, 10);
  });

  it("EMA de série constante = a constante", () => {
    const out = ema(new Array(50).fill(7), 10);
    expect(out[out.length - 1]).toBeCloseTo(7, 10);
  });

  it("ATR de candles com range constante = esse range", () => {
    const candles = constantCandles(60, 100, 4);
    const series = atrSeries(candles, 14);
    expect(series[series.length - 1]).toBeCloseTo(4, 6);
    expect(atr(candles, 14)).toBeCloseTo(4, 6);
  });
});

describe("indicadores — invariantes", () => {
  it("RSI de série estritamente crescente = 100", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBeCloseTo(100, 6);
  });

  it("RSI de série estritamente decrescente = 0", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 - i);
    expect(rsi(closes, 14)).toBeCloseTo(0, 6);
  });

  it("MACD de série constante → histograma 0", () => {
    const closes = new Array(60).fill(50);
    expect(macd(closes).histogram).toBeCloseTo(0, 10);
  });

  it("Bollinger de série constante → bandwidth 0 e middle = preço", () => {
    const bb = bollinger(new Array(30).fill(123), 20, 2);
    expect(bb.middle).toBeCloseTo(123, 10);
    expect(bb.bandwidth).toBeCloseTo(0, 10);
  });

  it("Williams %R sempre em [-100, 0]", () => {
    const candles = upTrendCandles(40);
    const w = williamsR(candles, 14);
    expect(w).toBeGreaterThanOrEqual(-100);
    expect(w).toBeLessThanOrEqual(0);
  });

  it("Stochastic %K e %D em [0,100]", () => {
    const candles = upTrendCandles(40);
    const s = stoch(candles);
    expect(s.k).toBeGreaterThanOrEqual(0);
    expect(s.k).toBeLessThanOrEqual(100);
    expect(s.d).toBeGreaterThanOrEqual(0);
    expect(s.d).toBeLessThanOrEqual(100);
  });

  it("ADX: uptrend forte → +DI > -DI; downtrend → -DI > +DI", () => {
    const up = adx(upTrendCandles(60), 14);
    expect(up.plusDI).toBeGreaterThan(up.minusDI);
    const down = adx(downTrendCandles(60), 14);
    expect(down.minusDI).toBeGreaterThan(down.plusDI);
  });
});
