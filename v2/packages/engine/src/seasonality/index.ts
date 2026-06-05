/**
 * Sazonalidade histórica — agora ESTATISTICAMENTE HONESTA.
 *
 * Reescrita do v1 (que mostrava "win rate 100% / +8%" sobre amostras minúsculas
 * sem comunicar incerteza):
 *   - `avgReturn` vem com IC de 95% (t-Student).
 *   - `winRate` vem com IC de 95% (Wilson).
 *   - cada mês traz `sampleSize` e `sufficient` (n ≥ minSampleSize); abaixo disso
 *     a UI deve dizer "amostra insuficiente" em vez de cravar um número.
 *   - janela `recentYears` opcional (relevante p/ cripto, cujo histórico antigo
 *     tem regime muito diferente).
 *   - `currentMonth` deriva do ÚLTIMO candle (puro/determinístico), não de Date.now().
 */
import type { Candle } from "@tradeai/shared";
import type { Estimate } from "../types";
import { DEFAULT_ENGINE_CONFIG } from "../config";
import { meanConfidenceInterval, wilsonInterval } from "../stats";

export interface MonthlyStats {
  /** 1-12 */
  month: number;
  /** Retorno médio % com IC. */
  avgReturn: Estimate;
  /** Win rate (0..1) com IC. */
  winRate: Estimate;
  sampleSize: number;
  /** Amostra suficiente para um veredito (n ≥ minSampleSize)? */
  sufficient: boolean;
}

export interface SeasonalityResult {
  monthly: MonthlyStats[];
  currentMonth: number;
  currentMonthStats: MonthlyStats | null;
  yearsAnalyzed: number;
  minSampleSize: number;
  summary: string;
}

export interface SeasonalityOptions {
  minSampleSize?: number;
  /** Considera apenas os últimos N anos (default: todos). */
  recentYears?: number;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function analyzeSeasonality(candles: Candle[], options: SeasonalityOptions = {}): SeasonalityResult {
  const minSampleSize = options.minSampleSize ?? DEFAULT_ENGINE_CONFIG.seasonality.minSampleSize;
  const recentYears = options.recentYears ?? DEFAULT_ENGINE_CONFIG.seasonality.recentYears;

  // Agrupa por "ano-mês": guarda primeiro e último close.
  const groups = new Map<string, { year: number; month: number; first: number; lastClose: number }>();
  for (const c of candles) {
    const d = new Date(c.time);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { year, month, first: c.close, lastClose: c.close });
    else g.lastClose = c.close;
  }

  // Janela recentYears (a partir do ano mais recente presente).
  let entries = [...groups.values()];
  const years = [...new Set(entries.map((e) => e.year))];
  if (recentYears && years.length > 0) {
    const maxYear = Math.max(...years);
    const cutoff = maxYear - recentYears + 1;
    entries = entries.filter((e) => e.year >= cutoff);
  }

  // Retornos por mês (1-12).
  const byMonth = new Map<number, number[]>();
  for (const e of entries) {
    if (e.first <= 0) continue;
    const ret = ((e.lastClose - e.first) / e.first) * 100;
    const arr = byMonth.get(e.month) ?? [];
    arr.push(ret);
    byMonth.set(e.month, arr);
  }

  const monthly: MonthlyStats[] = [];
  for (let m = 1; m <= 12; m++) {
    const returns = byMonth.get(m) ?? [];
    const n = returns.length;
    const positives = returns.filter((r) => r > 0).length;
    monthly.push({
      month: m,
      avgReturn: meanConfidenceInterval(returns),
      winRate: wilsonInterval(positives, n),
      sampleSize: n,
      sufficient: n >= minSampleSize,
    });
  }

  const yearsAnalyzed = new Set(entries.map((e) => e.year)).size;
  const lastCandle = candles[candles.length - 1];
  const currentMonth = lastCandle ? new Date(lastCandle.time).getUTCMonth() + 1 : 1;
  const currentMonthStats = monthly[currentMonth - 1] ?? null;

  return {
    monthly,
    currentMonth,
    currentMonthStats,
    yearsAnalyzed,
    minSampleSize,
    summary: buildSummary(currentMonth, currentMonthStats),
  };
}

function buildSummary(currentMonth: number, stats: MonthlyStats | null): string {
  const name = MONTH_NAMES[currentMonth - 1] ?? "—";
  if (!stats || !stats.sufficient) {
    const n = stats?.sampleSize ?? 0;
    return `Amostra insuficiente para ${name} (apenas ${n} ano(s)). Sem veredito sazonal confiável.`;
  }
  const avg = stats.avgReturn;
  const [lo, hi] = avg.ci95;
  const direction = lo > 0 ? "historicamente positivo" : hi < 0 ? "historicamente negativo" : "sem viés claro (IC cruza zero)";
  return `${name}: ${avg.value.toFixed(2)}% médio (IC 95% ${lo.toFixed(1)}%–${hi.toFixed(1)}%, n=${avg.n}) — ${direction}.`;
}
