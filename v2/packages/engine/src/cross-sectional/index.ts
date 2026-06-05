/**
 * Momentum CROSS-SECTIONAL — estratégia de PORTFÓLIO (não timing por ativo).
 *
 * Ranqueia uma cesta por momentum recente, compra os mais fortes (long) e —
 * opcional — vende os mais fracos (short), rebalanceando. Mede uma assinatura
 * de edge DIFERENTE da do motor por-ativo.
 *
 * Realismo:
 *   - UNIVERSO DINÂMICO: alinha por UNIÃO de timestamps; em cada rebalance só
 *     ranqueia ativos com dado válido (entram conforme listam) — sem
 *     survivorship por interseção.
 *   - Custos: turnover (bps/lado) + FUNDING do short (anualizado) na perna vendida.
 *   - WALK-FORWARD: escolhe a config no treino (passado) e mede no teste (futuro),
 *     rolando — o teste anti-overfit de verdade (não um split único).
 *
 * Puro e determinístico.
 */
import type { AssetType, Candle, Timeframe } from "@tradeai/shared";
import type { Estimate } from "../types";
import { mean, sampleStdev, meanConfidenceInterval, wilsonInterval } from "../stats";
import { periodsPerYear } from "../math/calendar";

export interface CsAsset {
  symbol: string;
  candles: Candle[];
}

export interface CrossSectionalOptions {
  assetType: AssetType;
  timeframe: Timeframe;
  lookback: number;
  skip: number;
  rebalanceEvery: number;
  topK: number;
  longShort: boolean;
  /** Custo por lado por rebalance (bps). */
  costBps: number;
  /** Funding anualizado (%) cobrado na perna vendida (só long-short). */
  shortFundingAnnualPct: number;
  /** Fração final reservada p/ out-of-sample (em `crossSectionalMomentum`). */
  oosFraction: number;
}

export interface CrossSectionalStats {
  periods: number;
  meanPeriodReturn: Estimate;
  winRate: Estimate;
  sharpe: number;
  totalReturn: number;
  maxDrawdown: number;
}

export interface CrossSectionalResult {
  full: CrossSectionalStats;
  oos: CrossSectionalStats | null;
  assets: number;
  alignedBars: number;
}

type Matrix = (number | null)[][];

/** União de timestamps; price = null onde o ativo não tem dado (universo dinâmico). */
function alignUnion(assets: CsAsset[]): { times: number[]; prices: Matrix } {
  const maps = assets.map((a) => new Map(a.candles.map((c) => [c.time, c.close])));
  const all = new Set<number>();
  for (const m of maps) for (const t of m.keys()) all.add(t);
  const times = [...all].sort((a, b) => a - b);
  const prices: Matrix = maps.map((m) => times.map((t) => m.get(t) ?? null));
  return { times, prices };
}

function statsFrom(returns: number[], periodsPerHoldYear: number): CrossSectionalStats {
  const m = mean(returns);
  const sd = sampleStdev(returns);
  const positives = returns.filter((r) => r > 0).length;
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const r of returns) {
    equity *= 1 + r;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return {
    periods: returns.length,
    meanPeriodReturn: meanConfidenceInterval(returns),
    winRate: wilsonInterval(positives, returns.length),
    sharpe: sd > 0 ? (m / sd) * Math.sqrt(periodsPerHoldYear) : 0,
    totalReturn: equity - 1,
    maxDrawdown: maxDd,
  };
}

/** Retornos líquidos por período cujo ENTRY cai em [fromBar, toBar). */
function periodReturns(prices: Matrix, opts: CrossSectionalOptions, fromBar: number, toBar: number): number[] {
  const n = prices[0]?.length ?? 0;
  const { lookback, skip, rebalanceEvery: reb, topK, longShort } = opts;
  const need = topK * (longShort ? 2 : 1);
  const start = lookback + skip;
  const costFrac = opts.costBps / 10000;
  const holdYears = reb / periodsPerYear(opts.assetType, opts.timeframe);
  const turnover = 2 * costFrac * (longShort ? 2 : 1);
  const funding = longShort ? (opts.shortFundingAnnualPct / 100) * holdYears : 0;

  const out: number[] = [];
  for (let t = start; t + reb < n; t += reb) {
    if (t < fromBar || t >= toBar) continue;
    const elig: { mom: number; entry: number; exit: number }[] = [];
    for (const p of prices) {
      const cur = p[t - skip];
      const past = p[t - skip - lookback];
      const entry = p[t];
      const exit = p[t + reb];
      if (cur == null || past == null || entry == null || exit == null || past <= 0 || entry <= 0) continue;
      elig.push({ mom: cur / past - 1, entry, exit });
    }
    if (elig.length < need) continue;
    elig.sort((a, b) => b.mom - a.mom);
    const longs = elig.slice(0, topK);
    const shorts = longShort ? elig.slice(-topK) : [];
    const longRet = mean(longs.map((e) => e.exit / e.entry - 1));
    const shortRet = shorts.length ? mean(shorts.map((e) => e.exit / e.entry - 1)) : 0;
    out.push((longShort ? longRet - shortRet : longRet) - turnover - funding);
  }
  return out;
}

