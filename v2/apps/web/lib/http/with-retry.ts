/**
 * Retry com backoff exponencial + jitter. Resolve a falta de retry do v1
 * (OpenAI/TwelveData falhavam em 429/5xx sem nova tentativa).
 *
 * `shouldRetry` decide se o erro é retentável (default: sempre). Para HTTP,
 * passe algo como `(e) => isRetryableStatus(e.status)`.
 */
export interface RetryOptions {
  /** Número máximo de tentativas (incluindo a primeira). Default 3. */
  attempts?: number;
  /** Atraso base em ms (cresce exponencialmente). Default 300. */
  baseDelayMs?: number;
  /** Teto do atraso em ms. Default 5000. */
  maxDelayMs?: number;
  /** Decide se um erro deve ser retentado. Default: todos. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Fonte de aleatoriedade do jitter (injetável p/ testes). Default Math.random. */
  random?: () => number;
  /** Sleep injetável (p/ testes determinísticos). Default setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) break;
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = exp * 0.5 * random();
      await sleep(exp * 0.5 + jitter);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Status HTTP geralmente retentáveis. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}
