/**
 * Níveis de risco (entrada, SL, TP1-3) por múltiplos de ATR — do `EngineConfig`.
 * Os múltiplos estão marcados [NÃO CALIBRADO]; calibração entra no M2 (backtest).
 */
import type { Candle, SignalDirection } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import type { EngineConfig } from "../config";
import type { RiskOutput } from "../types";
import { atr } from "../indicators/volatility";
import { last } from "../math/series";

export function computeRisk(
  candles: Candle[],
  signal: SignalDirection,
  config: EngineConfig,
): RiskOutput {
  return computeRiskFrom(last(candles).close, atr(candles, 14), signal, config);
}

/**
 * Variante que recebe `entry` e `atrVal` já calculados — usada pelo backtest
 * incremental (`runAnalysisAt`) com ATR pré-computado. `computeRisk` delega aqui,
 * então os dois caminhos são idênticos por construção.
 */
export function computeRiskFrom(
  entry: number,
  atrVal: number,
  signal: SignalDirection,
  config: EngineConfig,
): RiskOutput {
  const side = signalSide(signal);
  const { slMult, tp1Mult, tp2Mult, tp3Mult } = config.risk;

  let stopLoss = entry;
  let takeProfit1 = entry;
  let takeProfit2 = entry;
  let takeProfit3 = entry;

  if (side === "buy") {
    stopLoss = entry - atrVal * slMult;
    takeProfit1 = entry + atrVal * tp1Mult;
    takeProfit2 = entry + atrVal * tp2Mult;
    takeProfit3 = entry + atrVal * tp3Mult;
  } else if (side === "sell") {
    stopLoss = entry + atrVal * slMult;
    takeProfit1 = entry - atrVal * tp1Mult;
    takeProfit2 = entry - atrVal * tp2Mult;
    takeProfit3 = entry - atrVal * tp3Mult;
  }

  const distSL = Math.abs(entry - stopLoss);
  const distTP1 = Math.abs(takeProfit1 - entry);
  const rr1 = distSL === 0 ? 0 : distTP1 / distSL;

  return { entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, rr1, distSL, distTP1 };
}

/** Risco "zerado" (sinal sem direção). */
export function neutralRisk(entry: number): RiskOutput {
  return {
    entry,
    stopLoss: entry,
    takeProfit1: entry,
    takeProfit2: entry,
    takeProfit3: entry,
    rr1: 0,
    distSL: 0,
    distTP1: 0,
  };
}
