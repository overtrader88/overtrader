/**
 * Converte VALORES de indicadores → votos BUY/SELL/NEUTRAL, usando os
 * thresholds do `EngineConfig`. Produz a lista de `IndicatorResult` (com
 * categoria e nota) consumida pela agregação e pela UI.
 *
 * Nomes dos indicadores são constantes (NAMES) para casar com o mapa de
 * classificação trend/mean-reversion da agregação — sem strings soltas.
 */
import type { IndicatorVote } from "@tradeai/shared";
import type { EngineConfig } from "../config";
import type { IndicatorResult } from "../types";
import type { IndicatorValues } from "../indicators";

export const NAMES = {
  ema20: "EMA (20)",
  ema50: "EMA (50)",
  ema200: "EMA (200)",
  sma50: "SMA (50)",
  vwma20: "VWMA (20)",
  rsi: "RSI (14)",
  macd: "MACD (12,26,9)",
  stoch: "Stochastic (14,3,3)",
  cci: "CCI (20)",
  williamsR: "Williams %R (14)",
  awesome: "Awesome Oscillator",
  mfi: "MFI (14)",
  roc: "ROC (14)",
  adx: "ADX (14)",
  supertrend: "Supertrend (ATR10, 3)",
  trix: "TRIX (14)",
  bollinger: "Bollinger Bands (20, 2σ)",
  atr: "ATR (14)",
  obv: "OBV",
  cmf: "CMF (20)",
} as const;

const CAT = {
  ma: "Médias Móveis",
  osc: "Osciladores",
  trend: "Tendência",
  vol: "Volatilidade",
  volume: "Volume",
} as const;

function priceVote(last: number, ref: number): IndicatorVote {
  if (Number.isNaN(ref)) return "NEUTRAL";
  return last > ref ? "BUY" : "SELL";
}

