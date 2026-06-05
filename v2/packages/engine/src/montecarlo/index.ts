/**
 * Monte Carlo — projeção probabilística por GBM determinístico.
 *
 * Diferenças vs v1 (honestidade):
 *   - `winRateUp` vem com intervalo de confiança (Wilson), não número cru.
 *   - Volatilidade anualizada usa `periodsPerYear(assetType, timeframe)` —
 *     corrige o `stepsPerYear` fixo (2160) que errava forex/ações.
 *   - Probabilidade de toque de níveis vem por FIRST-PASSAGE simulado
 *     (`firstPassageOutcomes`), não por fórmula fechada enviesada.
 */
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { Candle } from "@tradeai/shared";
import type { Estimate } from "../types";
import { DEFAULT_ENGINE_CONFIG } from "../config";
import { percentile, wilsonInterval } from "../stats";
import { periodsPerYear } from "../math/calendar";
import { simulate, type BarrierLevels } from "./simulate";

export * from "./simulate";

export interface MonteCarloOptions {
  horizon?: number;
  simulations?: number;
  seed?: number;
  assetType: AssetType;
  timeframe: Timeframe;
}

export interface MonteCarloResult {
  simulations: number;
  horizonCandles: number;
  currentPrice: number;
  /** Percentil 90 do preço projetado. */
  optimistic: number;
  /** Percentil 50 (mediana). */
  median: number;
  /** Percentil 10. */
  pessimistic: number;
  /** Proporção de trajetórias que terminam acima do preço atual (0..1) + IC. */
  winRateUp: Estimate;
  volatilityPerStep: number;
  /** Volatilidade anualizada em % (corrigida por mercado/timeframe). */
  volatilityAnnualized: number;
  driftPerStep: number;
}

const DEFAULT_HORIZON = DEFAULT_ENGINE_CONFIG.monteCarlo.horizon;
const DEFAULT_SIMS = DEFAULT_ENGINE_CONFIG.monteCarlo.simulations;
const DEFAULT_SEED = DEFAULT_ENGINE_CONFIG.monteCarlo.seed;

export function runMonteCarlo(candles: Candle[], options: MonteCarloOptions): MonteCarloResult {
  const horizon = options.horizon ?? DEFAULT_HORIZON;
  const simulations = options.simulations ?? DEFAULT_SIMS;
  const seed = options.seed ?? DEFAULT_SEED;

  const sim = simulate({ candles, horizon, simulations, seed });

  let up = 0;
  for (const e of sim.endpoints) if (e > sim.currentPrice) up++;

  const periods = periodsPerYear(options.assetType, options.timeframe);

  return {
    simulations,
    horizonCandles: horizon,
    currentPrice: sim.currentPrice,
    optimistic: percentile(sim.endpoints, 0.9),
    median: percentile(sim.endpoints, 0.5),
    pessimistic: percentile(sim.endpoints, 0.1),
    winRateUp: wilsonInterval(up, simulations),
    volatilityPerStep: sim.volatilityPerStep,
    volatilityAnnualized: sim.volatilityPerStep * Math.sqrt(periods) * 100,
    driftPerStep: sim.driftPerStep,
  };
}

export interface FirstPassageOutcomes {
  side: "buy" | "sell";
  /** P(tocar TPk antes do stop), 0..1, com IC de Wilson. */
  tp1: Estimate;
  tp2: Estimate;
  tp3: Estimate;
  /** P(bater o stop antes do TP1), 0..1, com IC. */
  stop: Estimate;
  /** R esperado sob a regra "sai no TP1 ou no SL". */
  expectedR: number;
  simulations: number;
}

export interface FirstPassageOptions {
  horizon?: number;
  simulations?: number;
  seed?: number;
}

export function firstPassageOutcomes(
  candles: Candle[],
  levels: BarrierLevels,
  options: FirstPassageOptions = {},
): FirstPassageOutcomes {
  const horizon = options.horizon ?? DEFAULT_ENGINE_CONFIG.scenarios.horizon;
  const simulations = options.simulations ?? DEFAULT_SIMS;
  const seed = options.seed ?? DEFAULT_SEED;

  const sim = simulate({ candles, horizon, simulations, seed, levels });
  const p = sim.passage!;

  return {
    side: levels.side,
    tp1: wilsonInterval(p.tp1Before, simulations),
    tp2: wilsonInterval(p.tp2Before, simulations),
    tp3: wilsonInterval(p.tp3Before, simulations),
    stop: wilsonInterval(p.slBeforeTp1, simulations),
    expectedR: simulations > 0 ? p.sumR / simulations : 0,
    simulations,
  };
}
