/**
 * Smart Money Concepts (SMC) — análise institucional. Portado do v1, com os
 * parâmetros mágicos movidos para o `EngineConfig.smc` e rótulo honesto.
 *
 * IMPORTANTE (honestidade): SMC é interpretativo/discricionário. `strength` de
 * um Order Block é um escore de impulso (move/ATR), NÃO uma probabilidade.
 * O resultado carrega `kind: "qualitative"` + disclaimer — a UI deve deixar
 * claro que é contexto, não estatística calibrada.
 */
import type { Candle } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import { findSwingPoints, type SwingPoint } from "../math/swings";

export type { SwingPoint } from "../math/swings";

export interface OrderBlock {
  type: "bullish" | "bearish";
  zoneTop: number;
  zoneBottom: number;
  formedAt: number;
  /** 0-100 — escore de impulso (move/ATR). NÃO é probabilidade. */
  strength: number;
  mitigated: boolean;
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  zoneTop: number;
  zoneBottom: number;
  formedAt: number;
  status: "active" | "filled";
}

export interface LiquidityZone {
  type: "buy_stops_above" | "sell_stops_below";
  level: number;
  formedAt: number;
  cluster: number;
  swept: boolean;
}

export type MarketStructure =
  | "bullish_bos" | "bearish_bos" | "bullish_choch" | "bearish_choch" | "consolidating";

export interface SmcResult {
  kind: "qualitative";
  bias: "bullish" | "bearish" | "neutral";
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityZones: LiquidityZone[];
  marketStructure: MarketStructure;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  summary: string;
  disclaimer: string;
}

type SmcConfig = EngineConfig["smc"];

const QUALITATIVE = "Análise institucional heurística (contexto qualitativo). Os escores são de match/impulso, não probabilidades.";

function findOrderBlocks(candles: Candle[], atr: number, cfg: SmcConfig): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  if (candles.length < 10 || atr <= 0) return blocks;

  for (let i = 1; i < candles.length - cfg.impulseLookahead; i++) {
    const ob = candles[i]!;
    const isBearishCandle = ob.close < ob.open;
    const isBullishCandle = ob.close > ob.open;

    let maxHigh = ob.high;
    let minLow = ob.low;
    for (let j = 1; j <= cfg.impulseLookahead; j++) {
      maxHigh = Math.max(maxHigh, candles[i + j]!.high);
      minLow = Math.min(minLow, candles[i + j]!.low);
    }
    const moveUp = maxHigh - ob.high;
    const moveDown = ob.low - minLow;

    if (isBearishCandle && moveUp >= cfg.impulseAtrMult * atr) {
      blocks.push({
        type: "bullish", zoneTop: ob.high, zoneBottom: ob.low, formedAt: i,
        strength: Math.min(100, Math.round((moveUp / atr) * cfg.obStrengthAtrMult)),
        mitigated: checkMitigation(candles, i + cfg.impulseLookahead, ob.low, ob.high),
      });
    } else if (isBullishCandle && moveDown >= cfg.impulseAtrMult * atr) {
      blocks.push({
        type: "bearish", zoneTop: ob.high, zoneBottom: ob.low, formedAt: i,
        strength: Math.min(100, Math.round((moveDown / atr) * cfg.obStrengthAtrMult)),
        mitigated: checkMitigation(candles, i + cfg.impulseLookahead, ob.low, ob.high),
      });
    }
  }

  const sorted = blocks.sort((a, b) => b.strength - a.strength);
  const deduped: OrderBlock[] = [];
  for (const b of sorted) {
    const tooClose = deduped.some(
      (d) => d.type === b.type
        && Math.abs(d.zoneTop - b.zoneTop) < atr * cfg.clusterAtrMult
        && Math.abs(d.zoneBottom - b.zoneBottom) < atr * cfg.clusterAtrMult,
    );
    if (!tooClose) deduped.push(b);
    if (deduped.length >= cfg.maxBlocks) break;
  }
  return deduped;
}

function checkMitigation(candles: Candle[], fromIndex: number, zoneLow: number, zoneHigh: number): boolean {
  for (let i = fromIndex; i < candles.length; i++) {
    const c = candles[i]!;
    if (c.low <= zoneHigh && c.high >= zoneLow) return true;
  }
  return false;
}

