/**
 * Cache de candles. Interface + impl em memória (testada). A impl de produção
 * (`SupabaseCacheStore`, tabela `market_cache`) é um plug-point do M4 — entra
 * quando o service client estiver ligado.
 */
import type { Candle } from "@tradeai/shared";

export interface CacheStore {
  get(key: string): Promise<Candle[] | null>;
  set(key: string, candles: Candle[], ttlSeconds: number): Promise<void>;
}

interface Entry {
  candles: Candle[];
  expiresAt: number;
}

/** Em memória (dev/teste/single-instance). `now` injetável. */
export class InMemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, Entry>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  get(key: string): Promise<Candle[] | null> {
    const e = this.map.get(key);
    if (!e || this.now() >= e.expiresAt) {
      if (e) this.map.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(e.candles);
  }

  set(key: string, candles: Candle[], ttlSeconds: number): Promise<void> {
    this.map.set(key, { candles, expiresAt: this.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }
}

// TODO(M4): SupabaseCacheStore — get/set na tabela `market_cache` via service
// client, com `expires_at`. Limpeza via RPC `cleanup_market_cache` (já no schema).
