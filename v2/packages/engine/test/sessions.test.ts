import { describe, it, expect } from "vitest";
import { analyzeSessionHeatmap } from "../src/sessions";
import type { Candle } from "@tradeai/shared";

const HOUR = 3600_000;
const MONDAY_0 = Date.UTC(2024, 0, 1, 0, 0, 0); // 1º jan 2024 = segunda 00:00 UTC

function candleAt(ms: number, retPct: number): Candle {
  const open = 100;
  const close = open * (1 + retPct / 100);
  return { time: ms, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: 0 };
}

/** 1h candles por `days` dias; +1% nas 14h UTC, -0.05% no resto. */
function series(days: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < days * 24; i++) {
    const ms = MONDAY_0 + i * HOUR;
    const h = new Date(ms).getUTCHours();
    out.push(candleAt(ms, h === 14 ? 1 : -0.05));
  }
  return out;
}

describe("analyzeSessionHeatmap", () => {
  it("identifica a janela mais forte (14h UTC) com amostra suficiente", () => {
    const r = analyzeSessionHeatmap(series(84), { minSampleSize: 10 }); // 12 semanas → 12/bucket
    expect(r.best).not.toBeNull();
    expect(r.best!.hour).toBe(14);
    expect(r.best!.avgReturn).toBeCloseTo(1, 1);
    expect(r.best!.sufficient).toBe(true);
    expect(r.byHour).toHaveLength(24);
    const h14 = r.byHour.find((m) => m.key === 14)!;
    expect(h14.winRate).toBe(1);
    expect(h14.avgReturn.n).toBe(84);
    expect(r.byWeekday).toHaveLength(7);
    expect(r.summary).toContain("14h UTC");
  });

  it("amostra fraca → nenhuma janela suficiente (honesto, best null)", () => {
    const r = analyzeSessionHeatmap(series(14), { minSampleSize: 20 }); // 2 sem → 2/bucket
    expect(r.best).toBeNull();
    expect(r.cells.every((c) => !c.sufficient)).toBe(true);
    expect(r.summary).toContain("insuficiente");
  });

  it("ignora candles inválidos e não quebra com vazio", () => {
    expect(analyzeSessionHeatmap([]).cells).toHaveLength(0);
    expect(analyzeSessionHeatmap([]).best).toBeNull();
  });
});