function findFairValueGaps(candles: Candle[], cfg: SmcConfig): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  if (candles.length < 3) return gaps;
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2]!;
    const c3 = candles[i]!;
    if (c1.high < c3.low) {
      gaps.push({ type: "bullish", zoneTop: c3.low, zoneBottom: c1.high, formedAt: i,
        status: isFvgFilled(candles, i, c1.high, c3.low, "bullish") ? "filled" : "active" });
    } else if (c1.low > c3.high) {
      gaps.push({ type: "bearish", zoneTop: c1.low, zoneBottom: c3.high, formedAt: i,
        status: isFvgFilled(candles, i, c3.high, c1.low, "bearish") ? "filled" : "active" });
    }
  }
  const active = gaps.filter((g) => g.status === "active").reverse();
  const filled = gaps.filter((g) => g.status === "filled").reverse();
  return [...active, ...filled].slice(0, cfg.maxFvgs);
}

function isFvgFilled(candles: Candle[], fromIndex: number, zoneLow: number, zoneHigh: number, type: "bullish" | "bearish"): boolean {
  for (let i = fromIndex + 1; i < candles.length; i++) {
    const c = candles[i]!;
    if (type === "bullish" && c.low <= zoneLow) return true;
    if (type === "bearish" && c.high >= zoneHigh) return true;
  }
  return false;
}

function findLiquidityZones(swings: SwingPoint[], atr: number, candles: Candle[], cfg: SmcConfig): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  if (swings.length < 2 || atr <= 0) return zones;
  const tol = atr * cfg.clusterAtrMult;

  const cluster = (pts: SwingPoint[], type: LiquidityZone["type"]): void => {
    for (const base of pts) {
      const group = pts.filter((p) => Math.abs(p.price - base.price) <= tol);
      if (group.length < 2) continue;
      const avg = group.reduce((s, p) => s + p.price, 0) / group.length;
      const formedAt = Math.max(...group.map((p) => p.index));
      if (zones.some((z) => z.type === type && Math.abs(z.level - avg) < tol)) continue;
      zones.push({ type, level: avg, formedAt, cluster: group.length, swept: false });
    }
  };
  cluster(swings.filter((s) => s.type === "high"), "buy_stops_above");
  cluster(swings.filter((s) => s.type === "low"), "sell_stops_below");

  // marca varridas
  for (const z of zones) {
    for (let i = z.formedAt + 1; i < candles.length; i++) {
      const c = candles[i]!;
      if ((z.type === "buy_stops_above" && c.high > z.level) || (z.type === "sell_stops_below" && c.low < z.level)) {
        z.swept = true; break;
      }
    }
  }
  // Só zonas RELEVANTES: dentro de maxDistPct do preço atual (último close).
  // Sem isso, swings ancestrais (ex.: fundo de anos atrás, ~90% longe) dominam.
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const relevant = lastClose > 0 && cfg.maxDistPct > 0
    ? zones.filter((z) => Math.abs(z.level - lastClose) / lastClose <= cfg.maxDistPct)
    : zones;

  return relevant.sort((a, b) => b.cluster - a.cluster || b.formedAt - a.formedAt).slice(0, cfg.maxZones);
}

