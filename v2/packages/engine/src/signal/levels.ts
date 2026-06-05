/**
 * Mapeamento ratio (0..1) → 7 níveis de sinal, e label PT-BR.
 * As fronteiras espelham a escala documentada em @tradeai/shared.
 */
import type { SignalDirection } from "@tradeai/shared";

/** ratio: 0 (tudo SELL) .. 0.5 (equilíbrio) .. 1 (tudo BUY). */
export function ratioToSignal(ratio: number): SignalDirection {
  if (ratio < 0.2) return "STRONG_SELL";
  if (ratio < 0.35) return "SELL";
  if (ratio < 0.45) return "WEAK_SELL";
  if (ratio <= 0.55) return "NEUTRAL";
  if (ratio <= 0.65) return "WEAK_BUY";
  if (ratio <= 0.8) return "BUY";
  return "STRONG_BUY";
}

export function signalLabel(s: SignalDirection): string {
  const map: Record<SignalDirection, string> = {
    STRONG_BUY: "Compra Forte",
    BUY: "Compra",
    WEAK_BUY: "Compra Fraca",
    NEUTRAL: "Neutro",
    WEAK_SELL: "Venda Fraca",
    SELL: "Venda",
    STRONG_SELL: "Venda Forte",
  };
  return map[s];
}
