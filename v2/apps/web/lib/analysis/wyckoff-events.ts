/**
 * Detecção heurística de EVENTOS Wyckoff — PURO (sem efeitos colaterais).
 *
 * Eventos de LIQUIDEZ (varredura + reclaim do extremo recente):
 *  - Spring: candle varre a mínima recente (pega liquidez abaixo) e FECHA de volta
 *    acima dela → armadilha de baixa, viés comprador.
 *  - UTAD (Upthrust After Distribution): varre a máxima recente e fecha de volta
 *    abaixo → armadilha de alta, viés vendedor.
 *
 * Eventos de FORÇA/FRAQUEZA (rompimento com expansão de range + volume):
 *  - SOS (Sign of Strength): fecha ACIMA da resistência do range, candle de alta
 *    largo e com volume → demanda no comando, viés comprador.
 *  - SOW (Sign of Weakness): fecha ABAIXO do suporte do range, candle de baixa
 *    largo e com volume → oferta no comando, viés vendedor.
 *
 * Eventos de ESTRUTURA do range:
 *  - AR (Automatic Rally): repique forte logo após uma queda climática → marca o
 *    topo provisório do range, viés comprador (reação).
 *  - ST (Secondary Test): reteste do extremo recente com range/volume MENORES
 *    (oferta/demanda secando) → confirmação. Bull testa o fundo, bear testa o topo.
 *  - LPS (Last Point of Support): após um SOS, primeiro repique que faz fundo MAIS
 *    ALTO e fecha de volta pra cima → último ponto de suporte antes da remarcação.
 *
 * Tudo é heurística honesta: rotulado como "evento" (sinal de contexto), não como
 * certeza da fase Wyckoff oficial. Quando não há volume (forex free tier), os
 * filtros de volume são ignorados em vez de invalidar o evento.
 */
import type { Candle } from "@tradeai/shared";

export type WyckoffEventType = "Spring" | "UTAD" | "SOS" | "SOW" | "AR" | "ST" | "LPS";

export interface WyckoffEvent {
  type: WyckoffEventType;
  side: "bull" | "bear";
  time: number;   // ms (abertura do candle do evento)
  price: number;  // preço de referência do evento (extremo varrido ou fechamento)
  note: string;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function detectWyckoffEvents(candles: Candle[], lookback = 20, max = 24): WyckoffEvent[] {
  const out: WyckoffEvent[] = [];
  if (candles.length < lookback + 2) return out;

  let lastSosIndex = -Infinity; // habilita LPS após um SOS recente
  let sosSwingLow = 0;          // suporte rompido no SOS (LPS precisa segurar acima)

  for (let i = lookback; i < candles.length; i++) {
    const c = candles[i]!;
    const window = candles.slice(i - lookback, i);
    let swingLow = Infinity, swingHigh = -Infinity;
    for (const w of window) {
      if (w.low < swingLow) swingLow = w.low;
      if (w.high > swingHigh) swingHigh = w.high;
    }
    const avgRange = mean(window.map((w) => w.high - w.low));
    const avgVol = mean(window.map((w) => w.volume));
    const range = c.high - c.low;
    const bull = c.close > c.open;
    const bear = c.close < c.open;
    // sem dados de volume → não barra o evento (forex free tier)
    const volUp = avgVol <= 0 ? true : c.volume >= 1.2 * avgVol;
    const volDown = avgVol <= 0 ? true : c.volume <= 0.9 * avgVol;
    const wide = avgRange > 0 && range >= 1.3 * avgRange;
    const tol = (avgRange > 0 ? avgRange : range) * 0.4;

    const push = (e: Omit<WyckoffEvent, "time">) => out.push({ time: c.time, ...e });

    // 1) Spring — varreu a mínima e recuperou (reclaim acima)
    if (c.low < swingLow && c.close > swingLow) {
      push({ type: "Spring", side: "bull", price: c.low, note: "varreu a mínima e recuperou" });
      continue;
    }
    // 2) UTAD — varreu a máxima e foi rejeitado (reclaim abaixo)
    if (c.high > swingHigh && c.close < swingHigh) {
      push({ type: "UTAD", side: "bear", price: c.high, note: "varreu a máxima e rejeitou" });
      continue;
    }
    // 3) SOS — rompimento de alta que SEGURA acima da resistência, com força
    if (c.close > swingHigh && bull && wide && volUp) {
      push({ type: "SOS", side: "bull", price: c.close, note: "rompeu resistência com força e volume" });
      lastSosIndex = i; sosSwingLow = swingLow;
      continue;
    }
    // 4) SOW — rompimento de baixa que SEGURA abaixo do suporte, com força
    if (c.close < swingLow && bear && wide && volUp) {
      push({ type: "SOW", side: "bear", price: c.close, note: "perdeu suporte com força e volume" });
      continue;
    }
    // 5) AR — repique forte logo após queda climática (reação, não rompimento)
    //    olha o saldo dos 3 candles anteriores; exige queda relevante e candle de alta largo
    const prev3 = candles.slice(Math.max(0, i - 3), i);
    const drop = prev3.length ? (prev3[0]!.high - Math.min(...prev3.map((w) => w.low))) : 0;
    if (bull && wide && drop >= 1.5 * avgRange && c.close < swingHigh) {
      push({ type: "AR", side: "bull", price: c.close, note: "repique automático após queda climática" });
      continue;
    }
    // 6) ST — reteste do extremo recente com range/volume menores (secagem)
    if (Math.abs(c.low - swingLow) <= tol && range <= avgRange && volDown && bull) {
      push({ type: "ST", side: "bull", price: c.low, note: "reteste do fundo com oferta secando" });
      continue;
    }
    if (Math.abs(c.high - swingHigh) <= tol && range <= avgRange && volDown && bear) {
      push({ type: "ST", side: "bear", price: c.high, note: "reteste do topo com demanda secando" });
      continue;
    }
    // 7) LPS — após SOS recente, primeiro fundo MAIS ALTO que segura acima do suporte rompido
    if (i - lastSosIndex >= 1 && i - lastSosIndex <= lookback && c.low > sosSwingLow && bull && range <= avgRange) {
      push({ type: "LPS", side: "bull", price: c.low, note: "último suporte (fundo mais alto) antes da remarcação" });
      lastSosIndex = -Infinity; // consome o SOS — só o primeiro LPS conta
      continue;
    }
  }

  return out.slice(-max);
}
