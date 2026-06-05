/**
 * Cache compartilhado de dados de mercado.
 *
 * Estrategia: chave determinista (asset+tf+limit) -> JSONB no Supabase.
 * Multiplos usuarios consultando o mesmo (asset, tf) recebem o cache em vez
 * de chamadas duplicadas a TD/Binance/Yahoo.
 *
 * TTLs configurados conforme volatilidade do timeframe:
 *   - 15m : 2 min
 *   - 1h  : 5 min
 *   - 4h  : 15 min
 *   - 1d  : 60 min
 *   - 1w  : 6 horas
 *   - 1M  : 24 horas
 *
 * Tickers (sem timeframe): 60s
 *
 * Implementacao usa service_role pra bypassar RLS — cache e dado publico
 * (nao tem informacao pessoal).
 */
import { createServiceClient } from "@/lib/supabase/service";
import type { Candle, Ticker, Timeframe } from "./types";

/** TTL em segundos por timeframe */
const TTL_BY_TIMEFRAME: Record<Timeframe, number> = {
  "15m": 2 * 60,
  "1h": 5 * 60,
  "4h": 15 * 60,
  "1d": 60 * 60,
  "1w": 6 * 60 * 60,
  "1M": 24 * 60 * 60,
};

const TICKER_TTL_SECONDS = 60;

/**
 * Tenta servir candles do cache. Se nao tiver ou estiver expirado, chama o
 * fetcher (Binance/TwelveData/Yahoo) e salva o resultado pra proximas chamadas.
 */
export async function getCachedCandles(
  asset: string,
  timeframe: Timeframe,
  limit: number,
  fetcher: () => Promise<{ candles: Candle[]; provider: string }>
): Promise<Candle[]> {
  const key = `candles:${asset}:${timeframe}:${limit}`;
  const ttl = TTL_BY_TIMEFRAME[timeframe] ?? 5 * 60;

  // 1) Tenta cache
  try {
    const supabase = createServiceClient();
    const { data: cached } = await supabase
      .from("market_cache")
      .select("value, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (
      cached &&
      cached.expires_at &&
      new Date(cached.expires_at).getTime() > Date.now()
    ) {
      // Cache hit
      return cached.value as Candle[];
    }
  } catch (err) {
    console.warn("[market-cache] erro ao ler cache, fallback pra fetcher:", err);
    // segue pro fetcher
  }

  // 2) Cache miss — chama fetcher
  const { candles, provider } = await fetcher();

  // 3) Salva no cache (best-effort, nao bloqueia a resposta)
  saveCache(key, candles, ttl, provider).catch((err) => {
    console.warn("[market-cache] erro ao salvar cache:", err);
  });

  return candles;
}

/**
 * Versao pra tickers (sem timeframe). TTL fixo de 60s.
 */
export async function getCachedTicker(
  asset: string,
  fetcher: () => Promise<{ ticker: Ticker; provider: string }>
): Promise<Ticker> {
  const key = `ticker:${asset}`;

  try {
    const supabase = createServiceClient();
    const { data: cached } = await supabase
      .from("market_cache")
      .select("value, expires_at")
      .eq("key", key)
      .maybeSingle();

    if (
      cached &&
      cached.expires_at &&
      new Date(cached.expires_at).getTime() > Date.now()
    ) {
      return cached.value as Ticker;
    }
  } catch (err) {
    console.warn("[market-cache] erro ao ler cache ticker, fallback:", err);
  }

  const { ticker, provider } = await fetcher();
  saveCache(key, ticker, TICKER_TTL_SECONDS, provider).catch(() => {});
  return ticker;
}

/**
 * Salva no cache com upsert (se ja existir, sobrescreve).
 */
async function saveCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
  provider: string
): Promise<void> {
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  await supabase.from("market_cache").upsert(
    {
      key,
      value: value as never,
      expires_at: expiresAt,
      provider,
    },
    { onConflict: "key" }
  );
}

/**
 * Limpa cache expirado (chama o RPC cleanup_market_cache).
 * Util pra rodar periodicamente via cron job.
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.rpc("cleanup_market_cache");
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.warn("[market-cache] erro no cleanup:", err);
    return 0;
  }
}
