/**
 * 20 indicadores técnicos calculados puramente com Node.js (sem dependências externas além de math básico).
 *
 * Cobertura escolhida para espelhar o Vortex:
 *   Médias Móveis (5):  EMA20, EMA50, EMA200, SMA50, VWMA20
 *   Osciladores (8):    RSI14, MACD(12,26,9), Stoch(14,3,3), CCI20, Williams%R14,
 *                       Awesome Osc, MFI14, ROC14
 *   Tendência (3):      ADX14 (+DI/-DI), Supertrend(ATR10, 3), TRIX(14)
 *   Volatilidade (2):   ATR14, Bollinger Bands (20, 2σ)
 *   Volume (2):         OBV, CMF(20)
 *
 * Cada indicador retorna o valor mais recente.
 */
import type { Candle } from "@/lib/market/types";

// =========================================================
// Helpers
// =========================================================

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out.push(sum / period);
    else out.push(NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      // Seed: primeira EMA = SMA dos N primeiros
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    } else {
      out.push(NaN);
    }
  }
  return out;
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function last<T>(arr: T[]): T { return arr[arr.length - 1]; }

// =========================================================
// Médias Móveis
// =========================================================

export function vwma(candles: Candle[], period: number): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  const pv = slice.reduce((a, c) => a + c.close * c.volume, 0);
  const v = slice.reduce((a, c) => a + c.volume, 0);
  return v === 0 ? NaN : pv / v;
}

// =========================================================
// RSI (Wilder)
// =========================================================

export function rsi(closes: number[], period = 14): number {
  if (closes.length <= period) return NaN;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch >= 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// =========================================================
// MACD
// =========================================================

export function macd(closes: number[], fast = 12, slow = 26, signal = 9): {
  macdLine: number; signal: number; histogram: number;
} {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  // remove NaNs do início para calcular signal
  const cleanMacd = macdLine.filter((v) => !Number.isNaN(v));
  const signalLine = ema(cleanMacd, signal);
  const macdVal = last(macdLine);
  const sigVal = last(signalLine);
  return {
    macdLine: macdVal,
    signal: sigVal,
    histogram: macdVal - sigVal,
  };
}

// =========================================================
// Bollinger Bands (20, 2σ)
// =========================================================

export function bollinger(closes: number[], period = 20, mult = 2): {
  upper: number; middle: number; lower: number; bandwidth: number;
} {
  if (closes.length < period) return { upper: NaN, middle: NaN, lower: NaN, bandwidth: NaN };
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stdev(slice);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  return { upper, middle, lower, bandwidth: (upper - lower) / middle };
}

// =========================================================
// Stochastic (%K, %D)
// =========================================================

export function stoch(candles: Candle[], kPeriod = 14, dPeriod = 3): {
  k: number; d: number;
} {
  if (candles.length < kPeriod + dPeriod) return { k: NaN, d: NaN };
  const ks: number[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map((c) => c.high));
    const low = Math.min(...slice.map((c) => c.low));
    const close = candles[i].close;
    const k = ((close - low) / (high - low)) * 100;
    ks.push(k);
  }
  const dSlice = ks.slice(-dPeriod);
  const d = dSlice.reduce((a, b) => a + b, 0) / dPeriod;
  return { k: last(ks), d };
}

// =========================================================
// CCI (Commodity Channel Index)
// =========================================================

export function cci(candles: Candle[], period = 20): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  const tps = slice.map((c) => (c.high + c.low + c.close) / 3);
  const mean = tps.reduce((a, b) => a + b, 0) / period;
  const meanDev = tps.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
  if (meanDev === 0) return 0;
  const tpLast = tps[tps.length - 1];
  return (tpLast - mean) / (0.015 * meanDev);
}

// =========================================================
// Williams %R
// =========================================================

export function williamsR(candles: Candle[], period = 14): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  const close = last(slice).close;
  return ((high - close) / (high - low)) * -100;
}

// =========================================================
// Awesome Oscillator (5, 34) sobre median price
// =========================================================

export function awesome(candles: Candle[]): number {
  if (candles.length < 34) return NaN;
  const median = candles.map((c) => (c.high + c.low) / 2);
  const s5 = sma(median, 5);
  const s34 = sma(median, 34);
  return last(s5) - last(s34);
}

// =========================================================
// MFI (Money Flow Index)
// =========================================================

export function mfi(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  let posFlow = 0, negFlow = 0;
  const tps = candles.map((c) => (c.high + c.low + c.close) / 3);
  for (let i = candles.length - period; i < candles.length; i++) {
    const rmf = tps[i] * candles[i].volume;
    if (tps[i] > tps[i - 1]) posFlow += rmf;
    else if (tps[i] < tps[i - 1]) negFlow += rmf;
  }
  if (negFlow === 0) return 100;
  const ratio = posFlow / negFlow;
  return 100 - 100 / (1 + ratio);
}

