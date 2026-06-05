import { describe, expect, it, vi } from "vitest";
import { withTimeout, TimeoutError } from "./with-timeout";
import { withRetry, isRetryableStatus } from "./with-retry";
import { InMemoryRateLimiter } from "./rate-limit";

describe("withTimeout", () => {
  it("resolve antes do timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejeita com TimeoutError se estourar", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50));
    await expect(withTimeout(slow, 5)).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("withRetry", () => {
  const noSleep = (): Promise<void> => Promise.resolve();

  it("retorna no primeiro sucesso sem retentar", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retenta até o limite e então lança", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn, { attempts: 3, sleep: noSleep })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("para de retentar quando shouldRetry é false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(
      withRetry(fn, { attempts: 5, sleep: noSleep, shouldRetry: () => false }),
    ).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("isRetryableStatus cobre 429 e 5xx", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("InMemoryRateLimiter", () => {
  it("permite até o limite e bloqueia depois", async () => {
    const t = 1000;
    const limiter = new InMemoryRateLimiter({ limit: 2, windowMs: 100, now: () => t });
    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(false);
  });

  it("reseta após a janela", async () => {
    let t = 1000;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 100, now: () => t });
    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(false);
    t += 101;
    expect((await limiter.check("k")).allowed).toBe(true);
  });
});
