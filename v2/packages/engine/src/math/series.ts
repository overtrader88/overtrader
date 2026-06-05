/**
 * Primitivos numéricos sobre séries — base reusada pelos indicadores.
 * Puros, sem dependências. Portados do v1 e endurecidos para `strict` +
 * `noUncheckedIndexedAccess`.
 *
 * Convenção: funções que retornam séries usam `NaN` nas posições sem dado
 * suficiente (warm-up), preservando o alinhamento de índice com a entrada.
 */
import type { Candle } from "@tradeai/shared";

/** Último elemento (lança se vazio — uso interno controlado). */
export function last<T>(arr: T[]): T {
  const v = arr[arr.length - 1];
  if (v === undefined) throw new Error("last() em array vazio");
  return v;
}

/** Média móvel simples. Série alinhada à entrada (NaN no warm-up). */
export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
}

/** EMA com seed = SMA dos N primeiros (convenção do v1, padrão de mercado). */
export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      let seed = 0;
      for (let j = 0; j < period; j++) seed += values[j]!;
      prev = seed / period;
      out.push(prev);
    } else if (i >= period) {
      prev = values[i]! * k + prev * (1 - k);
      out.push(prev);
    } else {
      out.push(NaN);
    }
  }
  return out;
}

/** Desvio-padrão populacional (denominador n) — usado em Bollinger. */
export function stdevPopulation(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  let m = 0;
  for (const v of values) m += v;
  m /= n;
  let acc = 0;
  for (const v of values) acc += (v - m) ** 2;
  return Math.sqrt(acc / n);
}

/** True Range candle a candle (comprimento = candles.length - 1). */
export function trueRanges(candles: Candle[]): number[] {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    trs.push(
      Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close),
      ),
    );
  }
  return trs;
}

/**
 * Série de ATR (Wilder) alinhada aos True Ranges. Permite obter o ATR em
 * QUALQUER posição em O(n) — usado pelo regime para a média rolling sem O(n²).
 * out[i] corresponde ao ATR após o TR de índice i.
 */
export function atrSeries(candles: Candle[], period = 14): number[] {
  const trs = trueRanges(candles);
  const out: number[] = new Array(trs.length).fill(NaN);
  if (trs.length < period) return out;
  let acc = 0;
  for (let i = 0; i < period; i++) acc += trs[i]!;
  let atr = acc / period;
  out[period - 1] = atr;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]!) / period;
    out[i] = atr;
  }
  return out;
}
