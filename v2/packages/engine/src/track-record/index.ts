/**
 * Track record FORWARD — o moat (Fase C4).
 *
 * Resolve o desfecho REAL de um sinal já emitido (carimbado numa data) contra os
 * candles que vieram DEPOIS, e agrega os resultados com IC e n. É a versão
 * honesta da "performance auditada": cada sinal teve seu plano fixado na emissão;
 * aqui só medimos o que aconteceu — sem reotimizar nada.
 *
 * PURO e determinístico (sem rede, sem relógio). A borda busca os candles e grava
 * o outcome; este módulo só decide.
 */
import type { Candle } from "@tradeai/shared";
import type { Estimate } from "../types";
import { wilsonInterval, meanConfidenceInterval, bootstrapInterval } from "../stats";

export type SignalOutcome = "TP1" | "TP2" | "TP3" | "SL" | "EXPIRED";

export interface SignalPlan {
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
}

export interface ResolvedOutcome {
  /** `open` = ainda dentro da janela e sem nível tocado nem expiração. */
  status: "resolved" | "open";
  outcome: SignalOutcome | null;
  /** Índice (em `futureCandles`) do candle de saída; -1 enquanto aberto. */
  exitIndex: number;
  exitPrice: number | null;
  /** Resultado em múltiplos de risco (R). null enquanto aberto. */
  pnlR: number | null;
  /** Candles decorridos até a resolução (ou varridos até agora). */
  durationCandles: number;
}

const OPEN: ResolvedOutcome = { status: "open", outcome: null, exitIndex: -1, exitPrice: null, pnlR: null, durationCandles: 0 };

/**
 * Resolve o desfecho de um sinal contra os candles POSTERIORES à emissão.
 *  - Verifica o STOP antes dos alvos no mesmo candle (conservador, credibilidade-first).
 *  - Retorna o maior alvo atingido (TP1<TP2<TP3) ou SL — o primeiro a tocar.
 *  - `EXPIRED` (marca-a-mercado no fechamento) só após `maxDuration` candles.
 *  - `open` enquanto não tocou nada E ainda não atingiu `maxDuration` candles.
 */
export function resolveOutcome(plan: SignalPlan, futureCandles: Candle[], maxDuration: number): ResolvedOutcome {
  const { side, entry, stopLoss, takeProfit1, takeProfit2, takeProfit3 } = plan;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0 || !Number.isFinite(risk)) return { ...OPEN };

  const scan = Math.min(futureCandles.length, maxDuration);
  for (let j = 0; j < scan; j++) {
    const c = futureCandles[j]!;
    if (side === "buy") {
      if (c.low <= stopLoss) return resolved("SL", j, stopLoss, (stopLoss - entry) / risk);
      if (c.high >= takeProfit3) return resolved("TP3", j, takeProfit3, (takeProfit3 - entry) / risk);
      if (c.high >= takeProfit2) return resolved("TP2", j, takeProfit2, (takeProfit2 - entry) / risk);
      if (c.high >= takeProfit1) return resolved("TP1", j, takeProfit1, (takeProfit1 - entry) / risk);
    } else {
      if (c.high >= stopLoss) return resolved("SL", j, stopLoss, (entry - stopLoss) / risk);
      if (c.low <= takeProfit3) return resolved("TP3", j, takeProfit3, (entry - takeProfit3) / risk);
      if (c.low <= takeProfit2) return resolved("TP2", j, takeProfit2, (entry - takeProfit2) / risk);
      if (c.low <= takeProfit1) return resolved("TP1", j, takeProfit1, (entry - takeProfit1) / risk);
    }
  }

  // Sem nível tocado. Só "expira" quando já há candles suficientes para fechar o caso.
  if (futureCandles.length >= maxDuration) {
    const last = futureCandles[maxDuration - 1]!;
    const pnlPoints = side === "buy" ? last.close - entry : entry - last.close;
    return resolved("EXPIRED", maxDuration - 1, last.close, pnlPoints / risk);
  }
  return { ...OPEN, durationCandles: futureCandles.length };
}

function resolved(outcome: SignalOutcome, exitIndex: number, exitPrice: number, pnlR: number): ResolvedOutcome {
  return { status: "resolved", outcome, exitIndex, exitPrice, pnlR, durationCandles: exitIndex + 1 };
}

// =====================================================================
// Ciclo de vida do sinal (Fase C3) — saída escalonada em 3 alvos + breakeven
// automático. A posição é dividida em 3 terços: realiza 1/3 em cada TP e o stop
// SOBE sozinho (→ breakeven após TP1, → TP1 após TP2). Modela como o sinal seria
// gerido de verdade — não "tudo ou nada". PURO e determinístico.
// =====================================================================

export type StopStage = "initial" | "breakeven" | "tp1";

export interface LifecycleState {
  status: "resolved" | "open";
  /** Classificação final (maior alvo atingido / SL / EXPIRED). null enquanto aberto. */
  outcome: SignalOutcome | null;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  /** Onde o stop está agora: inicial · breakeven (após TP1) · no TP1 (após TP2). */
  stopStage: StopStage;
  currentStop: number;
  /** Fração da posição já realizada (0..1). */
  closedFraction: number;
  exitPrice: number | null;
  /** R ponderado realizado (terços × R de cada saída). null enquanto totalmente aberto. */
  pnlR: number | null;
  durationCandles: number;
}

const THIRD = 1 / 3;
const OPEN_LC: LifecycleState = {
  status: "open", outcome: null, tp1Hit: false, tp2Hit: false, tp3Hit: false,
  stopStage: "initial", currentStop: 0, closedFraction: 0, exitPrice: null, pnlR: null, durationCandles: 0,
};

