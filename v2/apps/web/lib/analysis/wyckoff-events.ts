/**
 * Detecção heurística de EVENTOS Wyckoff (Spring / UTAD) — PURO.
 *  - Spring: candle varre a mínima recente (pega liquidez abaixo) e FECHA de volta
 *    acima dela → armadilha de baixa, viés comprador.
 *  - UTAD (Upthrust After Distribution): varre a máxima recente e fecha de volta
 *    abaixo → armadilha de alta, viés vendedor.
 * Heurística de varredura+reclaim — não é "a fase Wyckoff oficial", é um sinal de
 * liquidez. Honesto: rotulado como evento, não como certeza.
 */
import type { Candle } from "@tradeai/shared";

export interface WyckoffEvent {
  type: "Spring" | "UTAD";
  side: "bull" | "bear";
  time: number;   // ms (abertura do candle do evento)
  price: number;  // extremo varrido
  note: string;
}

export function detectWyckoffEvents(candles: Candle[], lookback = 20, max = 6): WyckoffEvent[] {
  const out: WyckoffEvent[] = [];
  if (candles.length < lookback + 2) return out;

  for (let i = lookback; i < candles.length; i++) {
    const c = candles[i]!;
    let swingLow = Infinity, swingHigh = -Infinity;
    for (let j = i - lookback; j < i; j++) {
      const w = candles[j]!;
      if (w.low < swingLow) swingLow = w.low;
      if (w.high > swingHigh) swingHigh = w.high;
    }
    // pierce abaixo e reclaim → Spring
    if (c.low < swingLow && c.close > swingLow) {
      out.push({ type: "Spring", side: "bull", time: c.time, price: c.low, note: "varreu a mínima e recuperou" });
    } else if (c.high > swingHigh && c.close < swingHigh) {
      out.push({ type: "UTAD", side: "bear", time: c.time, price: c.high, note: "varreu a máxima e rejeitou" });
    }
  }
  return out.slice(-max);
}
