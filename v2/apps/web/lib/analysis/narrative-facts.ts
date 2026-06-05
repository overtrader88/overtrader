/**
 * Fatos COMPACTOS extraídos do DTO para alimentar a narrativa de IA. Só números
 * medidos (n + IC) — o prompt proíbe inventar além disto. Puro.
 */
import type { FullAnalysis } from "./full";

const r = (n: number, d = 2): number => Math.round(n * 10 ** d) / 10 ** d;

export interface NarrativeFacts {
  symbol: string;
  timeframe: string;
  assetType: string;
  regime?: string;
  adx?: number;
  signal: string;
  strengthPct: number;
  confluence: number;
  votes: { buy: number; sell: number; neutral: number };
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  rr1: number;
  seal?: { status: string; reason: string };
  backtest?: { decisiveTrades: number; sufficient: boolean; pf: number; pfCi: [number, number]; winRatePct: number; period: string | null };
  montecarlo?: { probUpPct: number; probUpCiPct: [number, number]; volAnnualPct: number };
  scenario?: { recommended: string; expectedR: number; edge: number };
}

export function toNarrativeFacts(dto: FullAnalysis): NarrativeFacts {
  const a = dto.analysis;
  const bt = dto.backtest;
  const mc = dto.montecarlo;
  const sc = dto.scenarios;
  return {
    symbol: a.meta.asset,
    timeframe: a.meta.timeframe,
    assetType: a.meta.assetType,
    regime: a.meta.regime,
    adx: a.meta.adxValue != null ? r(a.meta.adxValue, 1) : undefined,
    signal: a.signal.signal,
    strengthPct: a.signal.strength,
    confluence: a.signal.confluence,
    votes: a.signal.votes,
    entry: r(a.risk.entry, 4),
    stopLoss: r(a.risk.stopLoss, 4),
    takeProfit1: r(a.risk.takeProfit1, 4),
    rr1: r(a.risk.rr1, 2),
    seal: dto.quality ? { status: dto.quality.status, reason: dto.quality.reason } : undefined,
    backtest: bt
      ? {
          decisiveTrades: bt.decisiveTrades,
          sufficient: bt.sampleSufficient,
          pf: r(bt.profitFactor.value, 2),
          pfCi: [r(bt.profitFactor.ci95[0], 2), r(bt.profitFactor.ci95[1], 2)],
          winRatePct: r(bt.winRate.value * 100, 1),
          period: dto.period,
        }
      : undefined,
    montecarlo: mc
      ? {
          probUpPct: r(mc.winRateUp.value * 100, 1),
          probUpCiPct: [r(mc.winRateUp.ci95[0] * 100, 1), r(mc.winRateUp.ci95[1] * 100, 1)],
          volAnnualPct: r(mc.volatilityAnnualized, 1),
        }
      : undefined,
    scenario: sc
      ? { recommended: sc.recommended, expectedR: r((sc.recommended === "buy" ? sc.buy : sc.sell).expectedR, 2), edge: r(sc.edge, 2) }
      : undefined,
  };
}
