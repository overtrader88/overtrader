/**
 * Pré-computação de séries para o backtest — mata o O(n²).
 *
 * Em vez de chamar `runAnalysis(candles.slice(0, i+1))` por candle (recomputando
 * tudo do zero), pré-computamos UMA vez as séries dos indicadores recursivos
 * (EMA/RSI/ATR/ADX/MACD/TRIX) e, por índice, montamos os indicadores e rodamos
 * o MESMO pipeline downstream (`buildIndicatorResults` → `computeSignal` →
 * `computeRiskFrom` → `computeGates` → downgrade).
 *
 * EXATIDÃO: `runAnalysisAt(i)` deve produzir os MESMOS sinal/risco/regime que
 * `runAnalysis(candles.slice(0, i+1))`. Isso é garantido por um teste de
 * paridade (test/parity.test.ts) — só por isso o backtest passou a usá-lo.
 */
import type { Candle } from "@tradeai/shared";
import { ema, sma, atrSeries, stdevPopulation } from "../math/series";
import type {
  IndicatorValues, MacdResult, StochResult, AdxResult, SupertrendResult, BollingerResult, ObvResult,
} from "../indicators";
import type { MarketRegime, RiskOutput, SignalOutput } from "../types";
import type { RegimeInfo } from "../regime";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import { buildIndicatorResults } from "../signal/votes";
import { computeSignal } from "../signal/aggregate";
import { computeConditionalSignal } from "../signal/conditional";
import { computeGates, CRITICAL_GATE_IDS } from "../gates";
import { computeRiskFrom, neutralRisk } from "../risk";
import { downgrade } from "../analysis/run";

// ---------- séries recursivas exatas ----------

