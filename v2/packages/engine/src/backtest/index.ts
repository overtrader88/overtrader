/**
 * Backtest walk-forward — porta a lógica CORRETA do v1 (sem lookahead) e
 * implementa a decisão de janela do M4 (brainstorm 03/06/2026):
 *   - JANELA DIRIGIDA POR AMOSTRA: teto de calendário por classe de ativo
 *     (24m cripto/commodities, 36m forex/ações/índices) e `sampleSufficient`
 *     baseado em trades DECISIVOS (win+SL), não em calendário fixo.
 *   - SEGMENTADO POR REGIME: métricas por regime de mercado (cada uma com IC),
 *     reusando `meta.regime` que o `runAnalysis` já calcula.
 *   - OUT-OF-SAMPLE: split treino/teste cronológico; o selo de qualidade exige
 *     que o desempenho não colapse no teste (defesa nº 1 contra overfitting).
 *
 * Métricas sempre com IC: winRate (Wilson), avgR (t-Student), profitFactor (bootstrap).
 */
import type { AnalysisInput, Estimate, MarketRegime } from "../types";
import type { EngineConfig } from "../config";
import { isActionable, signalSide } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG } from "../config";
import { precomputeBase, runAnalysisAt } from "./precompute";
import { periodsPerYear } from "../math/calendar";
import { meanConfidenceInterval, wilsonInterval, bootstrapInterval } from "../stats";
import { mulberry32 } from "../math/random";

export type BacktestStrategy = "exit-tp1" | "move-to-breakeven" | "partial-exit";
export const BACKTEST_STRATEGIES: BacktestStrategy[] = ["exit-tp1", "move-to-breakeven", "partial-exit"];

export function isValidStrategy(s: unknown): s is BacktestStrategy {
  return s === "exit-tp1" || s === "move-to-breakeven" || s === "partial-exit";
}

export type Outcome = "TP1" | "TP2" | "TP3" | "BE" | "SL" | "EXPIRED";

export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  side: "buy" | "sell";
  signal: string;
  /** Regime de mercado no momento da entrada (p/ segmentação). */
  regime?: MarketRegime;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  outcome: Outcome;
  tp1Touched: boolean;
  durationCandles: number;
  pnlPoints: number;
  pnlR: number;
}

/** Métricas com IC sobre um conjunto de trades. */
export interface TradeMetrics {
  n: number;
  winRate: Estimate;
  profitFactor: Estimate;
  avgR: Estimate;
}

export interface BacktestSummary {
  strategy: BacktestStrategy;
  totalTrades: number;
  /** Trades decisivos (win + SL) — base da suficiência de amostra. */
  decisiveTrades: number;
  minDecisiveTrades: number;
  winRate: Estimate;
  profitFactor: Estimate;
  avgR: Estimate;
  maxDrawdownR: number;
  outcomes: Record<Outcome, number>;
  tp1TouchRate: number;
  /** Métricas por regime de mercado (só regimes com ≥1 trade). */
  byRegime: Partial<Record<MarketRegime, TradeMetrics>>;
  /** Desempenho fora da amostra (teste). null se amostra pequena demais p/ split. */
  outOfSample: TradeMetrics | null;
  trades: BacktestTrade[];
  candlesAvailable: number;
  candlesScanned: number;
  targetCandles: number;
  truncated: boolean;
  sampleSufficient: boolean;
}

export interface BacktestOptions {
  strategy?: BacktestStrategy;
  config?: EngineConfig;
  minCandlesForEngine?: number;
  maxTradeDuration?: number;
  cooldown?: number;
  partialExitFraction?: number;
  /** Sobrepõe o teto de calendário (candles). */
  maxCandlesToScan?: number;
  minDecisiveTrades?: number;
  oosFraction?: number;
  seed?: number;
}

function profitFactorStat(pnls: number[]): number {
  let g = 0;
  let l = 0;
  for (const r of pnls) {
    if (r > 0) g += r;
    else if (r < 0) l += -r;
  }
  if (l > 0) return Math.min(99, g / l);
  return g > 0 ? 99 : 0;
}

const STATIONARY: ReadonlySet<string> = new Set(["forex", "stocks", "indices"]);

/** Métricas com IC para um subconjunto de trades. `rng` torna o bootstrap determinístico. */
function metricsFromTrades(trades: BacktestTrade[], rng: () => number): TradeMetrics {
  let wins = 0;
  let sl = 0;
  const pnlRs: number[] = [];
  for (const t of trades) {
    if (t.outcome === "TP1" || t.outcome === "TP2" || t.outcome === "TP3") wins++;
    else if (t.outcome === "SL") sl++;
    pnlRs.push(t.pnlR);
  }
  return {
    n: trades.length,
    winRate: wilsonInterval(wins, wins + sl),
    profitFactor: bootstrapInterval(pnlRs, profitFactorStat, { iterations: 1000, rng }),
    avgR: meanConfidenceInterval(pnlRs),
  };
}

