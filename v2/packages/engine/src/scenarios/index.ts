/**
 * Cenários Compra E Venda — probabilidade por SIMULAÇÃO (first-passage).
 *
 * Reescrita honesta do dual-scenarios do v1:
 *   - Probabilidade de TP/SL vem das trajetórias do Monte Carlo (com IC Wilson),
 *     NÃO da aproximação fechada `2·(1−Φ(d))` (válida só com drift≈0).
 *   - O "score" mágico (1.5·TP1 + 2.5·TP2 + 3.75·TP3 − 3·SL) foi substituído por
 *     **R esperado** derivado da distribuição de desfechos.
 *   - `recommended` = lado com maior R esperado.
 */
import type { Candle } from "@tradeai/shared";
import type { Estimate } from "../types";
import { DEFAULT_ENGINE_CONFIG } from "../config";
import { last } from "../math/series";
import { firstPassageOutcomes, type BarrierLevels } from "../montecarlo";

export interface ScenarioTp {
  price: number;
  /** Distância % até o preço atual. */
  distancePct: number;
  /** P(tocar este TP antes do stop), com IC. */
  probability: Estimate;
}

export interface ScenarioSide {
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: ScenarioTp;
  tp2: ScenarioTp;
  tp3: ScenarioTp;
  /** P(bater o stop antes do TP1), com IC. */
  stopProbability: Estimate;
  /** R esperado (regra exit-tp1). Substitui o "score" arbitrário do v1. */
  expectedR: number;
}

export interface DualScenarios {
  buy: ScenarioSide;
  sell: ScenarioSide;
  recommended: "buy" | "sell";
  /** Diferença de R esperado entre o recomendado e o outro lado. */
  edge: number;
  horizonCandles: number;
  simulations: number;
}

export interface DualScenariosOptions {
  /** Múltiplos de ATR (default = config de risco do v1.1). */
  slMult?: number;
  tp1Mult?: number;
  tp2Mult?: number;
  tp3Mult?: number;
  horizon?: number;
  simulations?: number;
  seed?: number;
}

function buildSide(candles: Candle[], current: number, levels: BarrierLevels, opts: DualScenariosOptions): ScenarioSide {
  const fp = firstPassageOutcomes(candles, levels, {
    horizon: opts.horizon ?? DEFAULT_ENGINE_CONFIG.scenarios.horizon,
    simulations: opts.simulations,
    seed: opts.seed,
  });
  const tp = (price: number, probability: Estimate): ScenarioTp => ({
    price,
    distancePct: ((price - current) / current) * 100,
    probability,
  });
  return {
    side: levels.side,
    entry: levels.entry,
    stopLoss: levels.stopLoss,
    tp1: tp(levels.tp1, fp.tp1),
    tp2: tp(levels.tp2, fp.tp2),
    tp3: tp(levels.tp3, fp.tp3),
    stopProbability: fp.stop,
    expectedR: fp.expectedR,
  };
}

export function buildDualScenarios(
  candles: Candle[],
  atr: number,
  options: DualScenariosOptions = {},
): DualScenarios {
  const r = DEFAULT_ENGINE_CONFIG.risk;
  const slMult = options.slMult ?? r.slMult;
  const tp1Mult = options.tp1Mult ?? r.tp1Mult;
  const tp2Mult = options.tp2Mult ?? r.tp2Mult;
  const tp3Mult = options.tp3Mult ?? r.tp3Mult;
  const entry = last(candles).close;

  const buyLevels: BarrierLevels = {
    side: "buy",
    entry,
    stopLoss: entry - atr * slMult,
    tp1: entry + atr * tp1Mult,
    tp2: entry + atr * tp2Mult,
    tp3: entry + atr * tp3Mult,
  };
  const sellLevels: BarrierLevels = {
    side: "sell",
    entry,
    stopLoss: entry + atr * slMult,
    tp1: entry - atr * tp1Mult,
    tp2: entry - atr * tp2Mult,
    tp3: entry - atr * tp3Mult,
  };

  const buy = buildSide(candles, entry, buyLevels, options);
  const sell = buildSide(candles, entry, sellLevels, options);
  const recommended = buy.expectedR >= sell.expectedR ? "buy" : "sell";

  return {
    buy,
    sell,
    recommended,
    edge: Math.abs(buy.expectedR - sell.expectedR),
    horizonCandles: options.horizon ?? DEFAULT_ENGINE_CONFIG.scenarios.horizon,
    simulations: buy.tp1.probability.n,
  };
}
