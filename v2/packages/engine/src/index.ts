/**
 * @tradeai/engine — motor de análise PURO (sem I/O, sem rede, sem DB).
 *
 * M1: indicadores + stats (IC) + signal/regime/risk/gates config-driven +
 * `runAnalysis`. Camadas probabilísticas (Monte Carlo, backtest, sazonalidade)
 * entram no M2.
 */
export { runAnalysis, ENGINE_VERSION, type RunOptions } from "./analysis/run";

export * from "./types";
export * from "./config";
export * as stats from "./stats";

// Submódulos puros (úteis para testes e para a borda).
export * from "./indicators";
export { ratioToSignal, signalLabel } from "./signal/levels";
export { buildIndicatorResults, NAMES } from "./signal/votes";
export { computeSignal } from "./signal/aggregate";
export { computeConditionalSignal } from "./signal/conditional";
export {
  crossSectionalMomentum,
  walkForwardCrossSectional,
  type CsAsset,
  type CrossSectionalOptions,
  type CrossSectionalResult,
  type CrossSectionalStats,
  type WalkForwardOptions,
  type WalkForwardConfig,
  type WalkForwardResult,
} from "./cross-sectional";
export { computeMarketRegime, type RegimeInfo } from "./regime";
export { computeRisk, computeRiskFrom, neutralRisk } from "./risk";
export { computeGates, CRITICAL_GATE_IDS } from "./gates";

// Camadas probabilísticas (M2) — funções puras compostas pela borda.
export {
  runMonteCarlo,
  firstPassageOutcomes,
  type MonteCarloResult,
  type MonteCarloOptions,
  type FirstPassageOutcomes,
  type BarrierLevels,
} from "./montecarlo";
export {
  buildDualScenarios,
  type DualScenarios,
  type ScenarioSide,
  type ScenarioTp,
} from "./scenarios";
export {
  analyzeSeasonality,
  type SeasonalityResult,
  type MonthlyStats,
} from "./seasonality";
export {
  runBacktest,
  isValidStrategy,
  BACKTEST_STRATEGIES,
  type BacktestStrategy,
  type BacktestSummary,
  type BacktestTrade,
} from "./backtest";
export {
  computeQualityBanner,
  DEFAULT_QUALITY_THRESHOLDS,
  type QualityBanner,
  type BannerStatus,
  type QualityThresholds,
} from "./quality";
export {
  analyzeSessionHeatmap,
  type HeatCell,
  type HeatMarginal,
  type SessionHeatmapResult,
} from "./sessions";
export {
  resolveOutcome,
  resolveLifecycle,
  aggregateTrackRecord,
  type SignalOutcome,
  type SignalPlan,
  type ResolvedOutcome,
  type LifecycleState,
  type StopStage,
  type TrackRecordStats,
} from "./track-record";
export { periodsPerYear } from "./math/calendar";
export { mulberry32, gaussianSampler, type Rng } from "./math/random";

// Camadas qualitativas (M3) — funções puras compostas pela borda.
export { findSwingPoints, findAlternatingSwings, type SwingPoint } from "./math/swings";
export {
  analyzeSmc,
  type SmcResult,
  type OrderBlock,
  type FairValueGap,
  type LiquidityZone,
  type MarketStructure,
} from "./smc";
export {
  detectHarmonics,
  type HarmonicResult,
  type HarmonicPattern,
  type HarmonicName,
} from "./harmonics";
export {
  analyzeWegd,
  type WegdResult,
  type WyckoffResult,
  type ElliottResult,
  type GannResult,
  type DowResult,
} from "./wegd";

// Confluência Multi-Timeframe (M4) — combinador puro; o fetch dos TFs fica na borda.
export {
  combineTimeframes,
  getHigherTimeframes,
  toTimeframeAnalysis,
  type TimeframeAnalysis,
  type AlignmentLevel,
  type MultiTimeframeResult,
} from "./multi-timeframe";

// Harness de calibração (M4) — roda backtest em lote e reporta os experimentos do brainstorm.
export {
  runCalibrationSweep,
  runParamSweep,
  oosWithinIsCI,
  syntheticCandles,
  type SweepCase,
  type CaseReport,
  type SweepReport,
  type ConfigVariant,
  type ParamVariantResult,
} from "./calibration";
