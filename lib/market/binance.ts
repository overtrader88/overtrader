/**
 * Cliente Binance público (sem auth).
 * Doc: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
import type { Candle, Ticker, Timeframe } from "./types";

const BASE = "https://api.binance.com";

const TIMEFRAME_MAP: Record<Timeframe, string> = {
  "15m": "15m",
  "1h":  "1h",
  "4h":  "4h",
  "1d":  "1d",
  "1w":  "1w",
  "1M":  "1M",  // ATENÇÃO: M maiúsculo = mensal; m minúsculo seria 1 minuto na Binance
};

interface BinanceKline {
  // [openTime, open, high, low, close, volume, closeTime, ...]
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string; 6: number;
}

export async function fetchBinanceCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 300
): Promise<Candle[]> {
  const tf = TIMEFRAME_MAP[timeframe];
  const url = `${BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${tf}&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 30 } });

  if (!res.ok) {
    throw new Error(`Binance klines: HTTP ${res.status}`);
  }

  const data = (await res.json()) as BinanceKline[];
  return data.map((k) => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchBinanceTicker(symbol: string): Promise<Ticker> {
  const url = `${BASE}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { next: { revalidate: 5 } });

  if (!res.ok) {
    throw new Error(`Binance ticker: HTTP ${res.status}`);
  }

  const t = await res.json() as {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    closeTime: number;
  };

  return {
    symbol: t.symbol,
    price: parseFloat(t.lastPrice),
    changePercent24h: parseFloat(t.priceChangePercent),
    high24h: parseFloat(t.highPrice),
    low24h: parseFloat(t.lowPrice),
    timestamp: t.closeTime,
  };
}
