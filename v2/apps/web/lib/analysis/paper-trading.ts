/**
 * Paper-trading com HISTÓRICO — máquina de estado PURA (sem efeitos colaterais).
 *
 * GESTÃO REAL (igual ao track record / monitor): a posição é dividida em 3 terços
 * e gerida com `resolveLifecycle` do motor — realiza 1/3 em cada alvo e o stop SOBE
 * sozinho (→ breakeven após TP1, → TP1 após TP2). NÃO é "fecha tudo no TP1": ao
 * bater TP1 o stop vai pra entrada, mas, varrendo os candles em ordem, só zera no
 * breakeven se o preço voltar SEM ter tocado um alvo maior antes.
 *
 * Modelo MULTI: um trade aberto por (ativo|TF). Trocar o ativo/TF que você está
 * vendo NÃO cancela os outros — eles ficam abertos e são liquidados quando:
 *  - o preço ao vivo do PRÓPRIO ativo resolve o ciclo (enquanto você olha), ou
 *  - ao voltar pra ele, os CANDLES desde a abertura mostram o desfecho
 *    (liquidação retroativa — honesta, baseada em high/low das velas).
 * Cancelamento só acontece quando o sinal INVERTE de lado no mesmo contexto.
 *
 * Determinístico: recebe now/price/candles por parâmetro. Persistência
 * (localStorage) fica na borda. Honesto: simulação, não ordem real.
 */
import { resolveLifecycle, type SignalPlan, type SignalOutcome } from "@tradeai/engine";
import type { Candle } from "@tradeai/shared";

export type PaperSide = "buy" | "sell";
export type PaperStatus = "open" | "tp1" | "tp2" | "tp3" | "stop" | "cancel";

export interface PaperSetup {
  side: PaperSide;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  timeframe: string;
  side: PaperSide;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  openedAt: number;
  closedAt?: number;
  exit?: number;
  status: PaperStatus;
  pnlPct?: number;
  /** R ponderado pela gestão em terços (sinônimo de pnlR; mantido p/ compat de UI). */
  r?: number;
  pnlR?: number;
}

/** Vela mínima p/ liquidação retroativa (tempo em ms). */
export interface PaperCandle { time: number; high: number; low: number; }

export interface PaperState {
  open: Record<string, PaperTrade>; // chave: `${symbol}|${timeframe}`
  history: PaperTrade[];             // mais recentes no fim
}

export interface PaperInput {
  setup: PaperSetup | null;
  price: number;
  now: number;
  symbol: string;
  timeframe: string;
  candles?: PaperCandle[];
}

export interface PaperStats {
  closed: number;   // DECISIVOS (tp1/tp2/tp3 + stop) — cancelados não entram
  wins: number;     // tp1/tp2/tp3
  losses: number;   // só stop
  winRate: number;  // 0–100 sobre decisivos
  totalR: number;
  avgR: number;
  avgPnlPct: number;
}

/** Estado AO VIVO de um trade aberto (gestão em terços marcada a mercado). */
export interface PaperLive {
  tp1Hit: boolean; tp2Hit: boolean; tp3Hit: boolean;
  stopStage: "initial" | "breakeven" | "tp1";
  currentStop: number;
  closedFraction: number;
  /** R já travado nas parciais. */
  realizedR: number;
  /** R não-realizado da fração ainda aberta (ao preço atual). */
  openR: number;
  totalR: number;
  resolved: boolean;
  outcome: string | null;
}

export const keyOf = (symbol: string, timeframe: string) => `${symbol}|${timeframe}`;
export const EMPTY_PAPER_STATE: PaperState = { open: {}, history: [] };
const HISTORY_CAP = 80;

const sigOf = (side: PaperSide, entry: number) => `${side}|${Math.round(entry * 1e6) / 1e6}`;
const planOf = (t: PaperTrade): SignalPlan => ({
  side: t.side, entry: t.entry, stopLoss: t.stop, takeProfit1: t.tp1, takeProfit2: t.tp2, takeProfit3: t.tp3,
});
const STATUS_OF: Record<SignalOutcome, PaperStatus> = { TP1: "tp1", TP2: "tp2", TP3: "tp3", SL: "stop", EXPIRED: "stop" };

/**
 * Candles desde a abertura (ascendente) + uma vela sintética do preço AO VIVO no
 * fim — para o ciclo resolver entre fechamentos. `times[i]` = horário da vela (NaN
 * na sintética → usa `now`).
 */
