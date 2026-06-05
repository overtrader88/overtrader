import { describe, expect, it } from "vitest";
import { fetchBinanceHistory } from "./history";

const STEP = 3_600_000; // 1h

/** Histórico sintético completo (ascendente). */
function fullHistory(n: number, startTime = 1_600_000_000_000): Array<[number, string, string, string, string, string]> {
  return Array.from({ length: n }, (_, i) => {
    const t = startTime + i * STEP;
    return [t, "100", "101", "99", "100.5", "10"] as [number, string, string, string, string, string];
  });
}

/** fetchJson fake que simula a Binance: respeita endTime e limit, retorna ascendente. */
function fakeBinance(full: Array<[number, string, string, string, string, string]>) {
  return (url: string): Promise<unknown> => {
    const u = new URL(url);
    const limit = Number(u.searchParams.get("limit") ?? "1000");
    const endTime = u.searchParams.get("endTime") ? Number(u.searchParams.get("endTime")) : undefined;
    let pool = full;
    if (endTime !== undefined) pool = full.filter((r) => r[0] <= endTime);
    const page = pool.slice(-limit); // os `limit` mais recentes <= endTime, ascendente
    return Promise.resolve(page);
  };
}

describe("fetchBinanceHistory — paginação", () => {
  it("acumula além de 1000 candles via paginação", async () => {
    const full = fullHistory(2500);
    const out = await fetchBinanceHistory("BTCUSDT", "1h", 2500, fakeBinance(full));
    expect(out).toHaveLength(2500);
    // ascendente e sem duplicatas
    for (let i = 1; i < out.length; i++) expect(out[i]!.time).toBeGreaterThan(out[i - 1]!.time);
    expect(new Set(out.map((c) => c.time)).size).toBe(2500);
  });

  it("para quando o histórico acaba (retorna o que existe)", async () => {
    const full = fullHistory(700);
    const out = await fetchBinanceHistory("BTCUSDT", "1h", 5000, fakeBinance(full));
    expect(out).toHaveLength(700);
  });

  it("respeita o teto `total` (mais recentes)", async () => {
    const full = fullHistory(3000);
    const out = await fetchBinanceHistory("BTCUSDT", "1h", 1500, fakeBinance(full));
    expect(out).toHaveLength(1500);
    expect(out[out.length - 1]!.time).toBe(full[full.length - 1]![0]); // termina no candle mais novo
  });
});
