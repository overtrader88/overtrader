import { describe, it, expect } from "vitest";
import { syntheticCandles, resolveLifecycle } from "@tradeai/engine";
import type { Candle, Timeframe } from "@tradeai/shared";
import type { CandleProviders } from "@/lib/market/providers";
import { runSimulation, truncateClosed, SIM_MAX_DURATION, SIM_PAST_CHART } from "./service";

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("truncateClosed — a garantia anti-lookahead", () => {
  const mk = (times: number[]): Candle[] => times.map((t) => ({ time: t, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }));

  it("só inclui candles cujo FECHAMENTO é comprovado pelo próximo candle", () => {
    const c = mk([0, 100, 200, 300, 400]);
    // corte em 250: o candle 200 ainda estava vivo (o próximo abre em 300 > 250)
    expect(truncateClosed(c, 250).map((x) => x.time)).toEqual([0, 100]);
    // corte exatamente na abertura seguinte: o candle 200 acabou de fechar → entra
    expect(truncateClosed(c, 300).map((x) => x.time)).toEqual([0, 100, 200]);
  });

  it("o último candle da série nunca entra (fechamento desconhecido)", () => {
    const c = mk([0, 100, 200]);
    expect(truncateClosed(c, 999_999).map((x) => x.time)).toEqual([0, 100]);
  });

  it("corte antes do início → vazio; série vazia → vazio", () => {
    const c = mk([500, 600, 700]);
    expect(truncateClosed(c, 100)).toEqual([]);
    expect(truncateClosed([], 100)).toEqual([]);
  });

  it("propriedade: nenhum candle incluído abre no corte ou depois", () => {
    const c = mk(Array.from({ length: 50 }, (_, i) => i * 60_000));
    for (const cutoff of [0, 61_000, 1_500_000, 2_940_000, 10_000_000]) {
      for (const x of truncateClosed(c, cutoff)) expect(x.time).toBeLessThan(cutoff);
    }
  });
});

describe("runSimulation", () => {
  // Séries determinísticas por TF, geradas UMA vez (o provider devolve sempre a mesma).
  const series = new Map<Timeframe, Candle[]>();
  const seriesFor = (tf: Timeframe): Candle[] => {
    let s = series.get(tf);
    if (!s) {
      s = syntheticCandles("crypto", tf, 700, 42);
      series.set(tf, s);
    }
    return s;
  };
  const providers: CandleProviders = {
    binance: async (_symbol, tf, limit) => seriesFor(tf).slice(-limit),
  };
  const deps = { providers, minCandles: 200 };
  const main = seriesFor("4h");
  // Corte no meio da série: dia do candle 400 (sobram ~300 candles de "futuro").
  const date = isoDay(main[400]!.time);
  const cutoffMs = Date.parse(`${date}T00:00:00Z`) + DAY_MS;

  it("nenhum candle do futuro vaza pra análise; futuro começa após o corte", async () => {
    const r = await runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date }, deps);
    expect(r.cutoffMs).toBe(cutoffMs);
    expect(r.pastCandles.length).toBeGreaterThan(0);
    for (const c of r.pastCandles) expect(c.time).toBeLessThan(cutoffMs);
    expect(r.futureCandles.length).toBeGreaterThan(0);
    expect(r.futureCandles.length).toBeLessThanOrEqual(SIM_MAX_DURATION);
    for (const c of r.futureCandles) expect(c.time).toBeGreaterThanOrEqual(cutoffMs);
    expect(r.pastTotal).toBeGreaterThanOrEqual(200);
    expect(r.pastCandles.length).toBeLessThanOrEqual(SIM_PAST_CHART);
  });

  it("o desfecho bate com resolveLifecycle rodado por fora (mesmo motor do track record)", async () => {
    const r = await runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date }, deps);
    if (r.plan) {
      expect(r.timeline).not.toBeNull();
      expect(r.timeline!.length).toBe(r.futureCandles.length);
      const independent = resolveLifecycle(r.plan, r.futureCandles, SIM_MAX_DURATION);
      expect(r.lifecycle).toEqual(independent);
      expect(r.timeline![r.timeline!.length - 1]).toEqual(independent);
      // timeline é prefixo-consistente: revelar k candles = resolver só com k candles
      const k = Math.min(5, r.futureCandles.length);
      expect(r.timeline![k - 1]).toEqual(resolveLifecycle(r.plan, r.futureCandles.slice(0, k), SIM_MAX_DURATION));
    } else {
      // motor neutro naquele dia → sem plano, sem timeline (e a UI mostra isso)
      expect(r.timeline).toBeNull();
      expect(r.lifecycle).toBeNull();
    }
  });

  it("é determinístico (mesma viagem → mesmo resultado)", async () => {
    const a = await runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date }, deps);
    const b = await runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date }, deps);
    expect(b).toEqual(a);
  });

  it("data cedo demais (sem 200 candles fechados antes) → erro orientando a data mínima", async () => {
    const tooEarly = isoDay(main[10]!.time);
    await expect(
      runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date: tooEarly }, deps),
    ).rejects.toThrow(/hist[óo]rico suficiente/i);
  });

  it("data sem candles depois (após o fim da série) → erro pedindo data mais antiga", async () => {
    const afterEnd = isoDay(main[main.length - 1]!.time + 30 * DAY_MS);
    await expect(
      runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date: afterEnd }, deps),
    ).rejects.toThrow(/mais antiga/i);
  });

  it("data mal formatada → erro claro", async () => {
    await expect(
      runSimulation({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", date: "31/12/2024" }, deps),
    ).rejects.toThrow(/AAAA-MM-DD/);
  });
});