function rsiSeries(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let k = 1; k <= period; k++) {
    const ch = closes[k]! - closes[k - 1]!;
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + (ch >= 0 ? ch : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macdSeries(closes: number[], fast = 12, slow = 26, signalP = 9): MacdResult[] {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const macdLine = closes.map((_, i) => ef[i]! - es[i]!);
  const clean = macdLine.filter((v) => !Number.isNaN(v));
  const sig = ema(clean, signalP);
  const out: MacdResult[] = closes.map(() => ({ macdLine: NaN, signal: NaN, histogram: NaN }));
  const startClean = slow - 1;
  for (let i = startClean; i < closes.length; i++) {
    const k = i - startClean;
    const s = sig[k] ?? NaN;
    const ml = macdLine[i]!;
    out[i] = { macdLine: ml, signal: s, histogram: ml - s };
  }
  return out;
}

function trixSeries(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  const e1 = ema(closes, period);
  const f1 = e1.filter((v) => !Number.isNaN(v));
  const e2 = ema(f1, period);
  const f2 = e2.filter((v) => !Number.isNaN(v));
  const e3 = ema(f2, period);
  const shift = 2 * (period - 1);
  for (let c = 0; c < closes.length; c++) {
    if (c + 1 < period * 3) continue;
    const m = c - shift;
    const cur = e3[m];
    const prev = e3[m - 1];
    if (cur === undefined || prev === undefined || Number.isNaN(prev) || prev === 0) out[c] = 0;
    else out[c] = ((cur - prev) / prev) * 100;
  }
  return out;
}

/** ADX/+DI/-DI por índice de candle (incremental). out[i] == adx(slice 0..i+1). */
function adxSeries(candles: Candle[], period = 14): AdxResult[] {
  const n = candles.length;
  const out: AdxResult[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = { adx: NaN, plusDI: NaN, minusDI: NaN };

  let trSum = 0;
  let pdmSum = 0;
  let mdmSum = 0;
  let rawCount = 0;
  const dx: number[] = [];
  let adxVal = NaN;
  let adxSeeded = false;

  for (let e = 0; e < n - 1; e++) {
    const j = e + 1;
    const c = candles[j]!;
    const prev = candles[j - 1]!;
    const up = c.high - prev.high;
    const down = prev.low - c.low;
    const pdm = up > down && up > 0 ? up : 0;
    const mdm = down > up && down > 0 ? down : 0;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));

    if (rawCount < period) {
      trSum += tr;
      pdmSum += pdm;
      mdmSum += mdm;
      rawCount++;
    } else {
      trSum = trSum - trSum / period + tr;
      pdmSum = pdmSum - pdmSum / period + pdm;
      mdmSum = mdmSum - mdmSum / period + mdm;
    }

    if (rawCount >= period) {
      const pDI = trSum > 0 ? (pdmSum / trSum) * 100 : 0;
      const mDI = trSum > 0 ? (mdmSum / trSum) * 100 : 0;
      const denom = pDI + mDI;
      const d = denom === 0 ? 0 : (Math.abs(pDI - mDI) / denom) * 100;
      dx.push(d);
      if (!adxSeeded && dx.length === period) {
        let s = 0;
        for (let k = 0; k < period; k++) s += dx[k]!;
        adxVal = s / period;
        adxSeeded = true;
      } else if (adxSeeded) {
        adxVal = (adxVal * (period - 1) + d) / period;
      }
      if (adxSeeded) out[j] = { adx: adxVal, plusDI: pDI, minusDI: mDI };
    }
  }
  return out;
}

// ---------- base pré-computada ----------

export interface PrecomputedBase {
  closes: number[];
  ema20: number[];
  ema50: number[];
  ema200: number[];
  sma50: number[];
  rsi14: number[];
  /** SMA(5) e SMA(34) do median price — base do Awesome Oscillator (mesma soma corrente do scalar). */
  medianSma5: number[];
  medianSma34: number[];
  macd: MacdResult[];
  trix14: number[];
  adx14: AdxResult[];
  /** ATR(14) por índice de TR — atr no candle i = atr14[i-1]. */
  atr14: number[];
  /** ATR(10) por índice de TR — usado pelo Supertrend. */
  atr10: number[];
  /** OBV cumulativo por candle. */
  obv: number[];
}

export function precomputeBase(candles: Candle[]): PrecomputedBase {
  const closes = candles.map((c) => c.close);
  const medians = candles.map((c) => (c.high + c.low) / 2);
  const obv = new Array<number>(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const prev = obv[i - 1]!;
    const c = candles[i]!;
    const pc = candles[i - 1]!;
    obv[i] = c.close > pc.close ? prev + c.volume : c.close < pc.close ? prev - c.volume : prev;
  }
  return {
    closes,
    ema20: ema(closes, 20),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    sma50: sma(closes, 50),
    rsi14: rsiSeries(closes, 14),
    medianSma5: sma(medians, 5),
    medianSma34: sma(medians, 34),
    macd: macdSeries(closes),
    trix14: trixSeries(closes, 14),
    adx14: adxSeries(candles, 14),
    atr14: atrSeries(candles, 14),
    atr10: atrSeries(candles, 10),
    obv,
  };
}

// ---------- montagem por índice ----------

function windowMean(arr: number[], from: number, to: number): number {
  let s = 0;
  let n = 0;
  for (let i = Math.max(0, from); i <= to; i++) {
    s += arr[i]!;
    n++;
  }
  return n > 0 ? s / n : 0;
}

/** IndicatorValues em `i` — idêntico a computeIndicatorValues(candles.slice(0,i+1)). */
export function indicatorValuesAt(candles: Candle[], i: number, base: PrecomputedBase): IndicatorValues {
  const closes = base.closes;
  const lastClose = closes[i]!;

  // VWMA(20)
  let pv = 0;
  let vv = 0;
  for (let k = Math.max(0, i - 19); k <= i; k++) {
    pv += candles[k]!.close * candles[k]!.volume;
    vv += candles[k]!.volume;
  }
  const vwma20 = vv === 0 ? NaN : pv / vv;

  // Stochastic
  const kAt = (c: number): number => {
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = c - 13; k <= c; k++) {
      if (candles[k]!.high > hi) hi = candles[k]!.high;
      if (candles[k]!.low < lo) lo = candles[k]!.low;
    }
    return hi === lo ? 50 : ((closes[c]! - lo) / (hi - lo)) * 100;
  };
  const k = kAt(i);
  const stoch: StochResult = { k, d: (k + kAt(i - 1) + kAt(i - 2)) / 3 };

  // CCI(20)
  let tpMean = 0;
  for (let c = i - 19; c <= i; c++) tpMean += (candles[c]!.high + candles[c]!.low + candles[c]!.close) / 3;
  tpMean /= 20;
  let meanDev = 0;
  for (let c = i - 19; c <= i; c++) meanDev += Math.abs((candles[c]!.high + candles[c]!.low + candles[c]!.close) / 3 - tpMean);
  meanDev /= 20;
  const tpLast = (candles[i]!.high + candles[i]!.low + candles[i]!.close) / 3;
  const cci20 = meanDev === 0 ? 0 : (tpLast - tpMean) / (0.015 * meanDev);

  // Williams %R(14)
  let whi = -Infinity;
  let wlo = Infinity;
  for (let c = i - 13; c <= i; c++) {
    if (candles[c]!.high > whi) whi = candles[c]!.high;
    if (candles[c]!.low < wlo) wlo = candles[c]!.low;
  }
  const williamsR14 = whi === wlo ? -50 : ((whi - lastClose) / (whi - wlo)) * -100;

  // Awesome (sma5 - sma34 do median) — usa as séries pré-computadas (mesma soma corrente do scalar)
  const awesome = base.medianSma5[i]! - base.medianSma34[i]!;

  // MFI(14)
  const tp = (c: number): number => (candles[c]!.high + candles[c]!.low + candles[c]!.close) / 3;
  let pos = 0;
  let neg = 0;
  for (let c = i - 13; c <= i; c++) {
    const rmf = tp(c) * candles[c]!.volume;
    if (tp(c) > tp(c - 1)) pos += rmf;
    else if (tp(c) < tp(c - 1)) neg += rmf;
  }
  const mfi14 = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg);

  // ROC(14)
  const prevRoc = closes[i - 14]!;
  const roc14 = prevRoc === 0 ? 0 : ((lastClose - prevRoc) / prevRoc) * 100;

  // Supertrend (ATR10)
  const atr10 = base.atr10[i - 1] ?? NaN;
  const hl2 = (candles[i]!.high + candles[i]!.low) / 2;
  const supertrend: SupertrendResult = lastClose > hl2
    ? { value: hl2 - 3 * atr10, trend: "up" }
    : { value: hl2 + 3 * atr10, trend: "down" };

  // Bollinger(20)
  const slice = closes.slice(i - 19, i + 1);
  let mid = 0;
  for (const v of slice) mid += v;
  mid /= 20;
  const sd = stdevPopulation(slice);
  const bollinger: BollingerResult = {
    upper: mid + 2 * sd, middle: mid, lower: mid - 2 * sd, bandwidth: mid === 0 ? NaN : (4 * sd) / mid,
  };

  // OBV slope
  const window = Math.min(20, Math.floor((i + 1) / 2));
  const recent = windowMean(base.obv, i - window + 1, i);
  const older = windowMean(base.obv, i - 2 * window + 1, i - window);
  const obv: ObvResult = { current: base.obv[i]!, slope: older === 0 ? 0 : ((recent - older) / Math.abs(older)) * 100 };

  // CMF(20)
  let mfv = 0;
  let vol = 0;
  for (let c = i - 19; c <= i; c++) {
    const cc = candles[c]!;
    const denom = cc.high - cc.low;
    const mult = denom === 0 ? 0 : (cc.close - cc.low - (cc.high - cc.close)) / denom;
    mfv += mult * cc.volume;
    vol += cc.volume;
  }
  const cmf20 = vol === 0 ? 0 : mfv / vol;

  return {
    lastClose,
    ema20: base.ema20[i]!, ema50: base.ema50[i]!, ema200: base.ema200[i]!, sma50: base.sma50[i]!,
    vwma20,
    rsi14: base.rsi14[i]!,
    macd: base.macd[i]!,
    stoch, cci20, williamsR14, awesome, mfi14, roc14,
    adx14: base.adx14[i]!,
    supertrend,
    trix14: base.trix14[i]!,
    bollinger,
    atr14: base.atr14[i - 1] ?? NaN,
    obv, cmf20,
  };
}

