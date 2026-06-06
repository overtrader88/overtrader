import { describe, it, expect } from "vitest";
import { buildPriceLines } from "./chart-overlays";
import type { FullAnalysis } from "./full";

function dto(partial: unknown): FullAnalysis {
  return partial as FullAnalysis;
}

describe("buildPriceLines", () => {
  it("inclui entrada/stop/TPs quando há direção", () => {
    const lines = buildPriceLines(
      dto({
        analysis: { signal: { signal: "BUY" }, risk: { entry: 100, stopLoss: 95, takeProfit1: 108, takeProfit2: 115, takeProfit3: 125 } },
        smc: { orderBlocks: [], fvgs: [] },
        harmonics: { patterns: [] },
      }),
    );
    const titles = lines.map((l) => l.title);
    expect(titles).toContain("Entrada");
    expect(titles).toContain("Stop");
    expect(titles).toContain("TP1");
    expect(lines.every((l) => Number.isFinite(l.price))).toBe(true);
  });

  it("sinal neutro não desenha plano operacional", () => {
    const lines = buildPriceLines(
      dto({
        analysis: { signal: { signal: "NEUTRAL" }, risk: { entry: 100, stopLoss: 95, takeProfit1: 108, takeProfit2: 115, takeProfit3: 125 } },
        smc: { orderBlocks: [], fvgs: [] },
        harmonics: { patterns: [] },
      }),
    );
    expect(lines.map((l) => l.title)).not.toContain("Entrada");
  });

  it("desenha liquidez + PRZ + POC como linhas (OB/FVG/VA viram caixas)", () => {
    const lines = buildPriceLines(
      dto({
        analysis: { signal: { signal: "NEUTRAL" }, risk: {} },
        montecarlo: { currentPrice: 100 },
        smc: {
          orderBlocks: [{ type: "bullish", zoneTop: 110, zoneBottom: 100, mitigated: false }],
          fvgs: [{ type: "bullish", zoneTop: 105, zoneBottom: 102, status: "active" }],
          liquidityZones: [
            { type: "buy_stops_above", level: 120, swept: false },
            { type: "sell_stops_below", level: 78, swept: true },
          ],
        },
        harmonics: { patterns: [{ name: "Bat", prz: { low: 70, high: 75 }, direction: "bullish" }] },
        volumeProfile: { poc: 101, vah: 108, val: 95, binSize: 1, bins: [] },
      }),
    );
    const titles = lines.map((l) => l.title);
    expect(titles.some((t) => t.includes("Liquidez ↑"))).toBe(true);
    expect(titles.some((t) => t.includes("Liquidez ↓"))).toBe(true);
    expect(titles.some((t) => t.startsWith("PRZ"))).toBe(true);
    expect(titles).toContain("POC");
    // OB/FVG/VAH/VAL não são mais linhas (viram caixas)
    expect(titles.some((t) => t.startsWith("OB"))).toBe(false);
    expect(titles).not.toContain("FVG");
  });
});
