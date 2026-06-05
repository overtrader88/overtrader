/**
 * Helpers de apresentação para os 7 níveis de sinal.
 * Mantém UI consistente em toda a aplicação.
 */
import type { SignalDirection } from "./types";

export const SIGNAL_ORDER: SignalDirection[] = [
  "STRONG_SELL",
  "SELL",
  "WEAK_SELL",
  "NEUTRAL",
  "WEAK_BUY",
  "BUY",
  "STRONG_BUY",
];

/** Mapeia ratio de confluência (0..1) → SignalDirection */
export function ratioToSignal(ratio: number): SignalDirection {
  if (ratio < 0.20) return "STRONG_SELL";
  if (ratio < 0.35) return "SELL";
  if (ratio < 0.45) return "WEAK_SELL";
  if (ratio <= 0.55) return "NEUTRAL";
  if (ratio <= 0.65) return "WEAK_BUY";
  if (ratio <= 0.80) return "BUY";
  return "STRONG_BUY";
}

/** Label PT-BR amigável */
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

/** Versão curta para badges (lista, filtros) */
export function signalShortLabel(s: SignalDirection): string {
  const map: Record<SignalDirection, string> = {
    STRONG_BUY: "COMPRA FORTE",
    BUY: "COMPRA",
    WEAK_BUY: "COMPRA FRACA",
    NEUTRAL: "NEUTRO",
    WEAK_SELL: "VENDA FRACA",
    SELL: "VENDA",
    STRONG_SELL: "VENDA FORTE",
  };
  return map[s];
}

/** Direção macro: comprar / vender / esperar */
export function signalSide(s: SignalDirection): "buy" | "sell" | "neutral" {
  if (s === "STRONG_BUY" || s === "BUY" || s === "WEAK_BUY") return "buy";
  if (s === "STRONG_SELL" || s === "SELL" || s === "WEAK_SELL") return "sell";
  return "neutral";
}

/** Verdadeiro se a direção é forte o suficiente para gerar trade real. */
export function isActionable(s: SignalDirection): boolean {
  return s === "STRONG_BUY" || s === "BUY" || s === "STRONG_SELL" || s === "SELL";
}

/**
 * Verdadeiro para qualquer sinal direcional (forte, normal ou fraco).
 * Útil para decidir se mostramos entry/SL/TP no card e gráfico — sinais
 * fracos ainda têm direção, e o trader precisa ver os níveis pra decidir.
 */
export function hasDirection(s: SignalDirection): boolean {
  return s !== "NEUTRAL";
}

/** Verdadeiro se o sinal é "fraco" (baixa confluência). */
export function isWeak(s: SignalDirection): boolean {
  return s === "WEAK_BUY" || s === "WEAK_SELL";
}

/**
 * Variant do componente Badge que melhor representa este sinal.
 * Usa cores graduadas: forte = saturado, fraco = ghost colorido.
 */
export function signalBadgeVariant(s: SignalDirection):
  | "success"
  | "destructive"
  | "ghost"
  | "outline" {
  if (s === "STRONG_BUY" || s === "BUY") return "success";
  if (s === "STRONG_SELL" || s === "SELL") return "destructive";
  if (s === "WEAK_BUY" || s === "WEAK_SELL") return "outline";
  return "ghost";
}

/**
 * Classes Tailwind de cor (texto) por nível de sinal.
 * Útil pra ícones/textos que não usam o componente Badge.
 */
export function signalTextColor(s: SignalDirection): string {
  switch (s) {
    case "STRONG_BUY":
      return "text-success";
    case "BUY":
      return "text-success";
    case "WEAK_BUY":
      return "text-success/70";
    case "WEAK_SELL":
      return "text-destructive/70";
    case "SELL":
      return "text-destructive";
    case "STRONG_SELL":
      return "text-destructive";
    case "NEUTRAL":
    default:
      return "text-muted-foreground";
  }
}

/**
 * Cor hex (lightweight-charts e SVG) por nível.
 * Forte = saturado, fraco = atenuado.
 */
export function signalHexColor(s: SignalDirection): string {
  switch (s) {
    case "STRONG_BUY":
      return "#15803d"; // green-700
    case "BUY":
      return "#16a34a"; // green-600
    case "WEAK_BUY":
      return "#86efac"; // green-300
    case "WEAK_SELL":
      return "#fca5a5"; // red-300
    case "SELL":
      return "#dc2626"; // red-600
    case "STRONG_SELL":
      return "#991b1b"; // red-800
    case "NEUTRAL":
    default:
      return "#94a3b8"; // slate-400
  }
}

/** Lista os filtros que agrupam por lado (útil para a página de Histórico). */
export const SIGNAL_GROUPS: Array<{ label: string; values: SignalDirection[] }> = [
  { label: "Compras", values: ["STRONG_BUY", "BUY", "WEAK_BUY"] },
  { label: "Neutros", values: ["NEUTRAL"] },
  { label: "Vendas", values: ["WEAK_SELL", "SELL", "STRONG_SELL"] },
];