/** RegimeInfo em `i` — idêntico a computeMarketRegime(candles.slice(0,i+1)). */
export function regimeAt(i: number, base: PrecomputedBase, config: EngineConfig): RegimeInfo {
  const atrCurrent = base.atr14[i - 1] ?? NaN;
  const validCount = i - 13; // entradas válidas de atr14: índices 13..i-1
  const window = Math.min(50, validCount);
  let atrAvg = atrCurrent;
  if (window > 0) atrAvg = windowMean(base.atr14, i - window, i - 1);
  const atrRatio = atrAvg > 0 ? atrCurrent / atrAvg : 1;
  const adxValue = base.adx14[i]!.adx;

  let regime: MarketRegime;
  if (atrRatio >= config.regime.atrExplosiveRatio) regime = "explosive";
  else if (adxValue >= config.regime.adxTrending) regime = "trending";
  else if (adxValue < config.regime.adxRanging) regime = "ranging";
  else regime = "transitional";

  return { regime, adxValue, atrCurrent, atrAvg, atrRatio };
}

export interface AnalysisAt {
  signal: SignalOutput;
  risk: RiskOutput;
  regime: MarketRegime;
}

/** Equivalente incremental de runAnalysis, restrito ao que o backtest precisa. */
export function runAnalysisAt(
  candles: Candle[],
  i: number,
  base: PrecomputedBase,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): AnalysisAt {
  const values = indicatorValuesAt(candles, i, base);
  const indicators = buildIndicatorResults(values, config);
  const regimeInfo = regimeAt(i, base, config);
  const baseSignal = config.signal.conditionalByRegime
    ? computeConditionalSignal(values, regimeInfo.regime, config)
    : computeSignal(indicators, config, regimeInfo.regime);
  const baseRisk = computeRiskFrom(values.lastClose, base.atr14[i - 1] ?? NaN, baseSignal.signal, config);

  const volWindow = candles.slice(Math.max(0, i - 29), i + 1);
  const gates = computeGates(volWindow, baseSignal, indicators, baseRisk, regimeInfo, config);

  let signal = baseSignal;
  let risk = baseRisk;
  const criticalFail = gates.some((g) => !g.passed && (CRITICAL_GATE_IDS as readonly string[]).includes(g.id));
  if (criticalFail && baseSignal.signal !== "NEUTRAL") {
    const dg = downgrade(baseSignal.signal);
    signal = { ...baseSignal, signal: dg, strength: Math.min(baseSignal.strength, 50) };
    if (dg === "NEUTRAL") risk = neutralRisk(values.lastClose);
  }

  return { signal, risk, regime: regimeInfo.regime };
}
