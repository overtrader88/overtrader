/**
 * Tendência: ADX (+DI/-DI), Supertrend, TRIX. Funções puras.
 */
import type { Candle } from "@tradeai/shared";
import { ema, last } from "../math/series";
import { atr } from "./volatility";

export interface AdxResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export function adx(candles: Candle[], period = 14): AdxResult {
  if (candles.length < period * 2) return { adx: NaN, plusDI: NaN, minusDI: NaN };

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    const upMove = c.high - prev.high;
    const downMove = prev.low - c.low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)),
    );
  }

  // Wilder smoothing acumulado.
  const smoothed = (arr: number[]): number[] => {
    const out: number[] = [];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += arr[i]!;
    out.push(sum);
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i]!;
      out.push(sum);
    }
    return out;
  };

  const trS = smoothed(tr);
  const pdmS = smoothed(plusDM);
  const mdmS = smoothed(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    const pDI = (pdmS[i]! / trS[i]!) * 100;
    const mDI = (mdmS[i]! / trS[i]!) * 100;
    const denom = pDI + mDI;
    dx.push(denom === 0 ? 0 : (Math.abs(pDI - mDI) / denom) * 100);
  }

  let adxVal = 0;
  for (let i = 0; i < period; i++) adxVal += dx[i]!;
  adxVal /= period;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]!) / period;
  }

  const lastIdx = trS.length - 1;
  return {
    adx: adxVal,
    plusDI: (pdmS[lastIdx]! / trS[lastIdx]!) * 100,
    minusDI: (mdmS[lastIdx]! / trS[lastIdx]!) * 100,
  };
}

export interface SupertrendResult {
  value: number;
  trend: "up" | "down";
}

export function supertrend(candles: Candle[], period = 10, mult = 3): SupertrendResult {
  if (candles.length < period + 1) return { value: NaN, trend: "up" };
  const atrVal = atr(candles, period);
  const c = last(candles);
  const hl2 = (c.high + c.low) / 2;
  if (c.close > hl2) return { value: hl2 - mult * atrVal, trend: "up" };
  return { value: hl2 + mult * atrVal, trend: "down" };
}

export function trix(closes: number[], period = 14): number {
  if (closes.length < period * 3) return NaN;
  const e1 = ema(closes, period);
  const e2 = ema(e1.filter((v) => !Number.isNaN(v)), period);
  const e3 = ema(e2.filter((v) => !Number.isNaN(v)), period);
  const lastE3 = last(e3);
  const prevE3 = e3[e3.length - 2];
  if (prevE3 === undefined || Number.isNaN(prevE3) || prevE3 === 0) return 0;
  return ((lastE3 - prevE3) / prevE3) * 100;
}
