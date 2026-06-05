/**
 * Fetcher unificado com cache compartilhado + fallback automatico.
 *
 * Fluxo:
 *   1. Tenta cache (Supabase market_cache)
 *   2. Cache miss → cripto vai pra Binance, demais vao pra TwelveData
 *   3. Se TwelveData falha (rate limit, simbolo nao coberto) → fallback Yahoo
 *   4. Salva resultado no cache pra proximas chamadas
 *
 * Resultado: usuarios diferentes consultando o mesmo (asset, tf) compartilham
 * resposta. Reducao tipica de 90% no consumo de TD em horarios de pico.
 */
import { getAsset } from "./catalog";
import { fetchBinanceCandles, fetchBinanceTicker } from "./binance";
import { fetchTwelveCandles, fetchTwelveTicker } from "./twelvedata";
import {
  fetchYahooCandles,
  fetchYahooTicker,
  toYahooSymbol,
} from "./yahoo";
import { getCachedCandles, getCachedTicker } from "./cache";
import type { Candle, Ticker, Timeframe } from "./types";

export type * from "./types";
export * from "./catalog";

export async function getCandles(
  symbol: string,
  timeframe: Timeframe,
  limit = 300
): Promise<Candle[]> {
  const asset = getAsset(symbol);
  if (!asset) throw new Error(`Ativo não suportado: ${symbol}`);

  return getCachedCandles(symbol, timeframe, limit, async () => {
    switch (asset.type) {
      case "crypto": {
        // Binance: rapido, gratis, ilimitado. Sem fallback necessario.
        const candles = await fetchBinanceCandles(
          asset.sourceSymbol,
          timeframe,
          limit
        );
        return { candles, provider: "binance" };
      }

      case "forex":
      case "stocks":
      case "indices":
      case "commodities": {
        // Tenta TwelveData primeiro
        try {
          const candles = await fetchTwelveCandles(
            asset.sourceSymbol,
            timeframe,
            limit
          );
          if (candles.length >= 60) {
            return { candles, provider: "twelvedata" };
          }
          throw new Error(
            `TwelveData retornou apenas ${candles.length} candles`
          );
        } catch (tdErr) {
          // Fallback automatico pra Yahoo
          console.warn(
            `[market] TD falhou pra ${symbol}, tentando Yahoo:`,
            tdErr instanceof Error ? tdErr.message : tdErr
          );
          const yahooSymbol = toYahooSymbol(symbol, asset.type);
          const candles = await fetchYahooCandles(
            yahooSymbol,
            timeframe,
            limit
          );
          return { candles, provider: "yahoo" };
        }
      }

      default:
        throw new Error(`Tipo de ativo ainda não suportado: ${asset.type}`);
    }
  });
}

export async function getTicker(symbol: string): Promise<Ticker> {
  const asset = getAsset(symbol);
  if (!asset) throw new Error(`Ativo não suportado: ${symbol}`);

  return getCachedTicker(symbol, async () => {
    switch (asset.type) {
      case "crypto": {
        const ticker = await fetchBinanceTicker(asset.sourceSymbol);
        return { ticker, provider: "binance" };
      }

      case "forex":
      case "stocks":
      case "indices":
      case "commodities": {
        try {
          const ticker = await fetchTwelveTicker(asset.sourceSymbol);
          return { ticker, provider: "twelvedata" };
        } catch (tdErr) {
          console.warn(
            `[market] TD ticker falhou pra ${symbol}, tentando Yahoo:`,
            tdErr instanceof Error ? tdErr.message : tdErr
          );
          const yahooSymbol = toYahooSymbol(symbol, asset.type);
          const ticker = await fetchYahooTicker(yahooSymbol);
          return { ticker, provider: "yahoo" };
        }
      }

      default:
        throw new Error(`Tipo de ativo ainda não suportado: ${asset.type}`);
    }
  });
}
