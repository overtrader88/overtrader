/**
 * SupabaseCacheStore — backing de produção do cache de candles na tabela
 * `market_cache` (service-role, ignora RLS). Substitui o TODO do M4.
 *
 * `getMarketCache()` escolhe o store: Supabase quando o service client existe,
 * senão um singleton em memória (dev/single-instance). Limpeza de expirados via
 * RPC `cleanup_market_cache` (já no schema, acionada por cron).
 */
import type { Candle } from "@tradeai/shared";
import type { CacheStore } from "./cache";
import { InMemoryCacheStore } from "./cache";
import { supabaseService } from "../supabase/server";

const TABLE = "market_cache";

export class SupabaseCacheStore implements CacheStore {
  async get(key: string): Promise<Candle[] | null> {
    const sb = supabaseService();
    if (!sb) return null;
    const { data, error } = await sb
      .from(TABLE)
      .select("value, expires_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;
    return data.value as Candle[];
  }

  async set(key: string, candles: Candle[], ttlSeconds: number): Promise<void> {
    const sb = supabaseService();
    if (!sb) return;
    const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await sb.from(TABLE).upsert({ key, value: candles, expires_at });
  }
}

let singleton: CacheStore | null = null;

/** Cache de mercado: Supabase se houver service-role; senão in-memory (dev). */
export function getMarketCache(): CacheStore {
  if (singleton) return singleton;
  singleton = supabaseService() ? new SupabaseCacheStore() : new InMemoryCacheStore();
  return singleton;
}