function futureFrom(t: PaperTrade, candles: PaperCandle[], price: number): { fut: Candle[]; times: number[] } {
  const rows = candles
    .filter((c) => c.time > t.openedAt && Number.isFinite(c.high) && Number.isFinite(c.low))
    .sort((a, b) => a.time - b.time);
  const fut: Candle[] = [];
  const times: number[] = [];
  for (const c of rows) {
    const mid = (c.high + c.low) / 2;
    fut.push({ time: c.time, open: mid, high: c.high, low: c.low, close: mid, volume: 0 });
    times.push(c.time);
  }
  if (Number.isFinite(price)) {
    fut.push({ time: (rows.length ? rows[rows.length - 1]!.time : t.openedAt) + 1, open: price, high: price, low: price, close: price, volume: 0 });
    times.push(NaN);
  }
  return { fut, times };
}

/** Resolve o ciclo de vida de um trade aberto. null = segue aberto. */
function resolveCur(t: PaperTrade, candles: PaperCandle[], price: number, now: number): { outcome: SignalOutcome; pnlR: number; exit: number; at: number } | null {
  const { fut, times } = futureFrom(t, candles, price);
  if (fut.length === 0) return null;
  const r = resolveLifecycle(planOf(t), fut, fut.length + 1); // maxDuration > n → nunca "expira"
  if (r.status !== "resolved" || r.outcome == null) return null;
  const idx = r.durationCandles - 1;
  const at = idx >= 0 && idx < times.length && Number.isFinite(times[idx]!) ? times[idx]! : now;
  return { outcome: r.outcome, pnlR: r.pnlR ?? 0, exit: r.exitPrice ?? price, at };
}

function closeResolved(t: PaperTrade, res: { outcome: SignalOutcome; pnlR: number; exit: number; at: number }): PaperTrade {
  const risk = Math.abs(t.entry - t.stop);
  const pnlPct = risk > 0 ? (res.pnlR * risk / t.entry) * 100 : 0;
  return { ...t, closedAt: res.at, exit: res.exit, status: STATUS_OF[res.outcome], pnlR: res.pnlR, r: res.pnlR, pnlPct };
}

function closeCancel(t: PaperTrade, price: number, when: number): PaperTrade {
  const dir = t.side === "buy" ? 1 : -1;
  const risk = Math.abs(t.entry - t.stop);
  const pnlPct = ((price - t.entry) / t.entry) * 100 * dir;
  const r = risk > 0 ? ((price - t.entry) * dir) / risk : 0;
  return { ...t, closedAt: when, exit: price, status: "cancel", pnlPct, r, pnlR: r };
}

function openTrade(s: PaperSetup, now: number, symbol: string, timeframe: string): PaperTrade {
  return { id: `${symbol}|${timeframe}|${now}`, symbol, timeframe, side: s.side, entry: s.entry, stop: s.stop, tp1: s.tp1, tp2: s.tp2, tp3: s.tp3, openedAt: now, status: "open" };
}

const cap = (h: PaperTrade[]) => (h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h);

export function stepPaperTrading(state: PaperState, input: PaperInput): PaperState {
  const { setup, price, now, symbol, timeframe, candles = [] } = input;
  if (!Number.isFinite(price)) return state;

  const key = keyOf(symbol, timeframe);
  let open = state.open;
  let history = state.history;
  let changed = false;
  const cur = open[key];

  if (cur) {
    const res = resolveCur(cur, candles, price, now);
    if (res) {
      history = cap([...history, closeResolved(cur, res)]);
      open = { ...open }; delete open[key];
      changed = true;
    } else if (setup && setup.side !== cur.side) {
      // inverteu de lado no mesmo contexto → cancela e abre o novo
      history = cap([...history, closeCancel(cur, price, now)]);
      open = { ...open, [key]: openTrade(setup, now, symbol, timeframe) };
      changed = true;
    }
    // senão: segue aberto (P&L ao vivo é calculado na exibição)
  }

  // abre se não há trade NESTE contexto e o setup é novo (≠ último fechado do contexto)
  if (!open[key] && setup) {
    const last = [...history].reverse().find((t) => t.symbol === symbol && t.timeframe === timeframe);
    const sameAsLast = !!last && sigOf(setup.side, setup.entry) === sigOf(last.side, last.entry);
    if (!sameAsLast) {
      open = { ...open, [key]: openTrade(setup, now, symbol, timeframe) };
      changed = true;
    }
  }

  return changed ? { open, history } : state;
}

