/**
 * Os 7 níveis de sinal — escala graduada. Fonte única da verdade
 * (compartilhada entre engine e web). Helpers de cor/label ficam na web.
 */
import { z } from "zod";

export const SIGNAL_DIRECTIONS = [
  "STRONG_SELL",
  "SELL",
  "WEAK_SELL",
  "NEUTRAL",
  "WEAK_BUY",
  "BUY",
  "STRONG_BUY",
] as const;

export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

export const signalDirectionSchema = z.enum(SIGNAL_DIRECTIONS);

/** Voto individual de um indicador — granularidade simples. */
export type IndicatorVote = "BUY" | "SELL" | "NEUTRAL";

/** Direção macro: comprar / vender / esperar. */
export function signalSide(s: SignalDirection): "buy" | "sell" | "neutral" {
  if (s === "STRONG_BUY" || s === "BUY" || s === "WEAK_BUY") return "buy";
  if (s === "STRONG_SELL" || s === "SELL" || s === "WEAK_SELL") return "sell";
  return "neutral";
}

/** Forte o suficiente para gerar trade real. */
export function isActionable(s: SignalDirection): boolean {
  return s === "STRONG_BUY" || s === "BUY" || s === "STRONG_SELL" || s === "SELL";
}

/** Qualquer sinal direcional (forte, normal ou fraco). */
export function hasDirection(s: SignalDirection): boolean {
  return s !== "NEUTRAL";
}

export function isWeak(s: SignalDirection): boolean {
  return s === "WEAK_BUY" || s === "WEAK_SELL";
}
