import { describe, expect, it, vi } from "vitest";
import type { Candle } from "@tradeai/shared";
import { getCandles, type CandleProviders } from "./providers";
import { InMemoryCacheStore } from "./cache";

function fakeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({ time: i * 1000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }));
}

describe("getCandles — fallback e cache", () => {
  it("crypto usa Binance e popula o cache", async () => {
    const binance = vi.fn().mockResolvedValue(fakeCandles(100));
    const cache = new InMemoryCacheStore(() => 1000);
    const deps = { providers: { binance } as CandleProviders, cache, minCandles: 60 };

    const a = await getCandles("BTCUSDT", "crypto", "1h", 100, deps);
    expect(a).toHaveLength(100);
    expect(binance).toHaveBeenCalledTimes(1);

    // segunda chamada → cache hit (binance não é chamado de novo)
    const b = await getCandles("BTCUSDT", "crypto", "1h", 100, deps);
    expect(b).toHaveLength(100);
    expect(binance).toHaveBeenCalledTimes(1);
  });

  it("crypto: Binance falha → cai pro Yahoo", async () => {
    const binance = vi.fn().mockRejectedValue(new Error("binance down"));
    const yahoo = vi.fn().mockResolvedValue(fakeCandles(80));
    const got = await getCandles("ETHUSDT", "crypto", "4h", 100, { providers: { binance, yahoo }, minCandles: 60 });
    expect(got).toHaveLength(80);
    expect(yahoo).toHaveBeenCalledTimes(1);
  });

  it("forex: TwelveData insuficiente → fallback Yahoo", async () => {
    const twelvedata = vi.fn().mockResolvedValue(fakeCandles(10)); // < min
    const yahoo = vi.fn().mockResolvedValue(fakeCandles(90));
    const got = await getCandles("EURUSD", "forex", "1h", 100, { providers: { twelvedata, yahoo }, minCandles: 60 });
    expect(got).toHaveLength(90);
    expect(twelvedata).toHaveBeenCalledTimes(1);
    expect(yahoo).toHaveBeenCalledTimes(1);
  });

  it("todos falham → lança erro descritivo", async () => {
    const twelvedata = vi.fn().mockRejectedValue(new Error("td down"));
    const yahoo = vi.fn().mockRejectedValue(new Error("yahoo down"));
    await expect(
      getCandles("AAPL", "stocks", "1d", 100, { providers: { twelvedata, yahoo }, minCandles: 60 }),
    ).rejects.toThrow(/Sem dados de mercado/);
  });
});