export function paperStats(history: PaperTrade[]): PaperStats {
  // DECISIVOS = alvos (tp1/tp2/tp3) e Stop. Cancelados NÃO contam.
  const isWin = (s: PaperStatus) => s === "tp1" || s === "tp2" || s === "tp3";
  const decisive = history.filter((t) => isWin(t.status) || t.status === "stop");
  const wins = decisive.filter((t) => isWin(t.status)).length;
  const losses = decisive.filter((t) => t.status === "stop").length;
  const totalR = decisive.reduce((a, t) => a + (t.r ?? 0), 0);
  const avgPnl = decisive.length ? decisive.reduce((a, t) => a + (t.pnlPct ?? 0), 0) / decisive.length : 0;
  return {
    closed: decisive.length,
    wins, losses,
    winRate: decisive.length ? (wins / decisive.length) * 100 : 0,
    totalR,
    avgR: decisive.length ? totalR / decisive.length : 0,
    avgPnlPct: avgPnl,
  };
}

/** Estado AO VIVO do trade aberto — gestão em terços marcada a mercado (p/ exibição). */
export function paperLiveState(t: PaperTrade, candles: PaperCandle[], price: number): PaperLive {
  const { fut } = futureFrom(t, candles, price);
  const lcFut = fut.length ? fut : [{ time: t.openedAt + 1, open: t.entry, high: t.entry, low: t.entry, close: t.entry, volume: 0 }];
  const r = resolveLifecycle(planOf(t), lcFut, lcFut.length + 1);
  const risk = Math.abs(t.entry - t.stop);
  const dir = t.side === "buy" ? 1 : -1;
  const rAtPrice = risk > 0 && Number.isFinite(price) ? ((price - t.entry) * dir) / risk : 0;
  const openR = (1 - r.closedFraction) * rAtPrice;
  return {
    tp1Hit: r.tp1Hit, tp2Hit: r.tp2Hit, tp3Hit: r.tp3Hit, stopStage: r.stopStage,
    currentStop: r.currentStop, closedFraction: r.closedFraction, realizedR: r.realizedR,
    openR: Math.round(openR * 1e4) / 1e4, totalR: Math.round((r.realizedR + openR) * 1e4) / 1e4,
    resolved: r.status === "resolved", outcome: r.outcome,
  };
}

/** P&L ao vivo simples (posição cheia) do trade aberto — fallback de exibição. */
export function livePnl(t: PaperTrade, price: number): { pnlPct: number; r: number } {
  const dir = t.side === "buy" ? 1 : -1;
  const pnlPct = ((price - t.entry) / t.entry) * 100 * dir;
  const risk = Math.abs(t.entry - t.stop);
  const r = risk > 0 ? ((price - t.entry) * dir) / risk : 0;
  return { pnlPct, r };
}

/** Garante tp2/tp3 (trades antigos só tinham tp1 → colapsa pro alvo único). */
function fillTargets(t: PaperTrade): PaperTrade {
  return { ...t, tp2: Number.isFinite(t.tp2) ? t.tp2 : t.tp1, tp3: Number.isFinite(t.tp3) ? t.tp3 : t.tp1 };
}

/** Normaliza estado vindo do localStorage (migra o formato antigo de 1 trade + tp único). */
export function normalizePaperState(raw: unknown): PaperState {
  if (!raw || typeof raw !== "object") return { open: {}, history: [] };
  const r = raw as { open?: unknown; history?: unknown };
  const history = (Array.isArray(r.history) ? (r.history as PaperTrade[]) : []).map(fillTargets);
  const open = r.open;
  if (!open || typeof open !== "object") return { open: {}, history };
  // formato antigo: open era um único trade (tem symbol+side)
  const maybe = open as PaperTrade;
  if (typeof maybe.symbol === "string" && (maybe.side === "buy" || maybe.side === "sell")) {
    return { open: { [keyOf(maybe.symbol, maybe.timeframe)]: fillTargets(maybe) }, history };
  }
  const mapped: Record<string, PaperTrade> = {};
  for (const [k, v] of Object.entries(open as Record<string, PaperTrade>)) mapped[k] = fillTargets(v);
  return { open: mapped, history };
}
