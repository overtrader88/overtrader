/**
 * Confluência Multi-Timeframe — PARTE PURA (combinador).
 *
 * No v1 este módulo fazia I/O (buscava candles de TFs adjacentes e rodava a
 * engine). Na arquitetura v2, o fetch + análise dos TFs superiores acontece na
 * BORDA (M4); aqui fica só a combinação pura: dados os resultados já calculados
 * de current/higher/highest, calcula o score de confluência e o alinhamento.
 *
 * Pesos e limiares vêm do `EngineConfig.multiTimeframe`.
 */
import type { SignalDirection, Timeframe } from "@tradeai/shared";
import { signalSide, TIMEFRAMES } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import type { AnalysisResult } from "../types";
import { NAMES } from "../signal/votes";

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  signal: SignalDirection;
  strength: number;
  confluence: number;
  side: "buy" | "sell" | "neutral";
  trendDirection: "up" | "down" | "neutral";
  bias: "bullish" | "bearish" | "neutral";
}

export type AlignmentLevel = "fully_aligned" | "partially_aligned" | "divergent" | "neutral";

export interface MultiTimeframeResult {
  current: TimeframeAnalysis;
  higher: TimeframeAnalysis | null;
  highest: TimeframeAnalysis | null;
  /** 0-100, % ponderado de TFs concordando com a direção do current. */
  confluenceScore: number;
  alignment: AlignmentLevel;
  summary: string;
}

/** Os 2 timeframes imediatamente acima do atual (ex.: 1h → 4h, 1d). */
export function getHigherTimeframes(current: Timeframe): { higher: Timeframe | null; highest: Timeframe | null } {
  const idx = TIMEFRAMES.indexOf(current);
  if (idx === -1) return { higher: null, highest: null };
  return { higher: TIMEFRAMES[idx + 1] ?? null, highest: TIMEFRAMES[idx + 2] ?? null };
}

type MtfConfig = EngineConfig["multiTimeframe"];

function calculateScore(
  current: TimeframeAnalysis,
  higher: TimeframeAnalysis | null,
  highest: TimeframeAnalysis | null,
  cfg: MtfConfig,
): { score: number; alignment: AlignmentLevel } {
  const refs = [
    { tf: current, weight: 1 },
    higher ? { tf: higher, weight: cfg.higherWeight } : null,
    highest ? { tf: highest, weight: cfg.highestWeight } : null,
  ].filter((x): x is { tf: TimeframeAnalysis; weight: number } => x !== null);

  if (current.side === "neutral") {
    const allNeutral = refs.every((r) => r.tf.side === "neutral");
    return { score: 50, alignment: allNeutral ? "neutral" : "divergent" };
  }

  let totalWeight = 0;
  let agreeingWeight = 0;
  let opposingCount = 0;
  for (const r of refs) {
    totalWeight += r.weight;
    if (r.tf.side === current.side) agreeingWeight += r.weight;
    else if (r.tf.side !== "neutral") opposingCount++;
  }

  const raw = (agreeingWeight / totalWeight) * 100;
  const score = Math.max(0, Math.round(raw - opposingCount * cfg.opposingPenalty));
  const alignment: AlignmentLevel =
    score >= cfg.fullyAlignedMin ? "fully_aligned" : score >= cfg.partiallyAlignedMin ? "partially_aligned" : "divergent";
  return { score, alignment };
}

function sideLabel(s: "buy" | "sell" | "neutral"): string {
  return s === "buy" ? "compra" : s === "sell" ? "venda" : "neutro";
}

function buildSummary(
  current: TimeframeAnalysis,
  higher: TimeframeAnalysis | null,
  highest: TimeframeAnalysis | null,
  score: number,
  alignment: AlignmentLevel,
): string {
  const parts = [`${current.timeframe} = ${sideLabel(current.side)}`];
  if (higher) parts.push(`${higher.timeframe} = ${sideLabel(higher.side)}`);
  if (highest) parts.push(`${highest.timeframe} = ${sideLabel(highest.side)}`);
  const header =
    alignment === "fully_aligned" ? `Alinhamento total entre timeframes (score ${score}/100)`
      : alignment === "partially_aligned" ? `Alinhamento parcial (score ${score}/100)`
        : alignment === "divergent" ? `Divergência entre timeframes (score ${score}/100) — opere com cautela`
          : `Sem direção clara em nenhum timeframe (score ${score}/100)`;
  return `${header}. ${parts.join(" · ")}`;
}

/**
 * Combina os TFs já analisados num resultado de confluência. PURO — a borda
 * passa os `TimeframeAnalysis` de current/higher/highest já calculados.
 */
export function combineTimeframes(
  current: TimeframeAnalysis,
  higher: TimeframeAnalysis | null,
  highest: TimeframeAnalysis | null,
  config: MtfConfig = DEFAULT_ENGINE_CONFIG.multiTimeframe,
): MultiTimeframeResult {
  const { score, alignment } = calculateScore(current, higher, highest, config);
  return {
    current,
    higher,
    highest,
    confluenceScore: score,
    alignment,
    summary: buildSummary(current, higher, highest, score, alignment),
  };
}

/**
 * Converte um `AnalysisResult` num `TimeframeAnalysis`. `bias` (viés SMC) é
 * opcional — a borda passa se tiver rodado a camada SMC daquele TF.
 */
export function toTimeframeAnalysis(
  result: AnalysisResult,
  bias: "bullish" | "bearish" | "neutral" = "neutral",
): TimeframeAnalysis {
  const ema200 = result.indicators.find((i) => i.name === NAMES.ema200);
  const trendDirection: "up" | "down" | "neutral" = ema200
    ? ema200.vote === "BUY" ? "up" : ema200.vote === "SELL" ? "down" : "neutral"
    : "neutral";
  return {
    timeframe: result.meta.timeframe,
    signal: result.signal.signal,
    strength: result.signal.strength,
    confluence: result.signal.confluence,
    side: signalSide(result.signal.signal),
    trendDirection,
    bias,
  };
}
