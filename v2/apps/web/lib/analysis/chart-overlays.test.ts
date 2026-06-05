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

  it("desenha OB/FVG ativos e PRZ; ignora OB mitigado", () => {
    const lines = buildPriceLines(
      dto({
        analysis: { signal: { signal: "NEUTRAL" }, risk: {} },
        smc: {
          orderBlocks: [
            { type: "bullish", zoneTop: 110, zoneBottom: 100, mitigated: false },
            { type: "bearish", zoneTop: 90, zoneBottom: 80, mitigated: true },
          ],
          fvgs: [{ type: "bullish", zoneTop: 105, zoneBottom: 102, status: "active" }],
        },
        harmonics: { patterns: [{ name: "Bat", prz: { low: 70, high: 75 }, direction: "bullish" }] },
      }),
    );
    const titles = lines.map((l) => l.title);
    expect(titles).toContain("OB+");
    expect(titles).not.toContain("OB−"); // mitigado → fora
    expect(titles).toContain("FVG");
    expect(titles.some((t) => t.startsWith("PRZ"))).toBe(true);
  });
});
