/**
 * Rate limiting (janela fixa). Resolve a ausência total de rate limit do v1
 * em webhooks e admin — vetor de fraude e custo descontrolado de API.
 *
 * Decisão (blueprint §11): a implementação de produção será uma tabela
 * `rate_limits` no Supabase (sem serviço novo). Aqui fica a INTERFACE + uma
 * implementação em memória para dev/testes. A versão Supabase entra no M4.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Requisições restantes na janela atual. */
  remaining: number;
  /** Quando a janela reseta (epoch ms). */
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

export interface FixedWindowOptions {
  /** Máximo de requisições por janela. */
  limit: number;
  /** Tamanho da janela em ms. */
  windowMs: number;
  /** Relógio injetável (p/ testes). Default Date.now. */
  now?: () => number;
}

/**
 * Implementação em memória — apropriada para dev/teste e single-instance.
 * NÃO usar em produção serverless (estado não é compartilhado entre instâncias).
 * TODO(M4): `SupabaseRateLimiter` lendo/escrevendo na tabela `rate_limits`.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(options: FixedWindowOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  check(key: string): Promise<RateLimitResult> {
    const t = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || t >= bucket.resetAt) {
      const resetAt = t + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return Promise.resolve({ allowed: true, remaining: this.limit - 1, resetAt });
    }

    if (bucket.count >= this.limit) {
      return Promise.resolve({ allowed: false, remaining: 0, resetAt: bucket.resetAt });
    }

    bucket.count += 1;
    return Promise.resolve({
      allowed: true,
      remaining: this.limit - bucket.count,
      resetAt: bucket.resetAt,
    });
  }
}
