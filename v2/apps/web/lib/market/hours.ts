/**
 * Horário de mercado (simplificado) para gatear o Live Trading. PURO.
 * - Cripto: 24/7.
 * - Demais (forex/índices/commodities/ações): fecham no fim de semana. Aproxima
 *   o forex que reabre domingo 19h BRT (22:00 UTC). Sábado fechado o dia todo.
 * Heurística honesta p/ a UI — não é calendário de feriados/pregão preciso.
 */
import type { AssetType } from "@tradeai/shared";

export interface MarketState {
  open: boolean;
  reopenHint?: string; // ex.: "dom. 19h BRT"
}

export function marketState(assetType: AssetType, now: Date): MarketState {
  if (assetType === "crypto") return { open: true };
  const day = now.getUTCDay(); // 0=dom, 6=sáb
  const hourUtc = now.getUTCHours();
  // Sábado: fechado. Domingo: abre 22:00 UTC (19h BRT). Seg–sex: aberto.
  if (day === 6) return { open: false, reopenHint: "dom. 19h BRT" };
  if (day === 0 && hourUtc < 22) return { open: false, reopenHint: "dom. 19h BRT" };
  // Sexta após 22:00 UTC → fechado até domingo (aprox.)
  if (day === 5 && hourUtc >= 22) return { open: false, reopenHint: "dom. 19h BRT" };
  return { open: true };
}
