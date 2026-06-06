/**
 * Níveis-alvo mais PRÓXIMOS acima e abaixo do preço atual. Prioriza zonas de
 * liquidez (stop clusters); se faltar de um lado, usa estrutura (swing) ou Value
 * Area (VAL/VAH) como nível daquele lado — assim sempre há cima E baixo. PURO.
 */
import type { FullAnalysis } from "./full";

export interface NearestLiquidity {
  price: number;
  above: number | null;
  below: number | null;
  abovePct: number | null;
  belowPct: number | null;
  aboveLabel: string;
  belowLabel: string;
}

interface Cand { level: number; label: string; }

export function nearestLiquidity(dto: FullAnalysis): NearestLiquidity | null {
  const price = dto.montecarlo?.currentPrice ?? dto.analysis?.risk?.entry;
  if (!price || !Number.isFinite(price)) return null;

  const cands: Cand[] = [];
  for (const z of dto.smc?.liquidityZones ?? []) {
    if (Number.isFinite(z.level)) cands.push({ level: z.level, label: "Liquidez" });
  }
  if (dto.smc?.lastSwingHigh) cands.push({ level: dto.smc.lastSwingHigh.price, label: "Swing" });
  if (dto.smc?.lastSwingLow) cands.push({ level: dto.smc.lastSwingLow.price, label: "Swing" });
  if (dto.volumeProfile) {
    cands.push({ level: dto.volumeProfile.vah, label: "VAH" });
    cands.push({ level: dto.volumeProfile.val, label: "VAL" });
  }
  if (cands.length === 0) return null;

  // Nearest above = menor nível > preço; preferindo "Liquidez" em empate de proximidade.
  let aboveC: Cand | null = null, belowC: Cand | null = null;
  for (const c of cands) {
    if (c.level > price) { if (!aboveC || c.level < aboveC.level) aboveC = c; }
    else if (c.level < price) { if (!belowC || c.level > belowC.level) belowC = c; }
  }

  return {
    price,
    above: aboveC?.level ?? null,
    below: belowC?.level ?? null,
    abovePct: aboveC ? ((aboveC.level - price) / price) * 100 : null,
    belowPct: belowC ? ((belowC.level - price) / price) * 100 : null,
    aboveLabel: aboveC?.label ?? "—",
    belowLabel: belowC?.label ?? "—",
  };
}
