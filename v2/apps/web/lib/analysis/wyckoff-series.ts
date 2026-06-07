/**
 * Série histórica de eventos Wyckoff para exibição (timeline). PURO.
 * Ordena do mais antigo ao mais recente e anota tempo relativo + rótulo curto.
 */
import type { WyckoffEvent, WyckoffEventType } from "./wyckoff-events";

export interface WyckoffSeriesItem {
  type: WyckoffEventType;
  side: "bull" | "bear";
  price: number;
  time: number;
  ago: string;     // "agora", "3h", "2d"
  recent: boolean; // dentro dos últimos 3 (em destaque no gráfico)
}

const FORCE: Record<WyckoffEventType, string> = {
  Spring: "alta", SOS: "força", LPS: "suporte", AR: "repique",
  UTAD: "baixa", SOW: "fraqueza", ST: "reteste",
};

function ago(ms: number, now: number): string {
  const d = Math.max(0, now - ms);
  const min = d / 60000;
  if (min < 60) return min < 2 ? "agora" : `${Math.round(min)}m`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

export function buildWyckoffSeries(events: WyckoffEvent[] | undefined, now: number): WyckoffSeriesItem[] {
  const evs = (events ?? []).filter((e) => Number.isFinite(e.price) && Number.isFinite(e.time));
  const recentSet = new Set(evs.slice(-3).map((e) => e.time));
  return [...evs]
    .sort((a, b) => a.time - b.time)
    .map((e) => ({
      type: e.type,
      side: e.side,
      price: e.price,
      time: e.time,
      ago: ago(e.time, now),
      recent: recentSet.has(e.time),
    }));
}

export function eventForce(t: WyckoffEventType): string {
  return FORCE[t] ?? "";
}
