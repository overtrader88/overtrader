/**
 * Smart Money Concepts (SMC) — Analise Institucional.
 *
 * Detecta algoritmicamente os 4 pilares da analise institucional/ICT:
 *   1. Swing Points  — pivots de alta/baixa (base de tudo)
 *   2. Order Blocks  — ultima candle contra a tendencia antes de impulso forte
 *   3. Fair Value Gaps (FVG) — gaps de preco em padrao 3-velas
 *   4. Liquidity Zones — areas de stops acumulados (acima de swing highs / abaixo de swing lows)
 *   5. Market Structure — BOS (Break of Structure) / CHoCH (Change of Character)
 *
 * Diferencial vs Vortex:
 *   - Algoritmos abertos e auditaveis (codigo aqui, nao caixa-preta)
 *   - Cada zona vem com "forca" calculada (0-100), nao um label binario
 *   - Status "mitigated" automatico (preco voltou e testou)
 *
 * Tudo TS puro, zero deps. Performance ~5ms em 300 candles.
 */
import type { Candle } from "@/lib/market/types";

// ============================================================
// TYPES
// ============================================================

export interface SwingPoint {
  /** Indice do candle no array original */
  index: number;
  /** Preco do swing (high para top, low para bottom) */
  price: number;
  type: "high" | "low";
}

export interface OrderBlock {
  type: "bullish" | "bearish";
  /** Topo da zona (high da candle do OB) */
  zoneTop: number;
  /** Fundo da zona (low da candle do OB) */
  zoneBottom: number;
  /** Indice do candle que formou o OB */
  formedAt: number;
  /** 0-100. Baseado no movimento impulsivo que se seguiu (R-multiple) */
  strength: number;
  /** True se o preco voltou e tocou a zona apos a formacao */
  mitigated: boolean;
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  zoneTop: number;
  zoneBottom: number;
  formedAt: number;
  /** "active" = ainda nao preenchido, "filled" = preco ja cruzou a zona */
  status: "active" | "filled";
}

export interface LiquidityZone {
  /** "buy_stops_above" = stops de venda acima (alvos institucionais bullish) */
  type: "buy_stops_above" | "sell_stops_below";
  level: number;
  formedAt: number;
  /** Quantos swing highs/lows estao agrupados (mais = mais liquidez) */
  cluster: number;
  /** True se ja foi "varrido" (preco passou e voltou) */
  swept: boolean;
}

export type MarketStructure =
  | "bullish_bos" //  preco quebrou swing high anterior (trend continuation up)
  | "bearish_bos" //  preco quebrou swing low anterior (trend continuation down)
  | "bullish_choch" // primeiro higher high apos sequencia de lower highs (reversal up)
  | "bearish_choch" // primeiro lower low apos sequencia de higher lows (reversal down)
  | "consolidating"; // sem quebra recente

export interface SmcResult {
  /** Vies institucional inferido (combina structure + OBs ativos) */
  bias: "bullish" | "bearish" | "neutral";
  /** Ate 5 OBs mais relevantes (filtrados por strength) */
  orderBlocks: OrderBlock[];
  /** Ate 8 FVGs (priorizando ativos) */
  fvgs: FairValueGap[];
  /** Top zonas de liquidez (mais clusterizadas primeiro) */
  liquidityZones: LiquidityZone[];
  /** Estado atual da estrutura */
  marketStructure: MarketStructure;
  /** Ultimo swing high relevante */
  lastSwingHigh: SwingPoint | null;
  /** Ultimo swing low relevante */
  lastSwingLow: SwingPoint | null;
  /** Resumo textual curto (1 linha) — usavel no prompt do LLM */
  summary: string;
}

// ============================================================
// 1) SWING POINTS — base de tudo
// ============================================================

/**
 * Detecta pivots locais (swing high/low) com confirmacao de N candles em cada lado.
 * Default lookback = 3 (precisa 3 candles antes e 3 depois com low/high menor/maior).
 *
 * Quanto maior o lookback, menos swings detectados — mas mais significativos.
 */
