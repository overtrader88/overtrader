/**
 * Heatmap de horários (Fase D2) — "horários ideais" HONESTO.
 *
 * Para cada janela (dia-da-semana × hora-do-dia, UTC), mede o retorno médio do
 * candle e o win rate, com tamanho de amostra. Só marca `sufficient` quando há
 * candles suficientes — a UI mostra cinza no resto, em vez de cravar um "melhor
 * horário" sobre 2 ocorrências (o oposto do concorrente). PURO/determinístico.
 *
 * Granularidade = a do candle passado (idealmente 1h). Hora/dia derivam do início
 * do candle em UTC.
 */
import type { Candle } from "@tradeai/shared";
import type { Estimate } from "../types";
import { meanConfidenceInterval } from "../stats";

export interface HeatCell {
  weekday: number; // 0=domingo … 6=sábado (UTC)
  hour: number; // 0..23 (UTC)
  avgReturn: number; // % médio do candle nessa janela
  winRate: number; // 0..1
  sampleSize: number;
  sufficient: boolean;
}

export interface HeatMarginal {
  /** hora (0..23) ou dia (0..6), conforme a dimensão. */
  key: number;
  avgReturn: Estimate; // com IC 95%
  winRate: number;
  sampleSize: number;
  sufficient: boolean;
}

export interface SessionHeatmapResult {
  cells: HeatCell[];
  byHour: HeatMarginal[];
  byWeekday: HeatMarginal[];
  minSampleSize: number;
  best: HeatCell | null;
  worst: HeatCell | null;
  totalCandles: number;
  summary: string;
}

const WD_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function push(m: Map<string | number, number[]>, k: string | number, v: number): void {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

function marginal(m: Map<number, number[]>, min: number): HeatMarginal[] {
  const out: HeatMarginal[] = [];
  for (const [key, rs] of m) {
    const wins = rs.filter((r) => r > 0).length;
    out.push({ key, avgReturn: meanConfidenceInterval(rs), winRate: rs.length ? wins / rs.length : 0, sampleSize: rs.length, sufficient: rs.length >= min });
  }
  return out.sort((a, b) => a.key - b.key);
}

export function analyzeSessionHeatmap(candles: Candle[], options: { minSampleSize?: number } = {}): SessionHeatmapResult {
  const min = options.minSampleSize ?? 10;
  const grid = new Map<string, number[]>();
  const byH = new Map<number, number[]>();
  const byW = new Map<number, number[]>();

  for (const c of candles) {
    if (!(c.open > 0)) continue;
    const ret = ((c.close - c.open) / c.open) * 100;
    const d = new Date(c.time);
    const wd = d.getUTCDay();
    const h = d.getUTCHours();
    push(grid, `${wd}-${h}`, ret);
    push(byH, h, ret);
    push(byW, wd, ret);
  }

  const cells: HeatCell[] = [];
  for (const [k, rs] of grid) {
    const [wd, h] = k.split("-").map(Number) as [number, number];
    const wins = rs.filter((r) => r > 0).length;
    const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
    cells.push({ weekday: wd, hour: h, avgReturn: Math.round(mean * 1000) / 1000, winRate: wins / rs.length, sampleSize: rs.length, sufficient: rs.length >= min });
  }

  const sufficient = cells.filter((c) => c.sufficient);
  const best = sufficient.length ? sufficient.reduce((a, b) => (b.avgReturn > a.avgReturn ? b : a)) : null;
  const worst = sufficient.length ? sufficient.reduce((a, b) => (b.avgReturn < a.avgReturn ? b : a)) : null;

  return {
    cells,
    byHour: marginal(byH, min),
    byWeekday: marginal(byW, min),
    minSampleSize: min,
    best,
    worst,
    totalCandles: candles.length,
    summary: buildSummary(best, worst),
  };
}

function buildSummary(best: HeatCell | null, worst: HeatCell | null): string {
  if (!best) return "Amostra insuficiente por janela para apontar horários — sem veredito confiável.";
  const b = `Janela historicamente mais forte: ${WD_PT[best.weekday]} ${String(best.hour).padStart(2, "0")}h UTC (${best.avgReturn > 0 ? "+" : ""}${best.avgReturn}% médio, n=${best.sampleSize}).`;
  const w = worst && worst !== best ? ` Mais fraca: ${WD_PT[worst.weekday]} ${String(worst.hour).padStart(2, "0")}h UTC (${worst.avgReturn}% médio).` : "";
  return b + w + " Observado, não promessa.";
}