// =========================================================
// ROC (Rate of Change)
// =========================================================

export function roc(closes: number[], period = 14): number {
  if (closes.length <= period) return NaN;
  const prev = closes[closes.length - 1 - period];
  if (prev === 0) return 0;
  return ((last(closes) - prev) / prev) * 100;
}

// =========================================================
// ATR (Wilder)
// =========================================================

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  // Wilder smoothing
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period;
  }
  return atrVal;
}

// =========================================================
// ADX (+DI, -DI)
// =========================================================

export function adx(candles: Candle[], period = 14): {
  adx: number; plusDI: number; minusDI: number;
} {
  if (candles.length < period * 2) return { adx: NaN, plusDI: NaN, minusDI: NaN };

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }

  // Wilder smoothing
  function smoothed(arr: number[]): number[] {
    const out: number[] = [];
    let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
    out.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      out.push(sum);
    }
    return out;
  }

  const trS = smoothed(tr);
  const pdmS = smoothed(plusDM);
  const mdmS = smoothed(minusDM);
  const dx: number[] = [];

  for (let i = 0; i < trS.length; i++) {
    const pDI = (pdmS[i] / trS[i]) * 100;
    const mDI = (mdmS[i] / trS[i]) * 100;
    const denom = pDI + mDI;
    const d = denom === 0 ? 0 : (Math.abs(pDI - mDI) / denom) * 100;
    dx.push(d);
  }

  // ADX = média móvel dos DX (Wilder)
  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
  }

  const lastIdx = trS.length - 1;
  return {
    adx: adxVal,
    plusDI: (pdmS[lastIdx] / trS[lastIdx]) * 100,
    minusDI: (mdmS[lastIdx] / trS[lastIdx]) * 100,
  };
}

// =========================================================
// Supertrend (ATR period 10, multiplier 3)
// =========================================================

export function supertrend(candles: Candle[], period = 10, mult = 3): {
  value: number; trend: "up" | "down";
} {
  if (candles.length < period + 1) return { value: NaN, trend: "up" };
  const atrVal = atr(candles, period);
  const last = candles[candles.length - 1];
  const hl2 = (last.high + last.low) / 2;
  const upperBand = hl2 + mult * atrVal;
  const lowerBand = hl2 - mult * atrVal;
  // Versão simplificada: trend baseado na posição do close
  if (last.close > hl2) {
    return { value: lowerBand, trend: "up" };
  }
  return { value: upperBand, trend: "down" };
}

// =========================================================
// TRIX
// =========================================================

export function trix(closes: number[], period = 14): number {
  if (closes.length < period * 3) return NaN;
  const e1 = ema(closes, period);
  const e2 = ema(e1.filter((v) => !Number.isNaN(v)), period);
  const e3 = ema(e2.filter((v) => !Number.isNaN(v)), period);
  const lastE3 = last(e3);
  const prevE3 = e3[e3.length - 2];
  if (Number.isNaN(prevE3) || prevE3 === 0) return 0;
  return ((lastE3 - prevE3) / prevE3) * 100;
}

// =========================================================
// OBV (On-Balance Volume)
// =========================================================

export function obv(candles: Candle[]): { current: number; slope: number } {
  if (candles.length < 2) return { current: 0, slope: 0 };
  const values: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prev = values[i - 1];
    if (candles[i].close > candles[i - 1].close) values.push(prev + candles[i].volume);
    else if (candles[i].close < candles[i - 1].close) values.push(prev - candles[i].volume);
    else values.push(prev);
  }
  // Inclinação: comparação últimas N velas vs anteriores
  const window = Math.min(20, Math.floor(values.length / 2));
  const recent = values.slice(-window).reduce((a, b) => a + b, 0) / window;
  const older = values.slice(-window * 2, -window).reduce((a, b) => a + b, 0) / window;
  const slope = older === 0 ? 0 : ((recent - older) / Math.abs(older)) * 100;
  return { current: last(values), slope };
}

// =========================================================
// CMF (Chaikin Money Flow)
// =========================================================

export function cmf(candles: Candle[], period = 20): number {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  let mfv = 0, vol = 0;
  for (const c of slice) {
    const denom = c.high - c.low;
    const mfMultiplier = denom === 0 ? 0 : ((c.close - c.low) - (c.high - c.close)) / denom;
    mfv += mfMultiplier * c.volume;
    vol += c.volume;
  }
  return vol === 0 ? 0 : mfv / vol;
}
