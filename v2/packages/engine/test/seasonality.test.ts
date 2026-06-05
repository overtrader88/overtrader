import { describe, expect, it } from "vitest";
import type { Candle } from "@tradeai/shared";
import { analyzeSeasonality } from "../src/seasonality";

/**
 * Gera candles diários por `years` anos. No `bullMonth` (1-12) o preço sobe ao
 * longo do mês; nos demais fica plano. Assim o retorno mensal do bullMonth é
 * sempre positivo e o dos outros ~0 — padrão sazonal conhecido.
 */
function monthlyFixture(years: number, bullMonth: number, startYear = 2010): Candle[] {
  const out: Candle[] = [];
  const base = 100;
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) {
      const isBull = m + 1 === bullMonth;
      for (let d = 1; d <= 28; d++) {
        const close = isBull ? base + d * 0.1 : base;
        out.push({
          time: Date.UTC(startYear + y, m, d),
          open: close,
          high: close + 0.5,
          low: close - 0.5,
          close,
          volume: 1000,
        });
      }
    }
  }
  return out;
}

describe("analyzeSeasonality", () => {
  it("recupera um padrão mensal conhecido com amostra suficiente", () => {
    const r = analyzeSeasonality(monthlyFixture(8, 3), { minSampleSize: 5 });
    const march = r.monthly[2]!; // mês 3
    expect(march.month).toBe(3);
    expect(march.sampleSize).toBe(8);
    expect(march.sufficient).toBe(true);
    expect(march.avgReturn.value).toBeGreaterThan(0);
    // IC não cruza zero (padrão forte e consistente)
    expect(march.avgReturn.ci95[0]).toBeGreaterThan(0);
    expect(march.winRate.value).toBeCloseTo(1, 5);
  });

  it("meses planos têm retorno ~0", () => {
    const r = analyzeSeasonality(monthlyFixture(8, 3), { minSampleSize: 5 });
    const jan = r.monthly[0]!;
    expect(jan.avgReturn.value).toBeCloseTo(0, 6);
  });

  it("marca sufficient=false quando a amostra é pequena", () => {
    const r = analyzeSeasonality(monthlyFixture(3, 3), { minSampleSize: 5 });
    expect(r.monthly.every((m) => !m.sufficient)).toBe(true);
    expect(r.summary).toMatch(/insuficiente/i);
  });

  it("janela recentYears reduz a amostra", () => {
    const all = analyzeSeasonality(monthlyFixture(10, 3), { minSampleSize: 1 });
    const recent = analyzeSeasonality(monthlyFixture(10, 3), { minSampleSize: 1, recentYears: 3 });
    expect(all.monthly[2]!.sampleSize).toBe(10);
    expect(recent.monthly[2]!.sampleSize).toBe(3);
  });

  it("currentMonth deriva do último candle (determinístico)", () => {
    const r = analyzeSeasonality(monthlyFixture(5, 3));
    // último candle é dezembro (m=11) → currentMonth 12
    expect(r.currentMonth).toBe(12);
  });
});