function findSwingPoints(candles: Candle[], lookback = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) {
        isHigh = false;
      }
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) {
        isLow = false;
      }
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swings.push({ index: i, price: c.high, type: "high" });
    else if (isLow) swings.push({ index: i, price: c.low, type: "low" });
  }
  return swings;
}

// ============================================================
// 2) ORDER BLOCKS
// ============================================================

/**
 * Order Block bullish = ultima candle BEARISH antes de um impulso de alta forte.
 * Order Block bearish = ultima candle BULLISH antes de um impulso de baixa forte.
 *
 * "Impulso forte" = movimento >= 2x ATR nos proximos 5 candles.
 */
function findOrderBlocks(
  candles: Candle[],
  atr: number,
  maxBlocks = 5
): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  if (candles.length < 10 || atr <= 0) return blocks;

  const IMPULSE_LOOKAHEAD = 5;
  const IMPULSE_ATR_MULT = 2;

  // Comeca de 1 (precisa ter candle anterior) ate length - LOOKAHEAD
  for (let i = 1; i < candles.length - IMPULSE_LOOKAHEAD; i++) {
    const ob = candles[i];
    const isBearishCandle = ob.close < ob.open;
    const isBullishCandle = ob.close > ob.open;

    // Avalia o movimento nos proximos 5 candles
    let maxHigh = ob.high;
    let minLow = ob.low;
    for (let j = 1; j <= IMPULSE_LOOKAHEAD; j++) {
      maxHigh = Math.max(maxHigh, candles[i + j].high);
      minLow = Math.min(minLow, candles[i + j].low);
    }

    const moveUp = maxHigh - ob.high;
    const moveDown = ob.low - minLow;
    const impulseUp = moveUp >= IMPULSE_ATR_MULT * atr;
    const impulseDown = moveDown >= IMPULSE_ATR_MULT * atr;

    if (isBearishCandle && impulseUp) {
      // Bullish OB: vela bearish antes de impulso de alta
      const strength = Math.min(100, Math.round((moveUp / atr) * 25));
      const mitigated = checkMitigation(
        candles,
        i + IMPULSE_LOOKAHEAD,
        ob.low,
        ob.high
      );
      blocks.push({
        type: "bullish",
        zoneTop: ob.high,
        zoneBottom: ob.low,
        formedAt: i,
        strength,
        mitigated,
      });
    } else if (isBullishCandle && impulseDown) {
      const strength = Math.min(100, Math.round((moveDown / atr) * 25));
      const mitigated = checkMitigation(
        candles,
        i + IMPULSE_LOOKAHEAD,
        ob.low,
        ob.high
      );
      blocks.push({
        type: "bearish",
        zoneTop: ob.high,
        zoneBottom: ob.low,
        formedAt: i,
        strength,
        mitigated,
      });
    }
  }

  // Ordena por strength desc, pega os top N, e filtra OBs muito proximos (dedupe)
  const sorted = blocks.sort((a, b) => b.strength - a.strength);
  const deduped: OrderBlock[] = [];
  for (const b of sorted) {
    const tooClose = deduped.some(
      (d) =>
        d.type === b.type &&
        Math.abs(d.zoneTop - b.zoneTop) < atr * 0.5 &&
        Math.abs(d.zoneBottom - b.zoneBottom) < atr * 0.5
    );
    if (!tooClose) deduped.push(b);
    if (deduped.length >= maxBlocks) break;
  }
  return deduped;
}

/** Verifica se preco apos formedAt voltou a tocar a zona [low, high] */
function checkMitigation(
  candles: Candle[],
  fromIndex: number,
  zoneLow: number,
  zoneHigh: number
): boolean {
  for (let i = fromIndex; i < candles.length; i++) {
    const c = candles[i];
    if (c.low <= zoneHigh && c.high >= zoneLow) return true;
  }
  return false;
}

// ============================================================
// 3) FAIR VALUE GAPS
// ============================================================

