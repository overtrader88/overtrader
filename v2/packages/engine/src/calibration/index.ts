/**
 * Harness de calibração — roda o backtest sobre um conjunto de casos e reporta
 * os experimentos de validação do brainstorm (decisão de janela do M4):
 *   - % de pares ativo×timeframe que atingem amostra suficiente;
 *   - % em que o desempenho out-of-sample fica DENTRO do IC in-sample
 *     (sinal de NÃO-overfitting; alvo do brainstorm ≥ 70%);
 *   - dispersão de profit factor entre regimes.
 *
 * É puro: recebe casos (candles) e devolve um relatório estruturado. A borda
 * (M4) alimenta com dados REAIS; até lá, `syntheticCandles` gera séries
 * determinísticas só para exercitar o encanamento (NÃO têm edge real).
 */
import type { AnalysisInput, MarketRegime } from "../types";
import type { BacktestSummary, BacktestOptions } from "../backtest";
import { runBacktest } from "../backtest";
import type { EngineConfig } from "../config";
import { mulberry32, gaussianSampler } from "../math/random";
import type { AssetType, Timeframe, Candle } from "@tradeai/shared";
import { TIMEFRAME_MS } from "@tradeai/shared";

export interface SweepCase {
  label: string;
  input: AnalysisInput;
}

export interface CaseReport {
  label: string;
  assetType: AssetType;
  timeframe: Timeframe;
  totalTrades: number;
  decisiveTrades: number;
  sampleSufficient: boolean;
  truncated: boolean;
  candlesScanned: number;
  targetCandles: number;
  profitFactor: number;
  winRate: number;
  /** OOS dentro do IC in-sample do PF? null se não houve split OOS. */
  oosWithinCI: boolean | null;
  regimes: MarketRegime[];
}

export interface SweepReport {
  cases: CaseReport[];
  summary: {
    n: number;
    sufficientPct: number;
    /** % (entre casos com OOS) em que o PF out-of-sample caiu dentro do IC in-sample. */
    oosWithinPct: number;
  };
}

/** O PF out-of-sample está dentro do IC in-sample? null se não houve split. */
export function oosWithinIsCI(s: BacktestSummary): boolean | null {
  if (!s.outOfSample) return null;
  const [lo, hi] = s.profitFactor.ci95;
  const v = s.outOfSample.profitFactor.value;
  return v >= lo && v <= hi;
}

export function runCalibrationSweep(cases: SweepCase[], options: BacktestOptions = {}): SweepReport {
  const reports: CaseReport[] = [];
  for (const c of cases) {
    const s = runBacktest(c.input, options);
    reports.push({
      label: c.label,
      assetType: c.input.assetType,
      timeframe: c.input.timeframe,
      totalTrades: s.totalTrades,
      decisiveTrades: s.decisiveTrades,
      sampleSufficient: s.sampleSufficient,
      truncated: s.truncated,
      candlesScanned: s.candlesScanned,
      targetCandles: s.targetCandles,
      profitFactor: s.profitFactor.value,
      winRate: s.winRate.value,
      oosWithinCI: oosWithinIsCI(s),
      regimes: Object.keys(s.byRegime) as MarketRegime[],
    });
  }

  const n = reports.length;
  const sufficient = reports.filter((r) => r.sampleSufficient).length;
  const withOos = reports.filter((r) => r.oosWithinCI !== null);
  const oosWithin = withOos.filter((r) => r.oosWithinCI === true).length;

  return {
    cases: reports,
    summary: {
      n,
      sufficientPct: n > 0 ? Math.round((sufficient / n) * 100) : 0,
      oosWithinPct: withOos.length > 0 ? Math.round((oosWithin / withOos.length) * 100) : 0,
    },
  };
}

/**
 * Candles SINTÉTICOS determinísticos (random walk GBM) — apenas para exercitar
 * o harness enquanto não há dados reais. NÃO representam mercado real e NÃO têm
 * edge; servem para validar plumbing, suficiência de amostra e cobertura.
 */