export function buildIndicatorResults(
  v: IndicatorValues,
  config: EngineConfig,
): IndicatorResult[] {
  const t = config.voteThresholds;
  const last = v.lastClose;
  const out: IndicatorResult[] = [];

  // ---- Médias Móveis ----
  out.push({ name: NAMES.ema20, category: CAT.ma, value: v.ema20, vote: priceVote(last, v.ema20), note: `Preço ${last > v.ema20 ? "acima" : "abaixo"} da EMA 20` });
  out.push({ name: NAMES.ema50, category: CAT.ma, value: v.ema50, vote: priceVote(last, v.ema50), note: `Preço ${last > v.ema50 ? "acima" : "abaixo"} da EMA 50` });
  out.push({ name: NAMES.ema200, category: CAT.ma, value: v.ema200, vote: priceVote(last, v.ema200), note: `Tendência de longo prazo ${last > v.ema200 ? "de alta" : "de baixa"}` });
  out.push({ name: NAMES.sma50, category: CAT.ma, value: v.sma50, vote: priceVote(last, v.sma50) });
  out.push({ name: NAMES.vwma20, category: CAT.ma, value: v.vwma20, vote: priceVote(last, v.vwma20), note: "Média ponderada por volume" });

  // ---- Osciladores ----
  out.push({
    name: NAMES.rsi, category: CAT.osc, value: v.rsi14,
    vote: v.rsi14 > t.rsi.buyAbove ? "BUY" : v.rsi14 < t.rsi.sellBelow ? "SELL" : "NEUTRAL",
    note: v.rsi14 > t.rsi.overbought ? "Sobrecomprado" : v.rsi14 < t.rsi.oversold ? "Sobrevendido" : "Neutro",
  });
  out.push({
    name: NAMES.macd, category: CAT.osc,
    value: { macdLine: v.macd.macdLine, signal: v.macd.signal, histogram: v.macd.histogram },
    vote: v.macd.histogram > 0 ? "BUY" : v.macd.histogram < 0 ? "SELL" : "NEUTRAL",
    note: `Histograma ${v.macd.histogram > 0 ? "positivo" : "negativo"}`,
  });
  out.push({
    name: NAMES.stoch, category: CAT.osc, value: { k: v.stoch.k, d: v.stoch.d },
    vote:
      v.stoch.k > v.stoch.d && v.stoch.k < t.stoch.overbought ? "BUY"
        : v.stoch.k < v.stoch.d && v.stoch.k > t.stoch.oversold ? "SELL"
          : "NEUTRAL",
  });
  out.push({
    name: NAMES.cci, category: CAT.osc, value: v.cci20,
    vote: v.cci20 > t.cci.buyAbove ? "BUY" : v.cci20 < t.cci.sellBelow ? "SELL" : "NEUTRAL",
  });
  out.push({
    name: NAMES.williamsR, category: CAT.osc, value: v.williamsR14,
    vote: v.williamsR14 > t.williamsR.overbought ? "SELL" : v.williamsR14 < t.williamsR.oversold ? "BUY" : "NEUTRAL",
    note: v.williamsR14 > t.williamsR.overbought ? "Sobrecomprado" : v.williamsR14 < t.williamsR.oversold ? "Sobrevendido" : "Neutro",
  });
  out.push({
    name: NAMES.awesome, category: CAT.osc, value: v.awesome,
    vote: v.awesome > 0 ? "BUY" : v.awesome < 0 ? "SELL" : "NEUTRAL",
  });
  out.push({
    name: NAMES.mfi, category: CAT.osc, value: v.mfi14,
    vote: v.mfi14 > t.mfi.buyAbove ? "BUY" : v.mfi14 < t.mfi.sellBelow ? "SELL" : "NEUTRAL",
  });
  out.push({
    name: NAMES.roc, category: CAT.osc, value: v.roc14,
    vote: v.roc14 > 0 ? "BUY" : v.roc14 < 0 ? "SELL" : "NEUTRAL",
  });

  // ---- Tendência ----
  out.push({
    name: NAMES.adx, category: CAT.trend,
    value: { adx: v.adx14.adx, plusDI: v.adx14.plusDI, minusDI: v.adx14.minusDI },
    vote: v.adx14.adx > t.adxDirectional ? (v.adx14.plusDI > v.adx14.minusDI ? "BUY" : "SELL") : "NEUTRAL",
    note: v.adx14.adx > t.adxDirectional ? `Tendência forte (ADX ${v.adx14.adx.toFixed(1)})` : "Sem tendência clara",
  });
  out.push({
    name: NAMES.supertrend, category: CAT.trend, value: v.supertrend.value,
    vote: v.supertrend.trend === "up" ? "BUY" : "SELL",
  });
  out.push({
    name: NAMES.trix, category: CAT.trend, value: v.trix14,
    vote: v.trix14 > 0 ? "BUY" : v.trix14 < 0 ? "SELL" : "NEUTRAL",
  });

  // ---- Volatilidade ----
  out.push({
    name: NAMES.bollinger, category: CAT.vol,
    value: { upper: v.bollinger.upper, middle: v.bollinger.middle, lower: v.bollinger.lower, bandwidth: v.bollinger.bandwidth },
    vote: last < v.bollinger.lower ? "BUY" : last > v.bollinger.upper ? "SELL" : "NEUTRAL",
    note: last < v.bollinger.lower ? "Abaixo da banda inferior" : last > v.bollinger.upper ? "Acima da banda superior" : "Dentro das bandas",
  });
  out.push({
    name: NAMES.atr, category: CAT.vol, value: v.atr14, vote: "NEUTRAL",
    note: `Volatilidade atual: ${Number.isNaN(v.atr14) ? "—" : v.atr14.toFixed(2)}`,
  });

  // ---- Volume ----
  out.push({
    name: NAMES.obv, category: CAT.volume, value: { current: v.obv.current, slope: v.obv.slope },
    vote: v.obv.slope > t.obvSlope.buyAbove ? "BUY" : v.obv.slope < t.obvSlope.sellBelow ? "SELL" : "NEUTRAL",
    note: `Inclinação ${v.obv.slope.toFixed(1)}%`,
  });
  out.push({
    name: NAMES.cmf, category: CAT.volume, value: v.cmf20,
    vote: v.cmf20 > t.cmf.buyAbove ? "BUY" : v.cmf20 < t.cmf.sellBelow ? "SELL" : "NEUTRAL",
    note: v.cmf20 > 0 ? "Pressão compradora" : "Pressão vendedora",
  });

  return out;
}