export function crossSectionalMomentum(assets: CsAsset[], opts: CrossSectionalOptions): CrossSectionalResult {
  const { prices } = alignUnion(assets);
  const n = prices[0]?.length ?? 0;
  const rets = periodReturns(prices, opts, 0, n);
  const pphy = periodsPerYear(opts.assetType, opts.timeframe) / opts.rebalanceEvery;
  const empty: CrossSectionalStats = {
    periods: 0, meanPeriodReturn: { value: 0, ci95: [0, 0], n: 0 },
    winRate: { value: 0, ci95: [0, 0], n: 0 }, sharpe: 0, totalReturn: 0, maxDrawdown: 0,
  };
  if (rets.length === 0) return { full: empty, oos: null, assets: assets.length, alignedBars: n };
  const full = statsFrom(rets, pphy);
  let oos: CrossSectionalStats | null = null;
  if (rets.length >= 20) oos = statsFrom(rets.slice(Math.floor(rets.length * (1 - opts.oosFraction))), pphy);
  return { full, oos, assets: assets.length, alignedBars: n };
}

// ============================================================
// WALK-FORWARD (escolhe config no treino, mede no teste, rola)
// ============================================================

export interface WalkForwardConfig {
  lookback: number;
  topK: number;
  longShort: boolean;
}

export interface WalkForwardOptions {
  assetType: AssetType;
  timeframe: Timeframe;
  skip: number;
  /** Fixo p/ todas as configs (comparável e annualização uniforme). */
  rebalanceEvery: number;
  costBps: number;
  shortFundingAnnualPct: number;
  /** Nº de janelas de teste sequenciais. */
  folds: number;
}

export interface WalkForwardResult {
  /** Stats sobre os retornos de TESTE concatenados (out-of-sample de verdade). */
  test: CrossSectionalStats;
  /** Config escolhida em cada fold (pelo Sharpe de treino). */
  chosen: Array<WalkForwardConfig & { fold: number }>;
  folds: number;
}

function sharpeOf(returns: number[], pphy: number): number {
  const sd = sampleStdev(returns);
  return sd > 0 ? (mean(returns) / sd) * Math.sqrt(pphy) : 0;
}

export function walkForwardCrossSectional(
  assets: CsAsset[],
  wf: WalkForwardOptions,
  configs: WalkForwardConfig[],
): WalkForwardResult {
  const { prices } = alignUnion(assets);
  const n = prices[0]?.length ?? 0;
  const pphy = periodsPerYear(wf.assetType, wf.timeframe) / wf.rebalanceEvery;
  const maxLb = Math.max(...configs.map((c) => c.lookback));
  const start = maxLb + wf.skip;

  const opt = (c: WalkForwardConfig): CrossSectionalOptions => ({
    assetType: wf.assetType, timeframe: wf.timeframe, lookback: c.lookback, skip: wf.skip,
    rebalanceEvery: wf.rebalanceEvery, topK: c.topK, longShort: c.longShort,
    costBps: wf.costBps, shortFundingAnnualPct: wf.shortFundingAnnualPct, oosFraction: 0,
  });

  const usable = n - start;
  const empty: CrossSectionalStats = {
    periods: 0, meanPeriodReturn: { value: 0, ci95: [0, 0], n: 0 },
    winRate: { value: 0, ci95: [0, 0], n: 0 }, sharpe: 0, totalReturn: 0, maxDrawdown: 0,
  };
  if (usable < wf.folds * 4 * wf.rebalanceEvery) {
    return { test: empty, chosen: [], folds: wf.folds };
  }

  const seg = Math.floor(usable / (wf.folds + 1)); // 1ª fração = treino inicial; resto = folds de teste
  const testReturns: number[] = [];
  const chosen: WalkForwardResult["chosen"] = [];

  for (let f = 0; f < wf.folds; f++) {
    const testFrom = start + seg * (f + 1);
    const testTo = f === wf.folds - 1 ? n : start + seg * (f + 2);
    const trainTo = testFrom; // treino = tudo antes do teste (anchored)

    // escolhe a melhor config pelo Sharpe de treino
    let best: WalkForwardConfig | null = null;
    let bestSharpe = -Infinity;
    for (const c of configs) {
      const tr = periodReturns(prices, opt(c), start, trainTo);
      if (tr.length < 10) continue;
      const s = sharpeOf(tr, pphy);
      if (s > bestSharpe) { bestSharpe = s; best = c; }
    }
    if (!best) continue;
    chosen.push({ ...best, fold: f });
    testReturns.push(...periodReturns(prices, opt(best), testFrom, testTo));
  }

  return { test: testReturns.length ? statsFrom(testReturns, pphy) : empty, chosen, folds: wf.folds };
}