export function syntheticCandles(
  _assetType: AssetType,
  timeframe: Timeframe,
  n: number,
  seed = 1,
  start = 100,
): Candle[] {
  const rng = mulberry32(seed);
  const gauss = gaussianSampler(rng);
  const step = TIMEFRAME_MS[timeframe];
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const ret = 0.0004 + 0.012 * gauss(); // leve drift + vol
    const open = price;
    const close = Math.max(0.01, price * Math.exp(ret));
    const hi = Math.max(open, close) * (1 + Math.abs(gauss()) * 0.004);
    const lo = Math.min(open, close) * (1 - Math.abs(gauss()) * 0.004);
    out.push({ time: i * step, open, high: hi, low: lo, close, volume: 500 + Math.floor(rng() * 1500) });
    price = close;
  }
  return out;
}

// ============================================================
// Sweep de calibração de PARÂMETROS
// ============================================================

export interface ConfigVariant {
  label: string;
  config: EngineConfig;
}

export interface ParamVariantResult {
  label: string;
  /** Mediana do PF out-of-sample sobre casos com amostra suficiente. */
  oosPfMedian: number;
  /** Mediana do PF in-sample (mesma base). */
  isPfMedian: number;
  /** Mediana do win rate OOS (proporção 0..1). */
  oosWinRateMedian: number;
  /**
   * IQR do PF OOS entre os casos (dispersão — achado 5 da revisão 05/07/2026).
   * Proxy documentado do erro-padrão da mediana: SE ≈ IQR/1.35/sqrt(n_casos);
   * empates dentro de 1 SE resolvem por menos parâmetros + mais totalDecisive.
   */
  oosPfIqr: number;
  /** Soma dos trades DECISIVOS (win+SL) nos casos suficientes — desempate da regra 1-SE. */
  totalDecisive: number;
  /** Mediana do PF por regime de mercado (byRegime do BacktestSummary), sobre os casos suficientes. */
  byRegime: Partial<Record<MarketRegime, number>>;
  /** Casos com amostra suficiente. */
  sufficientCases: number;
  /** Casos cujo PF OOS > 1 (edge positivo fora da amostra). */
  positiveOosCases: number;
  totalCases: number;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Quantil linear-interpolado (q em 0..1) — base do IQR. */
function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

/**
 * Roda cada variante de config sobre todos os casos e agrega por desempenho
 * OUT-OF-SAMPLE (a métrica que importa — resistência a overfitting). Ordena da
 * melhor mediana de PF OOS para a pior. Caro: O(variantes × casos × backtest);
 * use histórico já buscado.
 */
export function runParamSweep(cases: SweepCase[], variants: ConfigVariant[]): ParamVariantResult[] {
  const results: ParamVariantResult[] = [];
  for (const v of variants) {
    const oosPfs: number[] = [];
    const isPfs: number[] = [];
    const oosWrs: number[] = [];
    const regimePfs: Partial<Record<MarketRegime, number[]>> = {};
    let sufficient = 0;
    let positiveOos = 0;
    let totalDecisive = 0;
    for (const c of cases) {
      const s = runBacktest(c.input, { config: v.config });
      if (!s.sampleSufficient || !s.outOfSample) continue;
      sufficient++;
      totalDecisive += s.decisiveTrades;
      oosPfs.push(s.outOfSample.profitFactor.value);
      isPfs.push(s.profitFactor.value);
      oosWrs.push(s.outOfSample.winRate.value);
      if (s.outOfSample.profitFactor.value > 1) positiveOos++;
      for (const [reg, m] of Object.entries(s.byRegime) as [MarketRegime, { profitFactor: { value: number } }][]) {
        (regimePfs[reg] ?? (regimePfs[reg] = [])).push(m.profitFactor.value);
      }
    }
    const byRegime: Partial<Record<MarketRegime, number>> = {};
    for (const [reg, pfs] of Object.entries(regimePfs) as [MarketRegime, number[]][]) {
      byRegime[reg] = median(pfs);
    }
    results.push({
      label: v.label,
      oosPfMedian: median(oosPfs),
      isPfMedian: median(isPfs),
      oosWinRateMedian: median(oosWrs),
      oosPfIqr: quantile(oosPfs, 0.75) - quantile(oosPfs, 0.25),
      totalDecisive,
      byRegime,
      sufficientCases: sufficient,
      positiveOosCases: positiveOos,
      totalCases: cases.length,
    });
  }
  return results.sort((a, b) => b.oosPfMedian - a.oosPfMedian);
}
