/**
 * Geradores de candles determinísticos para testes.
 *
 * Estratégia de "golden" honesta: como não temos acesso ao TradingView neste
 * ambiente, validamos contra CASOS ANALITICAMENTE CONHECIDOS (ex.: ATR de
 * candles com range constante = esse range) e INVARIANTES (RSI de série
 * estritamente crescente = 100). O cross-check numérico com o TradingView fica
 * documentado como passo manual (ver README de testes) para rodar online.
 */
import type { Candle } from "@tradeai/shared";

const STEP = 3_600_000; // 1h em ms

/** Candles com preço e range constantes → ATR conhecido = range. */
export function constantCandles(n: number, price = 100, range = 4): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: i * STEP,
      open: price,
      high: price + range / 2,
      low: price - range / 2,
      close: price,
      volume: 1000,
    });
  }
  return out;
}

/** Série estritamente crescente (close sobe `inc` por candle). */
export function upTrendCandles(n: number, start = 100, inc = 1): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = start + i * inc;
    out.push({
      time: i * STEP,
      open: close - inc,
      high: close + 0.5,
      low: close - inc - 0.5,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

/** Série estritamente decrescente. */
export function downTrendCandles(n: number, start = 1000, dec = 1): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = start - i * dec;
    out.push({
      time: i * STEP,
      open: close + dec,
      high: close + dec + 0.5,
      low: close - 0.5,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

/** LCG determinístico (sem Math.random) — reprodutível em qualquer máquina. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Random walk determinístico "parecido com mercado" — para o teste e2e do
 * pipeline. Mesma seed → mesma série.
 */
export function seededWalk(n: number, seed = 42, start = 100): Candle[] {
  const rnd = lcg(seed);
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const drift = (rnd() - 0.48) * 2; // leve viés de alta
    const open = price;
    const close = Math.max(1, price + drift);
    const high = Math.max(open, close) + rnd() * 1.5;
    const low = Math.min(open, close) - rnd() * 1.5;
    out.push({
      time: i * STEP,
      open,
      high,
      low,
      close,
      volume: 500 + Math.floor(rnd() * 1000),
    });
    price = close;
  }
  return out;
}
