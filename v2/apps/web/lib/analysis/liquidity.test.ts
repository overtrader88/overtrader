import { describe, it, expect } from "vitest";
import { nearestLiquidity } from "./liquidity";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

describe("nearestLiquidity", () => {
  it("acha o nível mais próximo acima e abaixo do preço atual", () => {
    const nl = nearestLiquidity(dto({
      montecarlo: { currentPrice: 100 },
      smc: { liquidityZones: [
        { type: "buy_stops_above", level: 110, swept: false },
        { type: "buy_stops_above", level: 105, swept: false }, // mais próximo acima
        { type: "sell_stops_below", level: 90, swept: false },
        { type: "sell_stops_below", level: 96, swept: false }, // mais próximo abaixo
      ] },
    }))!;
    expect(nl.above).toBe(105);
    expect(nl.below).toBe(96);
    expect(nl.abovePct).toBeCloseTo(5, 1);
    expect(nl.belowPct).toBeCloseTo(-4, 1);
  });

  it("usa entry como fallback de preço; null sem zonas", () => {
    expect(nearestLiquidity(dto({ analysis: { risk: { entry: 50 } }, smc: { liquidityZones: [] } }))).toBeNull();
  });
});
