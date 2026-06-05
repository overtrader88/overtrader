/**
 * Mapeadores de exibição (puros) — traduzem os tipos do motor para os
 * componentes de UI (SignalBadge/QualityDot) e formatam datas relativas.
 * Compartilhado por histórico e dashboard.
 */
import { signalSide, type SignalDirection } from "@tradeai/shared";
import type { SignalDir, Seal } from "@/components/ui";

export function signalToDir(s: SignalDirection): SignalDir {
  const side = signalSide(s);
  return side === "buy" ? "buy" : side === "sell" ? "sell" : "neu";
}

const PT: Record<SignalDirection, string> = {
  STRONG_BUY: "Compra forte",
  BUY: "Compra",
  WEAK_BUY: "Compra fraca",
  NEUTRAL: "Neutro",
  WEAK_SELL: "Venda fraca",
  SELL: "Venda",
  STRONG_SELL: "Venda forte",
};
export function signalLabelPt(s: SignalDirection): string {
  return PT[s];
}

export function sealFromStatus(status?: string | null): Seal {
  return status === "green" ? "green" : status === "yellow" ? "amber" : status === "red" ? "red" : "gray";
}
export function sealText(seal: Seal): string {
  return seal === "green" ? "verde" : seal === "amber" ? "âmbar" : seal === "red" ? "vermelho" : "amostra";
}

export const FORCE_COLOR: Record<SignalDir, string> = {
  buy: "var(--bull)",
  sell: "var(--bear)",
  neu: "var(--ink-faint)",
};

export function relativeTime(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const d = Math.max(0, nowMs - t);
  const min = Math.floor(d / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
