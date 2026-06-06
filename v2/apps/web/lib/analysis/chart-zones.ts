/**
 * Zonas preenchidas pro gráfico (caixas): order blocks + FVG ativos + value area.
 * PURO. Cores translúcidas (canvas não lê CSS var). Reaproveita os dados do motor.
 */
import type { FullAnalysis } from "./full";
import type { ChartZone } from "@/lib/charts/zone-primitive";

export function buildChartZones(dto: FullAnalysis): ChartZone[] {
  const z: ChartZone[] = [];

  if (dto.smc) {
    for (const o of dto.smc.orderBlocks.filter((b) => !b.mitigated).slice(0, 3)) {
      const bull = o.type === "bullish";
      z.push({
        top: o.zoneTop, bottom: o.zoneBottom, from: o.formedAt / 1000,
        fill: bull ? "rgba(43,212,158,0.12)" : "rgba(255,107,138,0.12)",
        border: bull ? "rgba(43,212,158,0.7)" : "rgba(255,107,138,0.7)",
        label: bull ? "OB+" : "OB−",
      });
    }
    for (const f of dto.smc.fvgs.filter((g) => g.status === "active").slice(0, 3)) {
      z.push({
        top: f.zoneTop, bottom: f.zoneBottom, from: f.formedAt / 1000,
        fill: "rgba(84,168,255,0.10)", border: "rgba(84,168,255,0.55)", label: "FVG",
      });
    }
  }

  if (dto.volumeProfile) {
    z.push({
      top: dto.volumeProfile.vah, bottom: dto.volumeProfile.val, from: 0,
      fill: "rgba(255,176,32,0.06)", border: "rgba(255,176,32,0.4)", label: "Value Area",
    });
  }

  return z.filter((x) => Number.isFinite(x.top) && Number.isFinite(x.bottom));
}