function determineMarketStructure(candles: Candle[], swings: SwingPoint[]): {
  structure: MarketStructure; lastSwingHigh: SwingPoint | null; lastSwingLow: SwingPoint | null;
} {
  if (candles.length === 0 || swings.length < 3) {
    return { structure: "consolidating", lastSwingHigh: null, lastSwingLow: null };
  }
  // Confirmação por FECHAMENTO (não spike intraday).
  const lastClose = candles[candles.length - 1]!.close;
  const recentHighs = swings.filter((s) => s.type === "high").slice(-5);
  const recentLows = swings.filter((s) => s.type === "low").slice(-5);
  const lastSwingHigh = recentHighs[recentHighs.length - 1] ?? null;
  const lastSwingLow = recentLows[recentLows.length - 1] ?? null;
  if (!lastSwingHigh || !lastSwingLow) return { structure: "consolidating", lastSwingHigh, lastSwingLow };

  if (lastClose > lastSwingHigh.price) {
    if (recentLows.length >= 2) {
      const prevLow = recentLows[recentLows.length - 2]!;
      const wasBearish = lastSwingLow.price < prevLow.price;
      return { structure: wasBearish ? "bullish_choch" : "bullish_bos", lastSwingHigh, lastSwingLow };
    }
    return { structure: "bullish_bos", lastSwingHigh, lastSwingLow };
  }
  if (lastClose < lastSwingLow.price) {
    if (recentHighs.length >= 2) {
      const prevHigh = recentHighs[recentHighs.length - 2]!;
      const wasBullish = lastSwingHigh.price > prevHigh.price;
      return { structure: wasBullish ? "bearish_choch" : "bearish_bos", lastSwingHigh, lastSwingLow };
    }
    return { structure: "bearish_bos", lastSwingHigh, lastSwingLow };
  }
  return { structure: "consolidating", lastSwingHigh, lastSwingLow };
}

function determineBias(structure: MarketStructure, obs: OrderBlock[], fvgs: FairValueGap[], cfg: SmcConfig): "bullish" | "bearish" | "neutral" {
  let bull = 0;
  let bear = 0;
  if (structure === "bullish_bos" || structure === "bullish_choch") bull += 3;
  if (structure === "bearish_bos" || structure === "bearish_choch") bear += 3;
  bull += obs.filter((o) => o.type === "bullish" && !o.mitigated).length;
  bear += obs.filter((o) => o.type === "bearish" && !o.mitigated).length;
  bull += fvgs.filter((f) => f.type === "bullish" && f.status === "active").length * 0.5;
  bear += fvgs.filter((f) => f.type === "bearish" && f.status === "active").length * 0.5;
  if (bull > bear * cfg.biasThreshold) return "bullish";
  if (bear > bull * cfg.biasThreshold) return "bearish";
  return "neutral";
}

export function analyzeSmc(candles: Candle[], atr: number, config: SmcConfig = DEFAULT_ENGINE_CONFIG.smc): SmcResult {
  const base = {
    kind: "qualitative" as const,
    bias: "neutral" as const,
    orderBlocks: [], fvgs: [], liquidityZones: [],
    marketStructure: "consolidating" as MarketStructure,
    lastSwingHigh: null, lastSwingLow: null,
    disclaimer: QUALITATIVE,
  };
  if (candles.length < config.minCandles) {
    return { ...base, summary: "Dados insuficientes para análise SMC." };
  }

  const swings = findSwingPoints(candles, config.swingLookback);
  const orderBlocks = findOrderBlocks(candles, atr, config);
  const fvgs = findFairValueGaps(candles, config);
  const liquidityZones = findLiquidityZones(swings, atr, candles, config);
  const { structure, lastSwingHigh, lastSwingLow } = determineMarketStructure(candles, swings);
  const bias = determineBias(structure, orderBlocks, fvgs, config);

  const labels: Record<MarketStructure, string> = {
    bullish_bos: "BOS bullish (continuação de alta)",
    bearish_bos: "BOS bearish (continuação de baixa)",
    bullish_choch: "CHoCH bullish (possível reversão p/ cima)",
    bearish_choch: "CHoCH bearish (possível reversão p/ baixa)",
    consolidating: "consolidando (sem quebra recente)",
  };
  const activeOBs = orderBlocks.filter((o) => !o.mitigated).length;
  const activeFvgs = fvgs.filter((f) => f.status === "active").length;
  const unswept = liquidityZones.filter((z) => !z.swept).length;
  const parts = [`Estrutura: ${labels[structure]}`, `Viés: ${bias}`];
  if (activeOBs) parts.push(`${activeOBs} OBs ativos`);
  if (activeFvgs) parts.push(`${activeFvgs} FVGs ativos`);
  if (unswept) parts.push(`${unswept} zonas de liquidez não varridas`);

  return {
    ...base, bias, orderBlocks, fvgs, liquidityZones,
    marketStructure: structure, lastSwingHigh, lastSwingLow,
    summary: parts.join(" · "),
  };
}