export function runBacktest(input: AnalysisInput, options: BacktestOptions = {}): BacktestSummary {
  const bc = DEFAULT_ENGINE_CONFIG.backtest;
  const strategy = options.strategy ?? "exit-tp1";
  const minCandles = options.minCandlesForEngine ?? bc.minCandlesForEngine;
  const maxDuration = options.maxTradeDuration ?? bc.maxTradeDuration;
  const cooldownReset = options.cooldown ?? bc.cooldown;
  const partialFraction = options.partialExitFraction ?? bc.partialExitFraction;
  const minDecisiveTrades = options.minDecisiveTrades ?? bc.minDecisiveTrades;
  const oosFraction = options.oosFraction ?? bc.oosFraction;
  const seed = options.seed ?? bc.seed;
  const candles = input.candles;

  // Janela por classe de ativo (teto de calendário). TFs de baixa frequência
  // (1d/1w/1M) usam janela maior p/ acumular trades decisivos suficientes.
  const lowFreq = input.timeframe === "1d" || input.timeframe === "1w" || input.timeframe === "1M";
  const baseMonths = STATIONARY.has(input.assetType) ? bc.targetMonthsStationary : bc.targetMonths;
  const targetMonths = lowFreq ? Math.max(baseMonths, bc.targetMonthsLowFreq) : baseMonths;
  const targetCandles = Math.round(periodsPerYear(input.assetType, input.timeframe) * (targetMonths / 12));
  const maxCandlesToScan = options.maxCandlesToScan ?? targetCandles;

  const emptyMetrics = (): TradeMetrics => ({
    n: 0,
    winRate: { value: 0, ci95: [0, 0], n: 0 },
    profitFactor: { value: 0, ci95: [0, 0], n: 0 },
    avgR: { value: 0, ci95: [0, 0], n: 0 },
  });

  if (candles.length < minCandles + 20) {
    return {
      strategy, totalTrades: 0, decisiveTrades: 0, minDecisiveTrades,
      ...emptyMetrics(), maxDrawdownR: 0,
      outcomes: { TP1: 0, TP2: 0, TP3: 0, BE: 0, SL: 0, EXPIRED: 0 },
      tp1TouchRate: 0, byRegime: {}, outOfSample: null, trades: [],
      candlesAvailable: candles.length, candlesScanned: 0, targetCandles,
      truncated: false, sampleSufficient: false,
    };
  }

  const start = minCandles;
  const end = Math.min(candles.length - 1, start + maxCandlesToScan);
  const trades: BacktestTrade[] = [];
  const usesBE = strategy === "move-to-breakeven" || strategy === "partial-exit";
  let cooldown = 0;

  // Caminho rápido: pré-computa as séries UMA vez (mata o O(n²)). A paridade
  // com runAnalysis(slice) é garantida por test/parity.test.ts.
  const base = precomputeBase(candles);
  const cfg = options.config ?? DEFAULT_ENGINE_CONFIG;

  // Custo de transação: bps por lado → preço. partial-exit tem um fill a mais.
  const costFrac = (cfg.costs.byAsset[input.assetType] ?? cfg.costs.perSideBps) / 10000;
  const costSides = strategy === "partial-exit" ? 3 : 2;

  for (let i = start; i < end; i++) {
    if (cooldown > 0) {
      cooldown--;
      continue;
    }

    const r = runAnalysisAt(candles, i, base, cfg);
    if (!isActionable(r.signal.signal)) continue;
    const side = signalSide(r.signal.signal);
    if (side === "neutral") continue;

    const entry = r.risk.entry;
    const sl = r.risk.stopLoss;
    const tp1 = r.risk.takeProfit1;
    const tp2 = r.risk.takeProfit2;
    const tp3 = r.risk.takeProfit3;
    const riskDistance = Math.abs(entry - sl);
    if (riskDistance === 0) continue;

    let outcome: Outcome = "EXPIRED";
    let exitIndex = i;
    let pnlPoints = 0;
    let tp1Touched = false;
    let effectiveStop = sl;
    let lockedPnl = 0;

    const markTp1Touched = (): void => {
      if (!tp1Touched) {
        tp1Touched = true;
        if (usesBE) effectiveStop = entry;
        if (strategy === "partial-exit") {
          const tp1Distance = side === "buy" ? tp1 - entry : entry - tp1;
          lockedPnl = partialFraction * tp1Distance;
        }
      }
    };

    for (let j = i + 1; j < Math.min(candles.length, i + maxDuration); j++) {
      const c = candles[j]!;
      if (side === "buy") {
        if (c.low <= effectiveStop) {
          if (tp1Touched && usesBE) { outcome = "BE"; pnlPoints = lockedPnl; }
          else { outcome = "SL"; pnlPoints = sl - entry; }
          exitIndex = j;
          break;
        }
        if (c.high >= tp3) { markTp1Touched(); outcome = "TP3"; exitIndex = j; pnlPoints = strategy === "partial-exit" ? lockedPnl + (1 - partialFraction) * (tp3 - entry) : tp3 - entry; break; }
        if (c.high >= tp2) { markTp1Touched(); outcome = "TP2"; exitIndex = j; pnlPoints = strategy === "partial-exit" ? lockedPnl + (1 - partialFraction) * (tp2 - entry) : tp2 - entry; break; }
        if (!tp1Touched && c.high >= tp1) {
          if (strategy === "exit-tp1") { tp1Touched = true; outcome = "TP1"; exitIndex = j; pnlPoints = tp1 - entry; break; }
          markTp1Touched();
        }
      } else {
        if (c.high >= effectiveStop) {
          if (tp1Touched && usesBE) { outcome = "BE"; pnlPoints = lockedPnl; }
          else { outcome = "SL"; pnlPoints = entry - sl; }
          exitIndex = j;
          break;
        }
        if (c.low <= tp3) { markTp1Touched(); outcome = "TP3"; exitIndex = j; pnlPoints = strategy === "partial-exit" ? lockedPnl + (1 - partialFraction) * (entry - tp3) : entry - tp3; break; }
        if (c.low <= tp2) { markTp1Touched(); outcome = "TP2"; exitIndex = j; pnlPoints = strategy === "partial-exit" ? lockedPnl + (1 - partialFraction) * (entry - tp2) : entry - tp2; break; }
        if (!tp1Touched && c.low <= tp1) {
          if (strategy === "exit-tp1") { tp1Touched = true; outcome = "TP1"; exitIndex = j; pnlPoints = entry - tp1; break; }
          markTp1Touched();
        }
      }
    }

    if (outcome === "EXPIRED") {
      exitIndex = Math.min(candles.length - 1, i + maxDuration - 1);
      const exitClose = candles[exitIndex]!.close;
      const fullPnl = side === "buy" ? exitClose - entry : entry - exitClose;
      pnlPoints = strategy === "partial-exit" && tp1Touched ? lockedPnl + (1 - partialFraction) * fullPnl : fullPnl;
    }

    // Líquido de custos (entrada + saída[s]). Penaliza stop apertado / alta freq.
    const netPnlPoints = pnlPoints - costSides * costFrac * entry;
    trades.push({
      entryIndex: i, exitIndex, entryPrice: entry, side, signal: r.signal.signal,
      regime: r.regime,
      stopLoss: sl, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3,
      outcome, tp1Touched, durationCandles: exitIndex - i,
      pnlPoints: netPnlPoints, pnlR: netPnlPoints / riskDistance,
    });
    cooldown = cooldownReset;
  }

  // ----- Estatísticas -----
  const outcomes: Record<Outcome, number> = { TP1: 0, TP2: 0, TP3: 0, BE: 0, SL: 0, EXPIRED: 0 };
  let tp1TouchCount = 0;
  for (const t of trades) {
    outcomes[t.outcome]++;
    if (t.tp1Touched || t.outcome === "TP1" || t.outcome === "TP2" || t.outcome === "TP3" || t.outcome === "BE") tp1TouchCount++;
  }
  const wins = outcomes.TP1 + outcomes.TP2 + outcomes.TP3;
  const decisiveTrades = wins + outcomes.SL;

  // Max drawdown em R (ordem cronológica de entrada).
  let running = 0;
  let peak = 0;
  let maxDdR = 0;
  for (const t of trades) {
    running += t.pnlR;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDdR) maxDdR = dd;
  }

  const rng = mulberry32(seed);
  const overall = metricsFromTrades(trades, rng);

  // Segmentação por regime.
  const byRegime: Partial<Record<MarketRegime, TradeMetrics>> = {};
  const regimes: MarketRegime[] = ["trending", "ranging", "transitional", "explosive"];
  for (const r of regimes) {
    const subset = trades.filter((t) => t.regime === r);
    if (subset.length > 0) byRegime[r] = metricsFromTrades(subset, mulberry32(seed + 1));
  }

  // Out-of-sample: últimos `oosFraction` dos trades (cronológico).
  let outOfSample: TradeMetrics | null = null;
  if (trades.length >= 20) {
    const testStart = Math.floor(trades.length * (1 - oosFraction));
    outOfSample = metricsFromTrades(trades.slice(testStart), mulberry32(seed + 2));
  }

  return {
    strategy,
    totalTrades: trades.length,
    decisiveTrades,
    minDecisiveTrades,
    winRate: overall.winRate,
    profitFactor: overall.profitFactor,
    avgR: overall.avgR,
    maxDrawdownR: maxDdR,
    outcomes,
    tp1TouchRate: trades.length > 0 ? tp1TouchCount / trades.length : 0,
    byRegime,
    outOfSample,
    trades: trades.slice(-100),
    candlesAvailable: candles.length,
    candlesScanned: end - start,
    targetCandles,
    truncated: targetCandles > end - start,
    sampleSufficient: decisiveTrades >= minDecisiveTrades,
  };
}
