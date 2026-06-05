/**
 * Médias móveis: VWMA (ponderada por volume). EMA/SMA vêm de math/series.
 */
import type { Candle } from "@tradeai/shared";

export function vwma(candles: Candle[], period: number): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  let pv = 0;
  let v = 0;
  for (const c of slice) {
    pv += c.close * c.volume;
    v += c.volume;
  }
  return v === 0 ? NaN : pv / v;
}
