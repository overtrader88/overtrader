import { describe, it, expect } from "vitest";
import { buildChartZones } from "./chart-zones";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

describe("buildChartZones", () => {
  it("gera caixas de OB ativo, FVG ativo e value area; ignora OB mitigado", () => {
    const zones = buildChartZones(dto({
      smc: {
        orderBlocks: [
          { type: "bullish", zoneTop: 110, zoneBottom: 100, mitigated: false, formedAt: 1000000 },
          { type: "bearish", zoneTop: 90, zoneBottom: 80, mitigated: true, formedAt: 1000000 },
        ],
        fvgs: [{ type: "bullish", zoneTop: 105, zoneBottom: 102, status: "active", formedAt: 1000000 }],
      },
      volumeProfile: { poc: 101, vah: 108, val: 95, binSize: 1, bins: [] },
    }));
    const labels = zones.map((z) => z.label);
    expect(labels).toContain("OB+");
    expect(labels).not.toContain("OB−"); // mitigado fora
    expect(labels).toContain("FVG");
    expect(labels).toContain("Value Area");
    // value area cobre VAL..VAH
    const va = zones.find((z) => z.label === "Value Area")!;
    expect(va.bottom).toBe(95); expect(va.top).toBe(108);
  });

  it("dto vazio → sem zonas", () => {
    expect(buildChartZones(dto({}))).toEqual([]);
  });
});