/**
 * FVG bullish (3-candle pattern):
 *   - candle[i-2].high < candle[i].low
 *   - O gap esta entre candle[i-2].high e candle[i].low
 *
 * FVG bearish:
 *   - candle[i-2].low > candle[i].high
 *
 * Status:
 *   - active   = preco posterior nao cruzou o gap
 *   - filled   = preco voltou e fechou o gap
 */
function findFairValueGaps(candles: Candle[], maxGaps = 8): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  if (candles.length < 3) return gaps;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG
    if (c1.high < c3.low) {
      const status = isFvgFilled(candles, i, c1.high, c3.low, "bullish")
        ? "filled"
        : "active";
      gaps.push({
        type: "bullish",
        zoneTop: c3.low,
        zoneBottom: c1.high,
        formedAt: i,
        status,
      });
    }
    // Bearish FVG
    else if (c1.low > c3.high) {
      const status = isFvgFilled(candles, i, c3.high, c1.low, "bearish")
        ? "filled"
        : "active";
      gaps.push({
        type: "bearish",
        zoneTop: c1.low,
        zoneBottom: c3.high,
        formedAt: i,
        status,
      });
    }
  }

  // Prioriza FVGs ativos e recentes
  const active = gaps.filter((g) => g.status === "active").reverse();
  const filled = gaps.filter((g) => g.status === "filled").reverse();
  return [...active, ...filled].slice(0, maxGaps);
}

function isFvgFilled(
  candles: Candle[],
  fromIndex: number,
  zoneLow: number,
  zoneHigh: number,
  type: "bullish" | "bearish"
): boolean {
  // Bullish FVG e preenchido se algum candle posterior tem low <= zoneLow
  // (preco voltou pra dentro do gap pelo lado de cima — fechou o gap)
  for (let i = fromIndex + 1; i < candles.length; i++) {
    const c = candles[i];
    if (type === "bullish" && c.low <= zoneLow) return true;
    if (type === "bearish" && c.high >= zoneHigh) return true;
  }
  return false;
}

// ============================================================
// 4) LIQUIDITY ZONES
// ============================================================

/**
 * Zona de liquidez = cluster de swing highs/lows proximos.
 * Acima de varios swing highs proximos: "buy_stops_above" (institucionais caçam stops short)
 * Abaixo de varios swing lows: "sell_stops_below" (caçam stops long)
 *
 * Cluster: pelo menos 2 swings dentro de 0.5x ATR
 */
function findLiquidityZones(
  swings: SwingPoint[],
  atr: number,
  maxZones = 5
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  if (swings.length < 2 || atr <= 0) return zones;

  const CLUSTER_TOLERANCE = atr * 0.5;

  // Processa highs e lows separadamente
  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  // Clusteriza highs
  for (let i = 0; i < highs.length; i++) {
    const base = highs[i];
    const cluster = highs.filter(
      (h) => Math.abs(h.price - base.price) <= CLUSTER_TOLERANCE
    );
    if (cluster.length >= 2) {
      const avgPrice =
        cluster.reduce((sum, h) => sum + h.price, 0) / cluster.length;
      const formedAt = Math.max(...cluster.map((h) => h.index));

      // Dedupe: ja temos zona similar?
      const exists = zones.some(
        (z) =>
          z.type === "buy_stops_above" &&
          Math.abs(z.level - avgPrice) < CLUSTER_TOLERANCE
      );
      if (!exists) {
        zones.push({
          type: "buy_stops_above",
          level: avgPrice,
          formedAt,
          cluster: cluster.length,
          swept: false, // sera ajustado no caller com preco atual
        });
      }
    }
  }

  // Clusteriza lows
  for (let i = 0; i < lows.length; i++) {
    const base = lows[i];
    const cluster = lows.filter(
      (l) => Math.abs(l.price - base.price) <= CLUSTER_TOLERANCE
    );
    if (cluster.length >= 2) {
      const avgPrice =
        cluster.reduce((sum, l) => sum + l.price, 0) / cluster.length;
      const formedAt = Math.max(...cluster.map((l) => l.index));
      const exists = zones.some(
        (z) =>
          z.type === "sell_stops_below" &&
          Math.abs(z.level - avgPrice) < CLUSTER_TOLERANCE
      );
      if (!exists) {
        zones.push({
          type: "sell_stops_below",
          level: avgPrice,
          formedAt,
          cluster: cluster.length,
          swept: false,
        });
      }
    }
  }

  return zones
    .sort((a, b) => b.cluster - a.cluster || b.formedAt - a.formedAt)
    .slice(0, maxZones);
}

