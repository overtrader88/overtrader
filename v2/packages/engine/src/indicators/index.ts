/**
 * Agrega os 20 indicadores em VALORES BRUTOS (sem voto). A conversão
 * valor→voto fica em `signal/votes.ts`, dirigida pelo config — assim os
 * thresholds (RSI>60 etc.) não ficam espalhados no cálculo.
 */
import type { Candle } from "@tradeai/shared";
import { ema, sma, last } from "../math/series";
import { vwma } from "./moving-averages";
import {
  rsi,
  macd,
  stoch,
  cci,
  williamsR,
  awesome,
  mfi,
  roc,
  type MacdResult,
  type StochResult,
} from "./oscillators";
import { adx, supertrend, trix, type AdxResult, type SupertrendResult } from "./trend";
import { atr, bollinger, type BollingerResult } from "./volatility";
import { obv, cmf, type ObvResult } from "./volume";

export * from "./moving-averages";
export * from "./oscillators";
export * from "./trend";
export * from "./volatility";
export * from "./volume";

/** Valores brutos de todos os indicadores num candle. */
export interface IndicatorValues {
  lastClose: number;
  ema20: number;
  ema50: number;
  ema200: number;
  sma50: number;
  vwma20: number;
  rsi14: number;
  macd: MacdResult;
  stoch: StochResult;
  cci20: number;
  williamsR14: number;
  awesome: number;
  mfi14: number;
  roc14: number;
  adx14: AdxResult;
  supertrend: SupertrendResult;
  trix14: number;
  bollinger: BollingerResult;
  atr14: number;
  obv: ObvResult;
  cmf20: number;
}

export function computeIndicatorValues(candles: Candle[]): IndicatorValues {
  const closes = candles.map((c) => c.close);
  return {
    lastClose: last(closes),
    ema20: last(ema(closes, 20)),
    ema50: last(ema(closes, 50)),
    ema200: last(ema(closes, 200)),
    sma50: last(sma(closes, 50)),
    vwma20: vwma(candles, 20),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    stoch: stoch(candles),
    cci20: cci(candles, 20),
    williamsR14: williamsR(candles, 14),
    awesome: awesome(candles),
    mfi14: mfi(candles, 14),
    roc14: roc(closes, 14),
    adx14: adx(candles, 14),
    supertrend: supertrend(candles, 10, 3),
    trix14: trix(closes, 14),
    bollinger: bollinger(closes, 20, 2),
    atr14: atr(candles, 14),
    obv: obv(candles),
    cmf20: cmf(candles, 20),
  };
}
