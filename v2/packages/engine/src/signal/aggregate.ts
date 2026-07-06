/**
 * Agrega os votos dos indicadores num sinal final: ratio ponderado →
 * 7 níveis, força (0-100) e confluência (0-10). Pesos por categoria e
 * multiplicadores por regime vêm do `EngineConfig`.
 */
import type { MarketRegime, SignalOutput } from "../types";
import type { IndicatorResult } from "../types";
import type { EngineConfig } from "../config";
import { ratioToSignal } from "./levels";
import { signalSide } from "@tradeai/shared";
import { NAMES } from "./votes";

type IndType = "trend" | "mean-reversion" | "neutral";

const TYPE_BY_NAME: Record<string, IndType> = {
  [NAMES.ema20]: "trend",
  [NAMES.ema50]: "trend",
  [NAMES.ema200]: "trend",
  [NAMES.sma50]: "trend",
  [NAMES.vwma20]: "trend",
  [NAMES.adx]: "trend",
  [NAMES.supertrend]: "trend",
  [NAMES.trix]: "trend",
  [NAMES.macd]: "trend",
  [NAMES.roc]: "trend",
  [NAMES.awesome]: "trend",
  [NAMES.obv]: "trend",
  [NAMES.cmf]: "trend",
  [NAMES.rsi]: "mean-reversion",
  [NAMES.stoch]: "mean-reversion",
  [NAMES.cci]: "mean-reversion",
  [NAMES.williamsR]: "mean-reversion",
  [NAMES.mfi]: "mean-reversion",
  [NAMES.bollinger]: "mean-reversion",
  [NAMES.atr]: "neutral",
};

function regimeMultiplier(config: EngineConfig, regime: MarketRegime, type: IndType): number {
  if (type === "neutral") return 1;
  const m = config.regimeMultipliers[regime];
  return type === "trend" ? m.trend : m.meanReversion;
}

/** Indicadores cuja semântica IMPLEMENTADA é momentum (achado 1 + matriz de
 *  concordância): candidatos à reclassificação 'trend' no experimento gateado
 *  `regimeAwareTrendClass` (variante 'fade-ranging+trend-class'). */
const MOMENTUM_MISLABELED: ReadonlySet<string> = new Set([NAMES.rsi, NAMES.stoch, NAMES.cci, NAMES.mfi]);

export function computeSignal(
  indicators: IndicatorResult[],
  config: EngineConfig,
  regime: MarketRegime,
): SignalOutput {
  let buy = 0;
  let sell = 0;
  let neutral = 0;
  let weightedBuy = 0;
  let weightedSell = 0;

  // Experimento gateado (default false): em TRENDING, trata RSI/Stoch/CCI/MFI
  // como 'trend' no multiplicador (a semântica deles como implementada é
  // momentum; o rótulo mean-reversion corta pela metade votos alinhados).
  const reclass = config.signal.regimeAwareTrendClass && regime === "trending";

  for (const ind of indicators) {
    const baseW = config.categoryWeights[ind.category] ?? 1;
    const type: IndType = reclass && MOMENTUM_MISLABELED.has(ind.name)
      ? "trend"
      : TYPE_BY_NAME[ind.name] ?? "neutral";
    const w = baseW * regimeMultiplier(config, regime, type);
    if (ind.vote === "BUY") {
      buy++;
      weightedBuy += w;
    } else if (ind.vote === "SELL") {
      sell++;
      weightedSell += w;
    } else {
      neutral++;
    }
  }

  const total = weightedBuy + weightedSell;
  const ratio = total === 0 ? 0.5 : weightedBuy / total;
  const signal = ratioToSignal(ratio);
  const strength = Math.round(Math.abs(ratio - 0.5) * 200);

  const side = signalSide(signal);
  const aligned = side === "buy" ? buy : side === "sell" ? sell : neutral;
  const confluence = indicators.length === 0
    ? 0
    : Math.min(10, Math.round((aligned / indicators.length) * 10));

  return { signal, strength, confluence, votes: { buy, sell, neutral } };
}
