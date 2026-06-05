/**
 * Detecção de swing points (pivots) — base de SMC, harmônicos e WEGD.
 * No v1 este algoritmo estava copiado em 3 arquivos; aqui é único.
 */
import type { Candle } from "@tradeai/shared";

export interface SwingPoint {
  /** Índice do candle no array original. */
  index: number;
  /** Preço do swing (high para topo, low para fundo). */
  price: number;
  type: "high" | "low";
}

/**
 * Pivots locais confirmados por `lookback` candles de cada lado.
 * Maior lookback = menos swings, porém mais significativos.
 */
export function findSwingPoints(candles: Candle[], lookback = 3): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j]!.high >= c.high || candles[i + j]!.high >= c.high) isHigh = false;
      if (candles[i - j]!.low <= c.low || candles[i + j]!.low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swings.push({ index: i, price: c.high, type: "high" });
    else if (isLow) swings.push({ index: i, price: c.low, type: "low" });
  }
  return swings;
}

/**
 * Swings em ALTERNÂNCIA rígida (high-low-high-low...). Quando dois do mesmo
 * tipo aparecem seguidos, mantém o mais extremo. Usado pelos harmônicos (XABCD).
 */
export function findAlternatingSwings(candles: Candle[], lookback = 3): SwingPoint[] {
  const raw = findSwingPoints(candles, lookback);
  const alternated: SwingPoint[] = [];
  for (const s of raw) {
    const prev = alternated[alternated.length - 1];
    if (!prev || prev.type !== s.type) {
      alternated.push(s);
    } else if (s.type === "high" && s.price > prev.price) {
      alternated[alternated.length - 1] = s;
    } else if (s.type === "low" && s.price < prev.price) {
      alternated[alternated.length - 1] = s;
    }
  }
  return alternated;
}
