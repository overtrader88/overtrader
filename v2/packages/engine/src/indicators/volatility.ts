/**
 * Volatilidade: ATR (Wilder) e Bollinger Bands. Funções puras.
 */
import type { Candle } from "@tradeai/shared";
import { atrSeries, stdevPopulation } from "../math/series";

/** ATR de Wilder — valor mais recente. NaN se insuficiente. */
export function atr(candles: Candle[], period = 14): number {
  const series = atrSeries(candles, period);
  const v = series[series.length - 1];
  return v ?? NaN;
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  /** Largura relativa das bandas (upper-lower)/middle. */
  bandwidth: number;
}

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  if (closes.length < period) {
    return { upper: NaN, middle: NaN, lower: NaN, bandwidth: NaN };
  }
  const slice = closes.slice(-period);
  let middle = 0;
  for (const v of slice) middle += v;
  middle /= period;
  const sd = stdevPopulation(slice);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  return { upper, middle, lower, bandwidth: middle === 0 ? NaN : (upper - lower) / middle };
}
