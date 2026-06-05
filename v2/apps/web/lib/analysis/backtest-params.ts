/**
 * Parâmetros do backtest sob demanda (Fase B3). PURO — define as opções que o
 * usuário escolhe (estratégia / período / perfil de R:R) e as traduz para as
 * `BacktestOptions` do motor. Sem rede, sem custo (o backtest é CPU puro).
 */
import type { AssetType, Timeframe } from "@tradeai/shared";
import { periodsPerYear, type BacktestStrategy } from "@tradeai/engine";

export const STRATEGY_OPTIONS: { value: BacktestStrategy; label: string }[] = [
  { value: "exit-tp1", label: "Saída no TP1" },
  { value: "move-to-breakeven", label: "Mover p/ breakeven" },
  { value: "partial-exit", label: "Saída parcial (50% no TP1)" },
];

export const PERIOD_OPTIONS = [12, 24, 36, 60] as const;
export type PeriodMonths = (typeof PERIOD_OPTIONS)[number];

export interface RiskPreset {
  id: string;
  label: string;
  /** R:R do TP1 (= tp1Mult / slMult), só p/ rótulo. */
  rr: number;
  slMult: number;
  tp1Mult: number;
  tp2Mult: number;
  tp3Mult: number;
}

/** Perfis de risco — sobrepõem os multiplicadores de ATR (config.risk). */
export const RISK_PRESETS: RiskPreset[] = [
  { id: "short", label: "Alvo curto · R:R 1:1", rr: 1.0, slMult: 1.5, tp1Mult: 1.5, tp2Mult: 2.5, tp3Mult: 3.5 },
  { id: "standard", label: "Padrão · R:R 1,5", rr: 1.5, slMult: 1.2, tp1Mult: 1.8, tp2Mult: 3.0, tp3Mult: 4.5 },
  { id: "wide", label: "Alvo largo · R:R 2,5", rr: 2.5, slMult: 1.2, tp1Mult: 3.0, tp2Mult: 4.5, tp3Mult: 6.0 },
];

export const DEFAULT_BACKTEST_PARAMS: { strategy: BacktestStrategy; months: PeriodMonths; riskPresetId: string } = {
  strategy: "exit-tp1",
  months: 24,
  riskPresetId: "standard",
};

export function riskPresetById(id: string): RiskPreset {
  return RISK_PRESETS.find((p) => p.id === id) ?? RISK_PRESETS[1]!;
}

export function isStrategy(v: unknown): v is BacktestStrategy {
  return v === "exit-tp1" || v === "move-to-breakeven" || v === "partial-exit";
}

/** Meses → nº de candles a varrer no backtest, para o ativo/timeframe. Piso de 60. */
export function monthsToCandles(assetType: AssetType, timeframe: Timeframe, months: number): number {
  return Math.max(60, Math.round(periodsPerYear(assetType, timeframe) * (months / 12)));
}
