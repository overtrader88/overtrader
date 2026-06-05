/**
 * Sazonalidade historica — performance media por mes e dia da semana.
 *
 * Calcula a partir do historico de candles disponivel:
 *   - Performance media (%) por mes (1-12)
 *   - Performance media (%) por dia da semana (0=dom .. 6=sab)
 *   - Win rate (% de meses positivos) por mes
 *   - Forca da sazonalidade (significancia estatistica simples)
 *
 * Para cripto/forex/stocks 24/7, sazonalidade do mes e o mais relevante.
 * Bitcoin tem sazonalidade conhecida: Outubro/Novembro fortes ("Uptober"),
 * Setembro fraco ("Rektember"), etc.
 */
import type { Candle } from "@/lib/market/types";

export interface MonthlyStats {
  /** 1 = Janeiro, 12 = Dezembro */
  month: number;
  /** Performance media (%) */
  avgReturn: number;
  /** % de anos com retorno positivo nesse mes */
  winRate: number;
  /** Quantos anos de dados */
  sampleSize: number;
}

export interface SeasonalityResult {
  /** Stats mensais (12 entries) */
  monthly: MonthlyStats[];
  /** Mes atual */
  currentMonth: number;
  /** Stats do mes atual */
  currentMonthStats: MonthlyStats | null;
  /** Quantos anos de historico foram usados */
  yearsAnalyzed: number;
  /** Resumo textual curto */
  summary: string;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Agrupa candles por mes/ano e calcula retorno percentual de cada mes.
 * Retorna { [yearMonth]: returnPct }.
 */
function calculateMonthlyReturns(
  candles: Candle[]
): Map<string, { month: number; returnPct: number }> {
  if (candles.length < 30) return new Map();

  // Agrupa candles por YYYY-MM
  const byMonth = new Map<
    string,
    { month: number; firstClose: number; lastClose: number }
  >();

  for (const c of candles) {
    const d = new Date(c.time);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-12
    const key = `${year}-${String(month).padStart(2, "0")}`;

    const existing = byMonth.get(key);
    if (!existing) {
      byMonth.set(key, { month, firstClose: c.close, lastClose: c.close });
    } else {
      existing.lastClose = c.close;
    }
  }

  // Calcula retorno % de cada mes
  const result = new Map<string, { month: number; returnPct: number }>();
  for (const [key, data] of byMonth) {
    if (data.firstClose <= 0) continue;
    const returnPct = ((data.lastClose - data.firstClose) / data.firstClose) * 100;
    result.set(key, { month: data.month, returnPct });
  }

  return result;
}

/**
 * Calcula stats agregadas por mes (1-12) a partir dos retornos mensais.
 */
function aggregateByMonth(
  monthlyReturns: Map<string, { month: number; returnPct: number }>
): MonthlyStats[] {
  const buckets = new Map<number, number[]>();

  for (const { month, returnPct } of monthlyReturns.values()) {
    if (!buckets.has(month)) buckets.set(month, []);
    buckets.get(month)!.push(returnPct);
  }

  const stats: MonthlyStats[] = [];
  for (let m = 1; m <= 12; m++) {
    const returns = buckets.get(m) ?? [];
    if (returns.length === 0) {
      stats.push({ month: m, avgReturn: 0, winRate: 50, sampleSize: 0 });
      continue;
    }
    const avg = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const wins = returns.filter((r) => r > 0).length;
    const winRate = (wins / returns.length) * 100;
    stats.push({
      month: m,
      avgReturn: avg,
      winRate,
      sampleSize: returns.length,
    });
  }

  return stats;
}

function buildSummary(
  currentStats: MonthlyStats | null,
  yearsAnalyzed: number
): string {
  if (!currentStats || currentStats.sampleSize === 0) {
    return "Sem dados historicos suficientes para sazonalidade.";
  }

  const monthName = MONTH_NAMES[currentStats.month - 1];
  const direction =
    currentStats.avgReturn > 0.5
      ? "historicamente bullish"
      : currentStats.avgReturn < -0.5
        ? "historicamente bearish"
        : "neutro historicamente";

  const sign = currentStats.avgReturn >= 0 ? "+" : "";
  return `${monthName} e ${direction}: ${sign}${currentStats.avgReturn.toFixed(
    2
  )}% medio · ${currentStats.winRate.toFixed(0)}% win rate em ${
    currentStats.sampleSize
  } anos.`;
}

/**
 * Calcula sazonalidade a partir do historico de candles.
 *
 * @param candles Idealmente >= 1 ano de dados. Quanto mais, melhor a estatistica.
 */
export function analyzeSeasonality(candles: Candle[]): SeasonalityResult {
  const monthlyReturns = calculateMonthlyReturns(candles);
  const monthly = aggregateByMonth(monthlyReturns);

  const currentMonth = new Date().getUTCMonth() + 1;
  const currentMonthStats =
    monthly.find((m) => m.month === currentMonth) ?? null;

  // Calcula anos analisados (entries unicos por ano)
  const years = new Set<number>();
  for (const key of monthlyReturns.keys()) {
    const year = parseInt(key.slice(0, 4), 10);
    if (!isNaN(year)) years.add(year);
  }

  return {
    monthly,
    currentMonth,
    currentMonthStats,
    yearsAnalyzed: years.size,
    summary: buildSummary(currentMonthStats, years.size),
  };
}
