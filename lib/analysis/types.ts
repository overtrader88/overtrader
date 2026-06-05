/**
 * Tipos do motor de análise.
 */
import type { AssetType, Candle, Timeframe } from "@/lib/market/types";
import type { SmcResult } from "./smc";
import type { MultiTimeframeResult } from "./multi-timeframe";
import type { MonteCarloResult } from "./monte-carlo";
import type { SeasonalityResult } from "./seasonality";
import type { DualScenarios } from "./dual-scenarios";
import type { HarmonicResult } from "./harmonics";
import type { WegdResult } from "./wegd";

/**
 * 7 níveis de sinal — escala graduada de aderência dos indicadores.
 *
 *   STRONG_SELL  — confluência forte vendedora (ratio < 0.20)
 *   SELL         — vendedor consistente             (0.20–0.35)
 *   WEAK_SELL    — vendedor fraco / divergente       (0.35–0.45)
 *   NEUTRAL      — divisão dos indicadores           (0.45–0.55)
 *   WEAK_BUY     — comprador fraco / divergente      (0.55–0.65)
 *   BUY          — comprador consistente             (0.65–0.80)
 *   STRONG_BUY   — confluência forte compradora      (> 0.80)
 *
 * O "voto" de cada indicador continua sendo o trio simples
 * (BUY / SELL / NEUTRAL) — a graduação fina aplica-se apenas
 * ao sinal final agregado.
 */
export type SignalDirection =
  | "STRONG_BUY"
  | "BUY"
  | "WEAK_BUY"
  | "NEUTRAL"
  | "WEAK_SELL"
  | "SELL"
  | "STRONG_SELL";

/** Voto individual de um indicador — granularidade simples. */
export type IndicatorVote = "BUY" | "SELL" | "NEUTRAL";

export interface IndicatorResult {
  /** Nome curto do indicador (ex.: "RSI (14)") */
  name: string;
  /** Categoria visual (Tendência, Oscilador, Volume, Volatilidade, Ichimoku) */
  category: string;
  /** Valor calculado (pode ser objeto se for composto) */
  value: number | Record<string, number>;
  /** Voto do indicador — sempre BUY/SELL/NEUTRAL (granularidade simples) */
  vote: IndicatorVote;
  /** Texto explicativo curto */
  note?: string;
}

export interface GateResult {
  /** Identificador interno do Gate (A, B, C, D, E, F) */
  id: string;
  /** Nome amigável */
  name: string;
  passed: boolean;
  detail: string;
}

export interface SignalOutput {
  signal: SignalDirection;
  /** Força do sinal 0-100 */
  strength: number;
  /** Confluência 0-10 (quantos indicadores votaram igual ao sinal final) */
  confluence: number;
  /** Detalhamento dos indicadores votantes */
  votes: { buy: number; sell: number; neutral: number };
}

export interface RiskOutput {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  /** Razão risco/retorno do TP1 */
  rr1: number;
  /** Distâncias absolutas (úteis pra debug e UI) */
  distSL: number;
  distTP1: number;
}

export interface AnalysisInput {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  candles: Candle[];
}

export interface AnalysisResult {
  // Saídas principais
  signal: SignalOutput;
  risk: RiskOutput;
  indicators: IndicatorResult[];
  gates: GateResult[];
  /** Smart Money Concepts (Sprint 9.1): OBs, FVGs, liquidez, BOS/CHoCH */
  smc?: SmcResult;
  /** Multi-Timeframe Confluence (Sprint 9.2): alinhamento entre TFs adjacentes */
  multiTimeframe?: MultiTimeframeResult | null;
  /** Monte Carlo simulation (Sprint 9.3): cenarios probabilisticos */
  monteCarlo?: MonteCarloResult;
  /** Sazonalidade historica (Sprint 9.4): performance media por mes */
  seasonality?: SeasonalityResult;
  /** Cenarios Compra E Venda lado a lado (Sprint 9.5) com prob por TP */
  dualScenarios?: DualScenarios | null;
  /** Padroes Harmonicos XABCD (Sprint 9.6): Bat, Butterfly, Gartley, etc */
  harmonics?: HarmonicResult;
  /** WEGD - Wyckoff/Elliott/Gann/Dow (Sprint 9.10) */
  wegd?: WegdResult;
  /** Noticias + sentimento macro (Sprint 9.11) — preenchido na API route, nao na engine */
  news?: {
    items: Array<{
      title: string;
      url: string;
      source: string;
      publishedAt: string;
      sentiment?: "positive" | "negative" | "neutral" | "important";
      summary?: string;
    }>;
    sentiment: {
      overall: "bullish" | "bearish" | "neutral" | "mixed";
      score: number;
      summary: string;
      newsCount: number;
    } | null;
  };
  /** Texto descritivo gerado por heurística (placeholder do LLM do Sprint 4) */
  explanation: {
    summary: string;
    bullets: string[];
  };
  // Metadata
  meta: {
    asset: string;
    assetType: AssetType;
    timeframe: Timeframe;
    candlesUsed: number;
    generatedAt: number; // timestamp ms
    enginVersion: string;
    /** Regime de mercado detectado (v1.1+) */
    regime?: "trending" | "ranging" | "transitional" | "explosive";
    /** Valor do ADX no candle atual (v1.1+) */
    adxValue?: number;
    /** ATR atual / ATR médio dos últimos 50 candles (v1.1+) */
    atrRatio?: number;
  };
}
