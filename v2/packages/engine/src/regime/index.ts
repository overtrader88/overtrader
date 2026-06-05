/**
 * Classificação de regime de mercado.
 *
 * Correção vs v1: o ATR-médio era recalculado refatiando o array a cada candle
 * (O(n²)). Aqui usamos `atrSeries` UMA vez e tiramos a média rolling em O(n).
 */
import type { Candle } from "@tradeai/shared";
import type { EngineConfig } from "../config";
import type { MarketRegime } from "../types";
import { adx } from "../indicators/trend";
import { atrSeries } from "../math/series";

export interface RegimeInfo {
  regime: MarketRegime;
  adxValue: number;
  atrCurrent: number;
  atrAvg: number;
  atrRatio: number;
}

export function computeMarketRegime(candles: Candle[], config: EngineConfig): RegimeInfo {
  const adxR = adx(candles, 14);
  const series = atrSeries(candles, 14);

  // Valores válidos (não-warm-up) do ATR.
  const valid: number[] = [];
  for (const v of series) if (!Number.isNaN(v)) valid.push(v);

  const atrCurrent = valid.length ? valid[valid.length - 1]! : NaN;

  const window = Math.min(50, valid.length);
  let atrAvg = atrCurrent;
  if (window > 0) {
    let sum = 0;
    for (let i = valid.length - window; i < valid.length; i++) sum += valid[i]!;
    atrAvg = sum / window;
  }
  const atrRatio = atrAvg > 0 ? atrCurrent / atrAvg : 1;

  let regime: MarketRegime;
  if (atrRatio >= config.regime.atrExplosiveRatio) regime = "explosive";
  else if (adxR.adx >= config.regime.adxTrending) regime = "trending";
  else if (adxR.adx < config.regime.adxRanging) regime = "ranging";
  else regime = "transitional";

  return { regime, adxValue: adxR.adx, atrCurrent, atrAvg, atrRatio };
}
