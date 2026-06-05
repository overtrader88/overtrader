/**
 * Tipos do motor de análise — v2 (portados e limpos do v1).
 *
 * Mudanças vs v1:
 *   - `enginVersion` (typo) → `engineVersion`.
 *   - Introduz o tipo `Estimate` (credibilidade-first): todo número estatístico
 *     carrega amostra (n), intervalo de confiança e período. É o coração do
 *     posicionamento "prova antes de prometer".
 *   - Os tipos das camadas (SMC, Monte Carlo, harmônicos, WEGD, etc.) serão
 *     adicionados nos seus módulos no M1/M2. Aqui ficam só os tipos centrais.
 */
import type { AssetType, Candle, IndicatorVote, SignalDirection, Timeframe } from "@tradeai/shared";

/**
 * Estimativa estatística honesta. Em vez de exibir um número cru, o motor
 * carrega a incerteza junto: valor pontual, intervalo de confiança e tamanho
 * de amostra. A UI mostra isso via `ConfidenceBadge`.
 */
export interface Estimate {
  /** Estimativa pontual (ex.: profit factor, win rate, retorno médio) */
  value: number;
  /** Intervalo de confiança [inferior, superior] (mesma unidade de `value`) */
  ci95: [number, number];
  /** Tamanho da amostra que sustenta a estimativa */
  n: number;
  /** Período coberto pela amostra, legível (ex.: "jan/24–mai/26"); opcional */
  period?: string;
}

export interface IndicatorResult {
  /** Nome curto (ex.: "RSI (14)") */
  name: string;
  /** Categoria (Tendência, Osciladores, Volume, Volatilidade, Médias Móveis) */
  category: string;
  /** Valor calculado (pode ser objeto se for composto) */
  value: number | Record<string, number>;
  vote: IndicatorVote;
  /** Texto explicativo curto */
  note?: string;
}

export interface GateResult {
  /** Identificador interno (A, B, C, ...) */
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface SignalOutput {
  signal: SignalDirection;
  /** Força do sinal 0-100 */
  strength: number;
  /** Confluência 0-10 */
  confluence: number;
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
  distSL: number;
  distTP1: number;
}

export type MarketRegime = "trending" | "ranging" | "transitional" | "explosive";

export interface AnalysisInput {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  candles: Candle[];
}

export interface AnalysisMeta {
  asset: string;
  assetType: AssetType;
  timeframe: Timeframe;
  candlesUsed: number;
  /** Timestamp ms — injetado pela borda (não calculado dentro do motor puro) */
  generatedAt: number;
  engineVersion: string;
  regime?: MarketRegime;
  adxValue?: number;
  atrRatio?: number;
}

/**
 * Resultado central do motor. As camadas opcionais (SMC, Monte Carlo, etc.)
 * entram como campos adicionais nos marcos M1/M2.
 */
export interface AnalysisResult {
  signal: SignalOutput;
  risk: RiskOutput;
  indicators: IndicatorResult[];
  gates: GateResult[];
  explanation: {
    summary: string;
    bullets: string[];
  };
  meta: AnalysisMeta;
}
