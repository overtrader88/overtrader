/**
 * Parsers PUROS payload-do-provedor → Candle[]. Sem rede; 100% testável.
 * Normalizam tudo para candles ascendentes (mais antigo → mais novo), em ms.
 */
import type { Candle } from "@tradeai/shared";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Binance klines: array de arrays [openTime, open, high, low, close, volume, ...]. */
export function parseBinanceKlines(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) return [];
  const out: Candle[] = [];
  for (const row of payload) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const c: Candle = {
      time: num(row[0]),
      open: num(row[1]),
      high: num(row[2]),
      low: num(row[3]),
      close: num(row[4]),
      volume: num(row[5]),
    };
    if (![c.time, c.open, c.high, c.low, c.close].some(Number.isNaN)) out.push(c);
  }
  return out; // Binance já vem ascendente
}

interface TwelveDataValue {
  datetime?: string;
  open?: string | number;
  high?: string | number;
  low?: string | number;
  close?: string | number;
  volume?: string | number;
}

/** TwelveData time_series: { values: [...], status }. `values` vem do mais novo → reverte. */
export function parseTwelveData(payload: unknown): Candle[] {
  const p = payload as { values?: TwelveDataValue[]; status?: string } | null;
  if (!p || !Array.isArray(p.values)) return [];
  const out: Candle[] = [];
  for (const v of p.values) {
    const time = v.datetime ? Date.parse(v.datetime.replace(" ", "T") + "Z") : NaN;
    const c: Candle = {
      time,
      open: num(v.open),
      high: num(v.high),
      low: num(v.low),
      close: num(v.close),
      volume: v.volume === undefined ? 0 : num(v.volume),
    };
    if (![c.time, c.open, c.high, c.low, c.close].some(Number.isNaN)) out.push(c);
  }
  out.sort((a, b) => a.time - b.time); // ascendente
  return out;
}

interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }> };
    }>;
  };
}

/** Yahoo chart v8: timestamps (s) + indicators.quote[0]. Pula candles com null. */
export function parseYahooChart(payload: unknown): Candle[] {
  const p = payload as YahooChart | null;
  const res = p?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  const ts = res?.timestamp;
  if (!res || !q || !Array.isArray(ts)) return [];
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const cl = q.close?.[i];
    if (o == null || h == null || l == null || cl == null) continue;
    out.push({
      time: ts[i]! * 1000,
      open: o, high: h, low: l, close: cl,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return out; // Yahoo já vem ascendente
}
