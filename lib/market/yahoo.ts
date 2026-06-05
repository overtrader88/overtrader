/**
 * Cliente Yahoo Finance (nao-oficial, gratuito, sem API key).
 *
 * Usado como FALLBACK quando TwelveData falha (rate limit, simbolo nao coberto
 * no free tier, etc). Yahoo cobre acoes US, indices, ETFs, alguns forex e
 * commodities com cotacoes praticamente em tempo real.
 *
 * Mapeamento de simbolos:
 *   - Acoes: igual TD (AAPL, MSFT, NVDA)
 *   - Indices: usa "^GSPC", "^IXIC", "^DJI" (estilo Yahoo)
 *   - Forex: "EURUSD=X", "GBPUSD=X" (sufixo =X)
 *   - Commodities: "GC=F" (Gold), "SI=F" (Silver), "CL=F" (WTI Oil)
 *
 * Endpoints usados:
 *   - chart:   /v8/finance/chart/<symbol>?interval=1h&range=3mo
 *   - quote:   /v7/finance/quote?symbols=AAPL,MSFT
 *
 * Risco: Yahoo pode mudar endpoints sem aviso (raro mas possivel).
 * Por isso e fallback, nao primario.
 */
import type { Candle, Ticker, Timeframe } from "./types";

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_QUOTE_BASE = "https://query1.finance.yahoo.com/v7/finance/quote";

const TIMEFRAME_MAP: Record<Timeframe, { interval: string; range: string }> = {
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "60m", range: "3mo" },
  "4h": { interval: "60m", range: "2y" }, // Yahoo nao tem 4h direto - usa 1h e agrega no client
  "1d": { interval: "1d", range: "5y" },
  "1w": { interval: "1wk", range: "10y" },
  "1M": { interval: "1mo", range: "max" },
};

/**
 * Converte nosso simbolo interno pro formato Yahoo
 */
export function toYahooSymbol(
  symbol: string,
  assetType: "crypto" | "forex" | "stocks" | "indices" | "commodities"
): string {
  switch (assetType) {
    case "stocks":
      return symbol; // AAPL, MSFT etc — formato igual
    case "indices": {
      const map: Record<string, string> = {
        SPY: "SPY", // ETF tambem funciona
        QQQ: "QQQ",
        DIA: "DIA",
        EWZ: "EWZ",
        SPX: "^GSPC",
        NDX: "^IXIC",
        DJI: "^DJI",
      };
      return map[symbol] ?? symbol;
    }
    case "forex":
      // EURUSD -> EURUSD=X
      return symbol.endsWith("=X") ? symbol : `${symbol}=X`;
    case "commodities": {
      const map: Record<string, string> = {
        XAUUSD: "GC=F", // Gold futures
        XAGUSD: "SI=F", // Silver futures
        WTIUSD: "CL=F", // Crude Oil WTI futures
        BRNUSD: "BZ=F", // Brent Crude futures
        XPTUSD: "PL=F", // Platinum futures
        XPDUSD: "PA=F", // Palladium futures
      };
      return map[symbol] ?? symbol;
    }
    case "crypto":
      // Yahoo usa BTC-USD em vez de BTCUSDT
      return symbol.replace(/USDT$/, "-USD").replace(/USD$/, "-USD");
  }
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { description?: string; code?: string };
  };
}

export async function fetchYahooCandles(
  yahooSymbol: string,
  timeframe: Timeframe,
  limit = 300
): Promise<Candle[]> {
  const { interval, range } = TIMEFRAME_MAP[timeframe];
  const url = new URL(`${YAHOO_CHART_BASE}/${yahooSymbol}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TradeAI-Bot/1.0; +https://tradeai.com.br)",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo chart: HTTP ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;

  if (data.chart?.error) {
    throw new Error(
      `Yahoo: ${data.chart.error.description ?? data.chart.error.code ?? "erro"}`
    );
  }

  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    throw new Error("Yahoo: sem dados de candle no resultado");
  }

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];

    // Yahoo as vezes manda null em candles incompletas — pula
    if (o == null || h == null || l == null || c == null) continue;

    candles.push({
      time: timestamps[i] * 1000,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v ?? 0,
    });
  }

  // Yahoo retorna ordem cronologica (antigo -> recente) — ja correto.
  // Limita aos ultimos N pra alinhar com o limit pedido.
  if (candles.length > limit) {
    return candles.slice(-limit);
  }

  // Para timeframe 4h: Yahoo nao tem nativo, agrega 4 candles 1h em 1 candle 4h
  if (timeframe === "4h") {
    return aggregateTo4h(candles);
  }

  return candles;
}

/**
 * Agrega candles 1h em candles 4h (Yahoo nao tem 4h nativo).
 */
function aggregateTo4h(candles1h: Candle[]): Candle[] {
  const result: Candle[] = [];
  for (let i = 0; i < candles1h.length; i += 4) {
    const slice = candles1h.slice(i, i + 4);
    if (slice.length === 0) break;
    result.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((sum, c) => sum + (c.volume ?? 0), 0),
    });
  }
  return result;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
      regularMarketDayHigh?: number;
      regularMarketDayLow?: number;
      regularMarketTime?: number;
    }>;
    error?: unknown;
  };
}

export async function fetchYahooTicker(yahooSymbol: string): Promise<Ticker> {
  const url = new URL(YAHOO_QUOTE_BASE);
  url.searchParams.set("symbols", yahooSymbol);

  const res = await fetch(url.toString(), {
    next: { revalidate: 30 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TradeAI-Bot/1.0; +https://tradeai.com.br)",
    },
  });

  if (!res.ok) throw new Error(`Yahoo quote: HTTP ${res.status}`);

  const data = (await res.json()) as YahooQuoteResponse;
  const q = data.quoteResponse?.result?.[0];

  if (!q || q.regularMarketPrice == null) {
    throw new Error("Yahoo quote: sem dados");
  }

  return {
    symbol: q.symbol ?? yahooSymbol,
    price: q.regularMarketPrice,
    changePercent24h: q.regularMarketChangePercent ?? 0,
    high24h: q.regularMarketDayHigh ?? 0,
    low24h: q.regularMarketDayLow ?? 0,
    timestamp: q.regularMarketTime ? q.regularMarketTime * 1000 : Date.now(),
  };
}
