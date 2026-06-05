import { describe, expect, it } from "vitest";
import { runBacktest } from "../src/backtest";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import type { AnalysisInput } from "../src/types";
import { seededWalk } from "./fixtures/candles";
import { periodsPerYear } from "../src/math/calendar";

function input(n: number, seed: number): AnalysisInput {
  return { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", candles: seededWalk(n, seed) };
}

describe("runBacktest", () => {
  it("é determinístico", () => {
    const a = runBacktest(input(400, 31), { strategy: "exit-tp1" });
    const b = runBacktest(input(400, 31), { strategy: "exit-tp1" });
    expect(a.totalTrades).toBe(b.totalTrades);
    expect(a.winRate.value).toBe(b.winRate.value);
    expect(a.profitFactor.value).toBe(b.profitFactor.value);
  });

  it("métricas vêm com IC válido", () => {
    const r = runBacktest(input(500, 32));
    expect(r.winRate.value).toBeGreaterThanOrEqual(0);
    expect(r.winRate.value).toBeLessThanOrEqual(1);
    expect(r.winRate.ci95[0]).toBeLessThanOrEqual(r.winRate.value);
    expect(r.winRate.ci95[1]).toBeGreaterThanOrEqual(r.winRate.value);
    expect(r.avgR.ci95[0]).toBeLessThanOrEqual(r.avgR.value);
  });

  it("não tem lookahead estrutural: saída sempre após a entrada, entrada após warm-up", () => {
    const r = runBacktest(input(600, 33));
    for (const t of r.trades) {
      expect(t.exitIndex).toBeGreaterThanOrEqual(t.entryIndex);
      expect(t.entryIndex).toBeGreaterThanOrEqual(200);
    }
  });

  it("reporta cobertura sem cap silencioso (truncated quando faltam dados)", () => {
    const r = runBacktest(input(400, 34));
    expect(r.candlesAvailable).toBe(400);
    expect(r.targetCandles).toBeGreaterThan(r.candlesScanned);
    expect(r.truncated).toBe(true);
  });

  it("sampleSufficient é baseado em trades DECISIVOS vs minDecisiveTrades", () => {
    const r = runBacktest(input(300, 35), { minDecisiveTrades: 1000 });
    expect(r.sampleSufficient).toBe(false); // alvo absurdo nunca é atingido
    expect(r.decisiveTrades).toBeLessThanOrEqual(r.totalTrades);
  });

  it("teto de calendário: baixa frequência (1d) usa janela maior; intraday segue a classe", () => {
    const walk = seededWalk(400, 9);
    const c4h = runBacktest({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", candles: walk });
    const s4h = runBacktest({ symbol: "AAPL", assetType: "stocks", timeframe: "4h", candles: walk });
    const c1d = runBacktest({ symbol: "BTCUSDT", assetType: "crypto", timeframe: "1d", candles: walk });
    // Intraday segue os meses da classe: volátil 24m (=2 anos), estacionário 36m (=3 anos).
    expect(c4h.targetCandles).toBe(Math.round(periodsPerYear("crypto", "4h") * 2));
    expect(s4h.targetCandles).toBe(Math.round(periodsPerYear("stocks", "4h") * 3));
    // 1d aplica o piso de baixa frequência (72m = 6 anos) p/ acumular trades decisivos.
    expect(c1d.targetCandles).toBe(Math.round(periodsPerYear("crypto", "1d") * 6));
    expect(c1d.targetCandles).toBeGreaterThan(Math.round(periodsPerYear("crypto", "1d") * 2));
  });

  it("segmenta por regime e calcula OOS com IC quando há amostra", () => {
    const r = runBacktest(input(800, 37));
    for (const m of Object.values(r.byRegime)) {
      expect(m!.n).toBeGreaterThan(0);
      expect(m!.winRate.value).toBeGreaterThanOrEqual(0);
      expect(m!.winRate.value).toBeLessThanOrEqual(1);
    }
    if (r.totalTrades >= 20) {
      expect(r.outOfSample).not.toBeNull();
      expect(r.outOfSample!.winRate.ci95[0]).toBeLessThanOrEqual(r.outOfSample!.winRate.value);
    }
  });

  it("retorna vazio com candles insuficientes", () => {
    const r = runBacktest(input(100, 36));
    expect(r.totalTrades).toBe(0);
    expect(r.byRegime).toEqual({});
    expect(r.outOfSample).toBeNull();
  });

  it("custos de transação reduzem o avgR (líquido < bruto)", () => {
    const inp = input(800, 38);
    const noCost = runBacktest(inp, { config: { ...DEFAULT_ENGINE_CONFIG, costs: { perSideBps: 0, byAsset: {} } } });
    const highCost = runBacktest(inp, { config: { ...DEFAULT_ENGINE_CONFIG, costs: { perSideBps: 50, byAsset: {} } } });
    expect(noCost.totalTrades).toBe(highCost.totalTrades); // custo não muda quais trades abrem
    if (noCost.totalTrades > 0) {
      expect(highCost.avgR.value).toBeLessThan(noCost.avgR.value);
      expect(highCost.profitFactor.value).toBeLessThanOrEqual(noCost.profitFactor.value);
    }
  });
});
