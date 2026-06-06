/**
 * Níveis de liquidação (liquidez) mais PRÓXIMOS do preço atual — acima e abaixo.
 * São os alvos prováveis de "caça de stops": acima = buy stops, abaixo = sell stops.
 * PURO. Usa o preço atual do Monte Carlo (ou a entrada do plano como fallback).
 */
import type { FullAnalysis } from "./full";

export interface NearestLiquidity {
  price: number;
  above: number | null;
  below: number | null;
  /** Distância % até cada nível (assinada). */
  abovePct: number | null;
  belowPct: number | null;
}

export function nearestLiquidity(dto: FullAnalysis): NearestLiquidity | null {
  const zones = dto.smc?.liquidityZones ?? [];
  const price = dto.montecarlo?.currentPrice ?? dto.analysis?.risk?.entry;
  if (!price || !Number.isFinite(price) || zones.length === 0) return null;

  let above: number | null = null;
  let below: number | null = null;
  for (const z of zones) {
    if (!Number.isFinite(z.level)) continue;
    if (z.level > price) above = above == null ? z.level : Math.min(above, z.level);
    else if (z.level < price) below = below == null ? z.level : Math.max(below, z.level);
  }
  return {
    price,
    above,
    below,
    abovePct: above != null ? ((above - price) / price) * 100 : null,
    belowPct: below != null ? ((below - price) / price) * 100 : null,
  };
}
