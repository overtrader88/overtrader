/**
 * Pipeline principal — PURO e determinístico.
 *
 * Entra `AnalysisInput`, sai `AnalysisResult`. Sem I/O, sem rede, sem
 * `Date.now()` interno: o `generatedAt` é injetado pela borda (API route).
 * Isso é o que torna os testes golden reprodutíveis e o motor auditável.
 */
import type { SignalDirection } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import type { AnalysisInput, AnalysisResult, RiskOutput, SignalOutput } from "../types";
import { computeIndicatorValues } from "../indicators";
import { buildIndicatorResults } from "../signal/votes";
import { computeSignal } from "../signal/aggregate";
import { computeConditionalSignal } from "../signal/conditional";
import { computeMarketRegime } from "../regime";
import { computeRisk, neutralRisk } from "../risk";
import { computeGates, CRITICAL_GATE_IDS } from "../gates";
import { buildExplanation } from "./explain";
import { last } from "../math/series";

export const ENGINE_VERSION = "v2.0.0-m1";

export interface RunOptions {
  config?: EngineConfig;
  /** Timestamp ms injetado pela borda. Default 0 (determinístico). */
  generatedAt?: number;
}

/** Downgrade de sinal quando gates críticos falham. Exportado p/ reuso no backtest incremental. */
export function downgrade(signal: SignalDirection): SignalDirection {
  if (signal === "STRONG_BUY" || signal === "BUY") return "WEAK_BUY";
  if (signal === "STRONG_SELL" || signal === "SELL") return "WEAK_SELL";
  return "NEUTRAL"; // já era fraco e falhou gates críticos
}

export function runAnalysis(input: AnalysisInput, options: RunOptions = {}): AnalysisResult {
  const config = options.config ?? DEFAULT_ENGINE_CONFIG;
  const generatedAt = options.generatedAt ?? 0;

  if (input.candles.length < config.minCandles) {
    throw new Error(
      `Mínimo ${config.minCandles} candles necessários para análise confiável. Recebidos: ${input.candles.length}`,
    );
  }

  const values = computeIndicatorValues(input.candles);
  const indicators = buildIndicatorResults(values, config);
  const regimeInfo = computeMarketRegime(input.candles, config);
  const baseSignal = config.signal.conditionalByRegime
    ? computeConditionalSignal(values, regimeInfo.regime, config)
    : computeSignal(indicators, config, regimeInfo.regime);
  const baseRisk = computeRisk(input.candles, baseSignal.signal, config);
  const gates = computeGates(input.candles, baseSignal, indicators, baseRisk, regimeInfo, config);

  // Downgrade quando gates críticos (A/D) falham.
  let signal: SignalOutput = baseSignal;
  let risk: RiskOutput = baseRisk;
  const criticalFail = gates.some(
    (g) => !g.passed && (CRITICAL_GATE_IDS as readonly string[]).includes(g.id),
  );

  if (criticalFail && baseSignal.signal !== "NEUTRAL") {
    const downgraded = downgrade(baseSignal.signal);
    signal = { ...baseSignal, signal: downgraded, strength: Math.min(baseSignal.strength, 50) };
    if (downgraded === "NEUTRAL") risk = neutralRisk(last(input.candles).close);
  }

  const explanation = buildExplanation(
    signal,
    indicators,
    gates,
    risk,
    input.symbol,
    input.timeframe,
  );

  return {
    signal,
    risk,
    indicators,
    gates,
    explanation,
    meta: {
      asset: input.symbol,
      assetType: input.assetType,
      timeframe: input.timeframe,
      candlesUsed: input.candles.length,
      generatedAt,
      engineVersion: ENGINE_VERSION,
      regime: regimeInfo.regime,
      adxValue: regimeInfo.adxValue,
      atrRatio: regimeInfo.atrRatio,
    },
  };
}
