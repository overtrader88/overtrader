/**
 * Volume: OBV (com inclinação) e CMF. Funções puras.
 */
import type { Candle } from "@tradeai/shared";
import { last } from "../math/series";

export interface ObvResult {
  current: number;
  /** Inclinação % da média recente vs anterior (proxy de tendência de volume). */
  slope: number;
}

export function obv(candles: Candle[]): ObvResult {
  if (candles.length < 2) return { current: 0, slope: 0 };
  const values: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prev = values[i - 1]!;
    const c = candles[i]!;
    const pc = candles[i - 1]!;
    if (c.close > pc.close) values.push(prev + c.volume);
    else if (c.close < pc.close) values.push(prev - c.volume);
    else values.push(prev);
  }
  const window = Math.min(20, Math.floor(values.length / 2));
  if (window === 0) return { current: last(values), slope: 0 };
  const sum = (arr: number[]): number => {
    let s = 0;
    for (const v of arr) s += v;
    return s;
  };
  const recent = sum(values.slice(-window)) / window;
  const older = sum(values.slice(-window * 2, -window)) / window;
  const slope = older === 0 ? 0 : ((recent - older) / Math.abs(older)) * 100;
  return { current: last(values), slope };
}

export function cmf(candles: Candle[], period = 20): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  let mfv = 0;
  let vol = 0;
  for (const c of slice) {
    const denom = c.high - c.low;
    const mult = denom === 0 ? 0 : (c.close - c.low - (c.high - c.close)) / denom;
    mfv += mult * c.volume;
    vol += c.volume;
  }
  return vol === 0 ? 0 : mfv / vol;
}
