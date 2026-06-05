/**
 * Osciladores: RSI, MACD, Stochastic, CCI, Williams %R, Awesome, MFI, ROC.
 * Funções puras — devolvem o valor mais recente. Portadas do v1 (validadas
 * matematicamente na revisão quant).
 */
import type { Candle } from "@tradeai/shared";
import { ema, sma, last } from "../math/series";

/** RSI de Wilder. NaN se candles insuficientes. */
export function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    const g = ch >= 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macdLine: number;
  signal: number;
  histogram: number;
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]!);
  const cleanMacd = macdLine.filter((v) => !Number.isNaN(v));
  const signalLine = ema(cleanMacd, signal);
  const macdVal = last(macdLine);
  const sigVal = signalLine.length ? last(signalLine) : NaN;
  return { macdLine: macdVal, signal: sigVal, histogram: macdVal - sigVal };
}

export interface StochResult {
  k: number;
  d: number;
}

export function stoch(candles: Candle[], kPeriod = 14, dPeriod = 3): StochResult {
  if (candles.length < kPeriod + dPeriod) return { k: NaN, d: NaN };
  const ks: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      const c = candles[j]!;
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
    }
    const close = candles[i]!.close;
    ks.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }
  const dSlice = ks.slice(-dPeriod);
  let dSum = 0;
  for (const v of dSlice) dSum += v;
  return { k: last(ks), d: dSum / dPeriod };
}

export function cci(candles: Candle[], period = 20): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  const tps = slice.map((c) => (c.high + c.low + c.close) / 3);
  let mean = 0;
  for (const t of tps) mean += t;
  mean /= period;
  let meanDev = 0;
  for (const t of tps) meanDev += Math.abs(t - mean);
  meanDev /= period;
  if (meanDev === 0) return 0;
  return (last(tps) - mean) / (0.015 * meanDev);
}

export function williamsR(candles: Candle[], period = 14): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  let high = -Infinity;
  let low = Infinity;
  for (const c of slice) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const close = last(slice).close;
  return high === low ? -50 : ((high - close) / (high - low)) * -100;
}

/** Awesome Oscillator (5, 34) sobre median price. */
export function awesome(candles: Candle[]): number {
  if (candles.length < 34) return NaN;
  const median = candles.map((c) => (c.high + c.low) / 2);
  return last(sma(median, 5)) - last(sma(median, 34));
}

export function mfi(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  const tps = candles.map((c) => (c.high + c.low + c.close) / 3);
  let posFlow = 0;
  let negFlow = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const rmf = tps[i]! * candles[i]!.volume;
    if (tps[i]! > tps[i - 1]!) posFlow += rmf;
    else if (tps[i]! < tps[i - 1]!) negFlow += rmf;
  }
  if (negFlow === 0) return 100;
  return 100 - 100 / (1 + posFlow / negFlow);
}

export function roc(closes: number[], period = 14): number {
  if (closes.length <= period) return NaN;
  const prev = closes[closes.length - 1 - period]!;
  if (prev === 0) return 0;
  return ((last(closes) - prev) / prev) * 100;
}