/** Marca zonas como "varridas" se preco posterior cruzou o nivel */
function markSweptZones(
  zones: LiquidityZone[],
  candles: Candle[]
): LiquidityZone[] {
  return zones.map((z) => {
    let swept = false;
    for (let i = z.formedAt + 1; i < candles.length; i++) {
      const c = candles[i];
      if (z.type === "buy_stops_above" && c.high > z.level) {
        swept = true;
        break;
      }
      if (z.type === "sell_stops_below" && c.low < z.level) {
        swept = true;
        break;
      }
    }
    return { ...z, swept };
  });
}

// ============================================================
// 5) MARKET STRUCTURE (BOS / CHoCH)
// ============================================================

/**
 * Determina o estado atual da estrutura comparando o preco recente com
 * os ultimos swing highs/lows.
 *
 *   BOS bullish: preco fez novo high acima do ultimo swing high relevante
 *   BOS bearish: preco fez novo low abaixo do ultimo swing low relevante
 *   CHoCH bullish: apos sequencia bearish, primeiro higher high
 *   CHoCH bearish: apos sequencia bullish, primeiro lower low
 *   consolidating: sem quebras claras
 */
function determineMarketStructure(
  candles: Candle[],
  swings: SwingPoint[]
): {
  structure: MarketStructure;
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
} {
  if (candles.length === 0 || swings.length < 3) {
    return {
      structure: "consolidating",
      lastSwingHigh: null,
      lastSwingLow: null,
    };
  }

  const lastClose = candles[candles.length - 1].close;
  const lastIndex = candles.length - 1;

  // Pega os ultimos swings (ate 5 atras de cada tipo)
  const recentHighs = swings.filter((s) => s.type === "high").slice(-5);
  const recentLows = swings.filter((s) => s.type === "low").slice(-5);

  const lastSwingHigh = recentHighs[recentHighs.length - 1] ?? null;
  const lastSwingLow = recentLows[recentLows.length - 1] ?? null;

  if (!lastSwingHigh || !lastSwingLow) {
    return {
      structure: "consolidating",
      lastSwingHigh,
      lastSwingLow,
    };
  }

  // BOS bullish: preco atual > ultimo swing high E swings high estavam ascendentes
  const lookbackCandles = Math.min(20, lastIndex - lastSwingHigh.index);
  if (lookbackCandles <= 0) {
    return { structure: "consolidating", lastSwingHigh, lastSwingLow };
  }

  if (lastClose > lastSwingHigh.price) {
    // Verifica se era CHoCH (apos sequencia bearish) ou BOS (continuacao bullish)
    if (recentLows.length >= 2) {
      const prevLow = recentLows[recentLows.length - 2];
      const wasBearishSequence = lastSwingLow.price < prevLow.price;
      return {
        structure: wasBearishSequence ? "bullish_choch" : "bullish_bos",
        lastSwingHigh,
        lastSwingLow,
      };
    }
    return { structure: "bullish_bos", lastSwingHigh, lastSwingLow };
  }

  if (lastClose < lastSwingLow.price) {
    if (recentHighs.length >= 2) {
      const prevHigh = recentHighs[recentHighs.length - 2];
      const wasBullishSequence = lastSwingHigh.price > prevHigh.price;
      return {
        structure: wasBullishSequence ? "bearish_choch" : "bearish_bos",
        lastSwingHigh,
        lastSwingLow,
      };
    }
    return { structure: "bearish_bos", lastSwingHigh, lastSwingLow };
  }

  return { structure: "consolidating", lastSwingHigh, lastSwingLow };
}

// ============================================================
// 6) BIAS INSTITUCIONAL
// ============================================================

