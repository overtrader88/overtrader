/**
 * Visão enxuta do backtest p/ o cliente — sem o array bruto de trades. Extraída
 * de `full.ts` para ser reusada pelo backtest sob demanda (Fase B3).
 */
import type { BacktestSummary } from "@tradeai/engine";

export interface BacktestView {
  strategy: BacktestSummary["strategy"];
  totalTrades: number;
  decisiveTrades: number;
  minDecisiveTrades: number;
  winRate: BacktestSummary["winRate"];
  profitFactor: BacktestSummary["profitFactor"];
  avgR: BacktestSummary["avgR"];
  maxDrawdownR: number;
  outcomes: BacktestSummary["outcomes"];
  tp1TouchRate: number;
  outOfSample: BacktestSummary["outOfSample"];
  sampleSufficient: boolean;
  candlesScanned: number;
  truncated: boolean;
}

export function toBacktestView(bt: BacktestSummary): BacktestView {
  return {
    strategy: bt.strategy,
    totalTrades: bt.totalTrades,
    decisiveTrades: bt.decisiveTrades,
    minDecisiveTrades: bt.minDecisiveTrades,
    winRate: bt.winRate,
    profitFactor: bt.profitFactor,
    avgR: bt.avgR,
    maxDrawdownR: bt.maxDrawdownR,
    outcomes: bt.outcomes,
    tp1TouchRate: bt.tp1TouchRate,
    outOfSample: bt.outOfSample,
    sampleSufficient: bt.sampleSufficient,
    candlesScanned: bt.candlesScanned,
    truncated: bt.truncated,
  };
}

/** Curva de capital (R acumulado por trade), começando em 0. */
export function equityFromTrades(trades: BacktestSummary["trades"]): number[] {
  const eq: number[] = [0];
  let acc = 0;
  for (const t of trades) {
    acc += t.pnlR;
    eq.push(acc);
  }
  return eq;
}
