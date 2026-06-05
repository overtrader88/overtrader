/**
 * Orquestração de dados de mercado: cache → provedor primário → fallback.
 *
 * Os fetchers são INJETÁVEIS (testáveis sem rede). `realProviders()` liga os
 * fetchers de verdade (Binance sem chave; TwelveData precisa de chave —
 * plug-point; Yahoo gratuito) com retry + timeout.
 *
 * Cadeia por classe de ativo:
 *   - crypto  → Binance, fallback Yahoo
 *   - demais  → TwelveData, fallback Yahoo
 */
import type { AssetType, Candle, Timeframe } from "@tradeai/shared";
import { withRetry, isRetryableStatus } from "../http/with-retry";
import { withTimeout } from "../http/with-timeout";
import type { CacheStore } from "./cache";
import {
  BINANCE_INTERVAL, TWELVEDATA_INTERVAL, YAHOO_INTERVAL,
  binanceSymbol, twelveDataSymbol, yahooSymbol,
} from "./symbols";
import { parseBinanceKlines, parseTwelveData, parseYahooChart } from "./parse";
import { fetchBinanceHistory } from "./history";

export interface CandleProviders {
  binance?: (symbol: string, tf: Timeframe, limit: number) => Promise<Candle[]>;
  twelvedata?: (symbol: string, assetType: AssetType, tf: Timeframe, limit: number) => Promise<Candle[]>;
  yahoo?: (symbol: string, assetType: AssetType, tf: Timeframe, limit: number) => Promise<Candle[]>;
}

export interface GetCandlesDeps {
  providers: CandleProviders;
  cache?: CacheStore;
  cacheTtlSeconds?: number;
  /** Mínimo de candles para aceitar a resposta de um provedor. */
  minCandles?: number;
}

export async function getCandles(
  symbol: string,
  assetType: AssetType,
  timeframe: Timeframe,
  limit: number,
  deps: GetCandlesDeps,
): Promise<Candle[]> {
  const min = deps.minCandles ?? 60;
  const ttl = deps.cacheTtlSeconds ?? 60;
  const key = `${assetType}:${symbol}:${timeframe}:${limit}`;

  if (deps.cache) {
    const cached = await deps.cache.get(key);
    if (cached && cached.length >= min) return cached;
  }

  const p = deps.providers;
  const attempts: Array<() => Promise<Candle[]>> = [];
  if (assetType === "crypto") {
    if (p.binance) attempts.push(() => p.binance!(symbol, timeframe, limit));
    if (p.yahoo) attempts.push(() => p.yahoo!(symbol, assetType, timeframe, limit));
  } else {
    if (p.twelvedata) attempts.push(() => p.twelvedata!(symbol, assetType, timeframe, limit));
    if (p.yahoo) attempts.push(() => p.yahoo!(symbol, assetType, timeframe, limit));
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const candles = await attempt();
      if (candles.length >= min) {
        await deps.cache?.set(key, candles, ttl);
        return candles;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Sem dados de mercado suficientes para ${symbol} ${timeframe}` +
      (lastError instanceof Error ? ` (último erro: ${lastError.message})` : ""),
  );
}

// ---------- fetchers reais (rede em runtime; injetáveis nos testes) ----------

type FetchImpl = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface RealProvidersOptions {
  twelveDataKey?: string;
  fetchImpl?: FetchImpl;
  timeoutMs?: number;
  attempts?: number;
}

async function fetchJson(url: string, fetchImpl: FetchImpl, timeoutMs: number, attempts: number): Promise<unknown> {
  return withRetry(
    async () => {
      const res = await withTimeout(fetchImpl(url), timeoutMs);
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`) as Error & { status?: number };
        e.status = res.status;
        throw e;
      }
      return res.json();
    },
    { attempts, shouldRetry: (e) => isRetryableStatus((e as { status?: number }).status ?? 0) },
  );
}

export function realProviders(options: RealProvidersOptions = {}): CandleProviders {
  const fetchImpl = options.fetchImpl ?? ((url: string) => fetch(url));
  const timeoutMs = options.timeoutMs ?? 12000;
  const attempts = options.attempts ?? 3;
  const key = options.twelveDataKey;

  return {
    binance: async (symbol, tf, limit) => {
      // Acima de 1000, a Binance exige paginação (endTime) — reusa o histórico longo.
      if (limit > 1000) {
        return fetchBinanceHistory(symbol, tf, limit, (u) => fetchJson(u, fetchImpl, timeoutMs, attempts));
      }
      const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol(symbol)}&interval=${BINANCE_INTERVAL[tf]}&limit=${limit}`;
      return parseBinanceKlines(await fetchJson(url, fetchImpl, timeoutMs, attempts));
    },
    twelvedata: async (symbol, assetType, tf, limit) => {
      if (!key) throw new Error("TWELVEDATA_API_KEY ausente"); // → cai no fallback Yahoo
      const sym = encodeURIComponent(twelveDataSymbol(symbol, assetType));
      const url = `https://api.twelvedata.com/time_series?symbol=${sym}&interval=${TWELVEDATA_INTERVAL[tf]}&outputsize=${limit}&apikey=${key}`;
      return parseTwelveData(await fetchJson(url, fetchImpl, timeoutMs, attempts));
    },
    yahoo: async (symbol, assetType, tf, limit) => {
      const sym = encodeURIComponent(yahooSymbol(symbol, assetType));
      // TFs altos puxam janela longa (selo precisa de amostra); intraday o Yahoo limita de qualquer forma.
      const range = tf === "1d" || tf === "1w" || tf === "1M" ? "10y" : "2y";
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${YAHOO_INTERVAL[tf]}&range=${range}`;
      const candles = parseYahooChart(await fetchJson(url, fetchImpl, timeoutMs, attempts));
      return candles.slice(-limit);
    },
  };
}
