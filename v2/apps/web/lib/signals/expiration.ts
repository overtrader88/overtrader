/**
 * Janela de expiração dos sinais forward — FONTE ÚNICA (Pacote C).
 *
 * Nasceu no cron resolve-signals (era -j2, achado 22): 60 candles fixos eram
 * ~10 dias no 4h mas ~2-3 MESES no 1d. O mapa mantém a vida em tempo-calendário
 * (~10 dias). Extraído para cá porque os fatos dos motores LLM (achado 16)
 * passam a injetar `expira_em_candles` no prompt — e o número que a LLM vê tem
 * que ser EXATAMENTE o que o juiz aplica.
 */
import { isTimeframe, type Timeframe } from "@tradeai/shared";

export const MAX_DURATION_BY_TF: Partial<Record<Timeframe, number>> = { "1h": 120, "4h": 60, "1d": 25, "1w": 12 };
export const DEFAULT_MAX_DURATION = 60;

/** Janela (em candles do TF) antes do EXPIRED — fallback 60 p/ TF desconhecido. */
export function maxDurationFor(timeframe: string): number {
  return (isTimeframe(timeframe) ? MAX_DURATION_BY_TF[timeframe] : undefined) ?? DEFAULT_MAX_DURATION;
}