/**
 * Resolve o CICLO DE VIDA de um sinal contra os candles posteriores, com saída
 * escalonada (1/3 em cada TP) e breakeven automático. Verifica o stop antes dos
 * alvos no mesmo candle (conservador). Devolve o estado vivo (para sinais ainda
 * abertos: quais alvos já bateram + onde está o stop) ou o desfecho final.
 */
export function resolveLifecycle(plan: SignalPlan, futureCandles: Candle[], maxDuration: number): LifecycleState {
  const { side, entry, stopLoss, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3 } = plan;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0 || !Number.isFinite(risk)) return { ...OPEN_LC };

  const rOf = (p: number): number => (side === "buy" ? p - entry : entry - p) / risk;
  const reachedTp = (c: Candle, tp: number): boolean => (side === "buy" ? c.high >= tp : c.low <= tp);
  const hitStop = (c: Candle, stop: number): boolean => (side === "buy" ? c.low <= stop : c.high >= stop);

  let stage = 0;
  let stop = stopLoss;
  let stopStage: StopStage = "initial";
  let realizedR = 0;
  let closed = 0;
  let tp1Hit = false;
  let tp2Hit = false;
  let tp3Hit = false;

  const finish = (outcome: SignalOutcome, j: number, exitPrice: number): LifecycleState => ({
    status: "resolved", outcome, tp1Hit, tp2Hit, tp3Hit, stopStage, currentStop: stop,
    closedFraction: 1, exitPrice, pnlR: Math.round(realizedR * 1e4) / 1e4, durationCandles: j + 1,
  });

  const scan = Math.min(futureCandles.length, maxDuration);
  for (let j = 0; j < scan; j++) {
    const c = futureCandles[j]!;
    // 1) Stop primeiro (conservador).
    if (hitStop(c, stop)) {
      realizedR += (1 - closed) * rOf(stop);
      const outcome: SignalOutcome = stage === 0 ? "SL" : stage === 1 ? "TP1" : "TP2";
      return finish(outcome, j, stop);
    }
    // 2) Alvos — do maior para o menor (candle pode estourar vários).
    if (!tp3Hit && reachedTp(c, tp3)) {
      if (!tp1Hit) { realizedR += THIRD * rOf(tp1); tp1Hit = true; }
      if (!tp2Hit) { realizedR += THIRD * rOf(tp2); tp2Hit = true; }
      realizedR += THIRD * rOf(tp3); tp3Hit = true;
      return finish("TP3", j, tp3);
    }
    if (!tp2Hit && reachedTp(c, tp2)) {
      if (!tp1Hit) { realizedR += THIRD * rOf(tp1); tp1Hit = true; closed += THIRD; }
      realizedR += THIRD * rOf(tp2); tp2Hit = true; closed += THIRD;
      stage = 2; stop = tp1; stopStage = "tp1";
      continue;
    }
    if (!tp1Hit && reachedTp(c, tp1)) {
      realizedR += THIRD * rOf(tp1); tp1Hit = true; closed += THIRD;
      stage = 1; stop = entry; stopStage = "breakeven";
      continue;
    }
  }

  // Sem saída terminal dentro da janela.
  if (futureCandles.length >= maxDuration) {
    const last = futureCandles[maxDuration - 1]!;
    realizedR += (1 - closed) * rOf(last.close);
    return finish("EXPIRED", maxDuration - 1, last.close);
  }
  return { status: "open", outcome: null, tp1Hit, tp2Hit, tp3Hit, stopStage, currentStop: stop, closedFraction: closed, exitPrice: null, pnlR: null, durationCandles: futureCandles.length };
}

export interface TrackRecordStats {
  /** Total de sinais resolvidos. */
  n: number;
  /** Decisivos (win + SL) — base da suficiência de amostra do selo. */
  decisive: number;
  outcomes: Record<SignalOutcome, number>;
  winRate: Estimate;
  profitFactor: Estimate;
  avgR: Estimate;
  /** R acumulado (soma dos pnlR). */
  totalR: number;
}

function profitFactor(pnls: number[]): number {
  let g = 0;
  let l = 0;
  for (const r of pnls) {
    if (r > 0) g += r;
    else if (r < 0) l += -r;
  }
  if (l > 0) return Math.min(99, g / l);
  return g > 0 ? 99 : 0;
}

/**
 * Agrega sinais RESOLVIDOS em win rate + profit factor + R médio, todos com IC 95%
 * (Wilson / bootstrap / t-Student) e n. `rng` torna o bootstrap determinístico.
 */
export function aggregateTrackRecord(
  records: { outcome: SignalOutcome; pnlR: number }[],
  rng: () => number = mulberry32(42),
): TrackRecordStats {
  const outcomes: Record<SignalOutcome, number> = { TP1: 0, TP2: 0, TP3: 0, SL: 0, EXPIRED: 0 };
  const pnls: number[] = [];
  let wins = 0;
  let sl = 0;
  let totalR = 0;
  for (const r of records) {
    outcomes[r.outcome]++;
    pnls.push(r.pnlR);
    totalR += r.pnlR;
    if (r.outcome === "TP1" || r.outcome === "TP2" || r.outcome === "TP3") wins++;
    else if (r.outcome === "SL") sl++;
  }
  const decisive = wins + sl;
  return {
    n: records.length,
    decisive,
    outcomes,
    winRate: wilsonInterval(wins, decisive),
    profitFactor: bootstrapInterval(pnls, profitFactor, { iterations: 1000, rng }),
    avgR: meanConfidenceInterval(pnls),
    totalR: Math.round(totalR * 100) / 100,
  };
}

/** PRNG determinístico (mesmo do backtest) p/ o bootstrap ser reproduzível. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
