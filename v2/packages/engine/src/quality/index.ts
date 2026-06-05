/**
 * Selo de qualidade — versão HONESTA.
 *
 * Diferença crítica vs v1: o verde exige o **limite inferior do IC** acima do
 * limiar (não o ponto-estimativa), e amostra suficiente. Assim o selo nunca
 * acende verde sobre um backtest ruidoso/minúsculo — o coração do "prova antes
 * de prometer".
 */
import type { BacktestSummary } from "../backtest";
import { DEFAULT_ENGINE_CONFIG } from "../config";

export type BannerStatus = "green" | "yellow" | "red" | "grey";

export interface QualityBanner {
  status: BannerStatus;
  reason: string;
}

export interface QualityThresholds {
  pfGreen: number;
  wrGreen: number;
  tp1Green: number;
  pfRed: number;
  wrRed: number;
  tp1Red: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = DEFAULT_ENGINE_CONFIG.qualityBanner;

export function computeQualityBanner(
  bt: BacktestSummary,
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): QualityBanner {
  if (!bt.sampleSufficient) {
    return {
      status: "grey",
      reason: `Amostra insuficiente (${bt.decisiveTrades} trades decisivos; mínimo ${bt.minDecisiveTrades}). Sem veredito.`,
    };
  }

  const pfLow = bt.profitFactor.ci95[0];
  const wrLow = bt.winRate.ci95[0];
  const tp1 = bt.tp1TouchRate;

  // Out-of-sample não pode colapsar (defesa contra overfitting).
  const oosOk = bt.outOfSample === null
    ? true
    : bt.outOfSample.profitFactor.value >= thresholds.pfRed && bt.outOfSample.winRate.value >= thresholds.wrRed;

  // Verde exige o LIMITE INFERIOR do IC acima do limiar E robustez out-of-sample.
  if (pfLow >= thresholds.pfGreen && wrLow >= thresholds.wrGreen && tp1 >= thresholds.tp1Green && oosOk) {
    return {
      status: "green",
      reason: `Robusto: PF ≥ ${thresholds.pfGreen} e win rate ≥ ${(thresholds.wrGreen * 100).toFixed(0)}% mesmo no pior caso do IC (n=${bt.decisiveTrades} decisivos), sem colapso out-of-sample.`,
    };
  }

  // Ponto-estimativa bom mas OOS colapsa → amarelo (suspeita de overfitting).
  if (!oosOk) {
    return {
      status: "yellow",
      reason: `In-sample positivo, mas o desempenho out-of-sample enfraquece — possível overfitting (n=${bt.decisiveTrades} decisivos).`,
    };
  }

  if (bt.profitFactor.value < thresholds.pfRed || bt.winRate.value < thresholds.wrRed || tp1 < thresholds.tp1Red) {
    return {
      status: "red",
      reason: `Fraco: PF ${bt.profitFactor.value.toFixed(2)} · win rate ${(bt.winRate.value * 100).toFixed(0)}% · TP1 touch ${(tp1 * 100).toFixed(0)}%.`,
    };
  }

  return {
    status: "yellow",
    reason: `Intermediário: positivo no ponto-estimativa, mas o IC ainda não sustenta o verde (n=${bt.totalTrades}).`,
  };
}
