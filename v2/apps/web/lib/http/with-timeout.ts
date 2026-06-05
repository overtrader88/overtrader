/**
 * Envolve uma promise com timeout. Resolve o problema do v1 onde `getCandles`
 * podia pendurar o request se o provider travasse.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operação excedeu o timeout de ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}
