/**
 * Cliente Twelve Data (Forex).
 * Free tier: 800 req/dia, 8 req/min.
 * Doc: https://twelvedata.com/docs
 */
import type { Candle, Ticker, Timeframe } from "./types";

const BASE = "https://api.twelvedata.com";

const TIMEFRAME_MAP: Record<Timeframe, string> = {
  "15m": "15min",
  "1h":  "1h",
  "4h":  "4h",
  "1d":  "1day",
  "1w":  "1week",
  "1M":  "1month",
};

function apiKey(): string {
  const k = process.env.TWELVEDATA_API_KEY;
  if (!k) {
    throw new Error(
      "TWELVEDATA_API_KEY não configurado. Cadastre-se em https://twelvedata.com (free tier) e adicione ao .env.local."
    );
  }
  return k;
}

interface TwelveTimeSeriesResp {
  status?: string;
  message?: string;
  values?: Array<{
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume?: string;
  }>;
}

interface TwelveQuoteResp {
  status?: string;
  message?: string;
  symbol?: string;
  close?: string;
  percent_change?: string;
  high?: string;
  low?: string;
  timestamp?: number;
}

export async function fetchTwelveCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 300
): Promise<Candle[]> {
  const tf = TIMEFRAME_MAP[timeframe];
  const url = new URL(`${BASE}/time_series`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", tf);
  url.searchParams.set("outputsize", String(limit));
  url.searchParams.set("apikey", apiKey());
  url.searchParams.set("format", "JSON");

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`TwelveData candles: HTTP ${res.status}`);

  const data = (await res.json()) as TwelveTimeSeriesResp;
  if (data.status === "error" || !data.values) {
    throw new Error(`TwelveData candles: ${data.message ?? "resposta inválida"}`);
  }

  // Twelve Data retorna do mais recente pro mais antigo - invertemos
  return data.values
    .map((v) => ({
      time: new Date(v.datetime + "Z").getTime(),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0,
    }))
    .reverse();
}

export async function fetchTwelveTicker(symbol: string): Promise<Ticker> {
  const url = new URL(`${BASE}/quote`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey());
  url.searchParams.set("format", "JSON");

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`TwelveData quote: HTTP ${res.status}`);

  const data = (await res.json()) as TwelveQuoteResp;
  if (data.status === "error" || !data.close) {
    throw new Error(`TwelveData quote: ${data.message ?? "resposta inválida"}`);
  }

  return {
    symbol: data.symbol ?? symbol,
    price: parseFloat(data.close),
    changePercent24h: data.percent_change ? parseFloat(data.percent_change) : 0,
    high24h: data.high ? parseFloat(data.high) : 0,
    low24h: data.low ? parseFloat(data.low) : 0,
    timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
  };
}
