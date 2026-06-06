/**
 * Composição do motor na BORDA — junta as camadas puras (análise + Monte Carlo
 * + cenários + backtest + selo) num DTO serializável `FullAnalysis`.
 *
 * O motor é puro e determinístico; aqui injetamos `generatedAt` (a borda é a
 * única que conhece o relógio). Não faz I/O: recebe os candles já buscados, então
 * é testável sem rede. `type: "simple"` calcula só o sinal (rápido/barato);
 * `"complete"` roda as camadas probabilísticas.
 */
import {
  runAnalysis, runMonteCarlo, buildDualScenarios, runBacktest, computeQualityBanner, atr, analyzeSmc, detectHarmonics, analyzeWegd, analyzeSeasonality, analyzeSessionHeatmap, combineTimeframes, toTimeframeAnalysis,
  type AnalysisInput, type AnalysisResult, type MonteCarloResult, type DualScenarios,
  type QualityBanner, type SmcResult, type HarmonicResult, type WegdResult, type SeasonalityResult, type SessionHeatmapResult, type MultiTimeframeResult,
} from "@tradeai/engine";
import type { Candle } from "@tradeai/shared";
import { toBacktestView, equityFromTrades, type BacktestView } from "./backtest-view";
import { computeVolumeProfile, type VolumeProfile } from "./volume-profile";
import { detectWyckoffEvents, type WyckoffEvent } from "./wyckoff-events";

export type { BacktestView };

export interface FullAnalysis {
  generatedAt: number;
  type: "simple" | "complete";
  /** Janela dos dados, legível (ex.: "jan/24–mai/26"). */
  period: string | null;
  analysis: AnalysisResult;
  montecarlo?: MonteCarloResult;
  scenarios?: DualScenarios;
  /** Smart Money Concepts — contexto institucional qualitativo (não probabilidade). */
  smc?: SmcResult;
  /** Padrões harmônicos (XABCD) — contexto qualitativo; `quality` é match de Fibonacci, não probabilidade. */
  harmonics?: HarmonicResult;
  /** WEGD (Wyckoff/Elliott/Gann/Dow) — leitura qualitativa heurística (escores, não probabilidades calibradas). */
  wegd?: WegdResult;
  /** Sazonalidade mensal — retorno médio + IC 95% + amostra por mês (honesto: cinza quando n insuficiente). */
  seasonality?: SeasonalityResult;
  /** Heatmap de horários (hora × dia, UTC) — retorno médio por janela; cinza quando amostra fraca. */
  sessions?: SessionHeatmapResult;
  /** Confluência multi-timeframe — composta na BORDA (precisa buscar os TFs superiores). */
  multiTimeframe?: MultiTimeframeResult;
  backtest?: BacktestView;
  quality?: QualityBanner;
  /** R acumulado por trade do backtest (curva de capital). */
  equityCurve?: number[];
  /** Perfil de volume (POC/VAH/VAL) — observado, não probabilístico. */
  volumeProfile?: VolumeProfile;
  /** Eventos Wyckoff (Spring/UTAD) detectados por varredura+reclaim. */
  wyckoffEvents?: WyckoffEvent[];
}

export interface RunFullOptions {
  generatedAt: number;
  type?: "simple" | "complete";
  /** Inputs dos TFs superiores (já buscados pela borda), em ordem [higher, highest]; null p/ ausente. Habilita a confluência multi-TF. */
  higherTimeframes?: (AnalysisInput | null)[];
  /**
   * Série DIÁRIA profunda dedicada à sazonalidade (buscada pela borda). A
   * sazonalidade mensal precisa de candles diários por vários anos (n≥5 por mês);
   * os candles do TF da análise não servem (intraday cobre só ~1-2 anos). Ausente
   * → cai para os candles da própria análise (degrada gracioso).
   */
  seasonalityCandles?: Candle[];
  /** Série 1h profunda para o heatmap de horários (hora × dia). Ausente → reusa os candles da análise. */
  heatmapCandles?: Candle[];
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthYear(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

function periodLabel(candles: AnalysisInput["candles"]): string | null {
  const first = candles.at(0);
  const lastC = candles.at(-1);
  if (!first || !lastC) return null;
  return `${monthYear(first.time)}–${monthYear(lastC.time)}`;
}

export function runFullAnalysis(input: AnalysisInput, options: RunFullOptions): FullAnalysis {
  const { generatedAt } = options;
  const type = options.type ?? "complete";
  const analysis = runAnalysis(input, { generatedAt });
  const period = periodLabel(input.candles);

  if (type === "simple") {
    return { generatedAt, type, period, analysis };
  }

  const { candles, assetType, timeframe } = input;
  const atr14 = atr(candles, 14);
  const montecarlo = runMonteCarlo(candles, { assetType, timeframe });
  const scenarios = buildDualScenarios(candles, atr14);
  const smc = analyzeSmc(candles, atr14);
  const harmonics = detectHarmonics(candles);
  const wegd = analyzeWegd(candles);
  const seasonality = analyzeSeasonality(options.seasonalityCandles ?? candles);
  const sessions = analyzeSessionHeatmap(options.heatmapCandles ?? candles);

  const higherInputs = options.higherTimeframes ?? [];
  let multiTimeframe: MultiTimeframeResult | undefined;
  if (higherInputs.some((x) => x !== null)) {
    const current = toTimeframeAnalysis(analysis, smc.bias);
    const tas = higherInputs.map((inp) => (inp ? toTimeframeAnalysis(runAnalysis(inp, { generatedAt })) : null));
    multiTimeframe = combineTimeframes(current, tas[0] ?? null, tas[1] ?? null);
  }

  const bt = runBacktest(input, {});
  const quality = computeQualityBanner(bt);
  const backtest = toBacktestView(bt);
  const volumeProfile = computeVolumeProfile(candles) ?? undefined;
  const wyckoffEvents = detectWyckoffEvents(candles);

  return { generatedAt, type, period, analysis, montecarlo, scenarios, smc, harmonics, wegd, seasonality, sessions, multiTimeframe, backtest, quality, equityCurve: equityFromTrades(bt.trades), volumeProfile, wyckoffEvents };
}