function determineBias(
  structure: MarketStructure,
  orderBlocks: OrderBlock[],
  fvgs: FairValueGap[]
): "bullish" | "bearish" | "neutral" {
  // Sinais de bullish
  let bullScore = 0;
  let bearScore = 0;

  if (structure === "bullish_bos" || structure === "bullish_choch") bullScore += 3;
  if (structure === "bearish_bos" || structure === "bearish_choch") bearScore += 3;

  // OBs ativos (nao mitigados) somam peso
  const activeBullishOBs = orderBlocks.filter(
    (o) => o.type === "bullish" && !o.mitigated
  );
  const activeBearishOBs = orderBlocks.filter(
    (o) => o.type === "bearish" && !o.mitigated
  );
  bullScore += activeBullishOBs.length;
  bearScore += activeBearishOBs.length;

  // FVGs ativos
  const activeBullishFvgs = fvgs.filter(
    (f) => f.type === "bullish" && f.status === "active"
  );
  const activeBearishFvgs = fvgs.filter(
    (f) => f.type === "bearish" && f.status === "active"
  );
  bullScore += activeBullishFvgs.length * 0.5;
  bearScore += activeBearishFvgs.length * 0.5;

  if (bullScore > bearScore * 1.3) return "bullish";
  if (bearScore > bullScore * 1.3) return "bearish";
  return "neutral";
}

// ============================================================
// 7) RESUMO TEXTUAL (pra LLM e UI)
// ============================================================

function buildSummary(result: Omit<SmcResult, "summary">): string {
  const parts: string[] = [];

  const structureLabels: Record<MarketStructure, string> = {
    bullish_bos: "BOS bullish (continuacao de alta)",
    bearish_bos: "BOS bearish (continuacao de baixa)",
    bullish_choch: "CHoCH bullish (possivel reversao pra cima)",
    bearish_choch: "CHoCH bearish (possivel reversao pra baixa)",
    consolidating: "consolidando (sem quebra recente)",
  };
  parts.push(`Estrutura: ${structureLabels[result.marketStructure]}`);
  parts.push(`Vies institucional: ${result.bias}`);

  const activeOBs = result.orderBlocks.filter((o) => !o.mitigated).length;
  if (activeOBs > 0) parts.push(`${activeOBs} OBs ativos`);

  const activeFvgs = result.fvgs.filter((f) => f.status === "active").length;
  if (activeFvgs > 0) parts.push(`${activeFvgs} FVGs ativos`);

  const unsweptZones = result.liquidityZones.filter((z) => !z.swept).length;
  if (unsweptZones > 0)
    parts.push(`${unsweptZones} zonas de liquidez nao varridas`);

  return parts.join(" · ");
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

/**
 * Roda a analise SMC completa sobre o array de candles.
 *
 * @param candles serie temporal
 * @param atr ATR(14) atual — pra normalizar distancias e detectar impulso
 */
export function analyzeSmc(candles: Candle[], atr: number): SmcResult {
  if (candles.length < 50) {
    return {
      bias: "neutral",
      orderBlocks: [],
      fvgs: [],
      liquidityZones: [],
      marketStructure: "consolidating",
      lastSwingHigh: null,
      lastSwingLow: null,
      summary: "Dados insuficientes para analise SMC",
    };
  }

  const swings = findSwingPoints(candles, 3);
  const orderBlocks = findOrderBlocks(candles, atr, 5);
  const fvgs = findFairValueGaps(candles, 8);
  const rawZones = findLiquidityZones(swings, atr, 5);
  const liquidityZones = markSweptZones(rawZones, candles);
  const { structure, lastSwingHigh, lastSwingLow } = determineMarketStructure(
    candles,
    swings
  );
  const bias = determineBias(structure, orderBlocks, fvgs);

  const partial = {
    bias,
    orderBlocks,
    fvgs,
    liquidityZones,
    marketStructure: structure,
    lastSwingHigh,
    lastSwingLow,
  };

  return {
    ...partial,
    summary: buildSummary(partial),
  };
}
