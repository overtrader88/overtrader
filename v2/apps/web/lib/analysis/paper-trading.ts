/**
 * Paper-trading com HISTÓRICO — máquina de estado PURA (sem efeitos colaterais).
 *
 * A página ao vivo faz polling (a cada ~30s) e calcula o setup vigente. A cada
 * "tick" chamamos `stepPaperTrading`, que:
 *  - ABRE um paper-trade quando surge um setup novo (e não há trade aberto);
 *  - acompanha o trade aberto contra o preço ao vivo;
 *  - FECHA quando bate TP1 (ganho) ou Stop (perda), registrando o resultado;
 *  - CANCELA o trade aberto se o setup virar de lado (flip) — e abre o novo.
 *
 * Tudo é determinístico: recebe `now`/`price` por parâmetro, nada de Date.now()
 * aqui dentro. Persistência (localStorage) fica na borda (componente).
 * Honesto: é simulação de papel, não ordem real nem recomendação.
 */

export type PaperSide = "buy" | "sell";
export type PaperStatus = "open" | "tp1" | "stop" | "cancel";

export interface PaperSetup {
  side: PaperSide;
  entry: number;
  stop: number;
  tp1: number;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  timeframe: string;
  side: PaperSide;
  entry: number;
  stop: number;
  tp1: number;
  openedAt: number;
  closedAt?: number;
  exit?: number;
  status: PaperStatus;
  pnlPct?: number; // P&L % na direção da operação (no fechamento)
  r?: number;      // múltiplo de R capturado (no fechamento)
}

export interface PaperState {
  open: PaperTrade | null;
  history: PaperTrade[]; // mais recentes no fim
}

export interface PaperInput {
  setup: PaperSetup | null;
  price: number;
  now: number;
  symbol: string;
  timeframe: string;
}

export interface PaperStats {
  closed: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100
  totalR: number;
  avgR: number;
  avgPnlPct: number;
}

export const EMPTY_PAPER_STATE: PaperState = { open: null, history: [] };
const HISTORY_CAP = 50;

const sig = (s: PaperSetup) => `${s.side}|${Math.round(s.entry * 1e6) / 1e6}`;

function close(t: PaperTrade, exit: number, status: PaperStatus, now: number): PaperTrade {
  const dir = t.side === "buy" ? 1 : -1;
  const pnlPct = ((exit - t.entry) / t.entry) * 100 * dir;
  const risk = Math.abs(t.entry - t.stop);
  const r = risk > 0 ? ((exit - t.entry) * dir) / risk : 0;
  return { ...t, closedAt: now, exit, status, pnlPct, r };
}

export function stepPaperTrading(state: PaperState, input: PaperInput): PaperState {
  const { setup, price, now, symbol, timeframe } = input;
  if (!Number.isFinite(price)) return state;

  const { open } = state;
  const history = state.history;

  // 1) Há trade aberto? Verifica saída por TP1/Stop ou flip de contexto.
  if (open) {
    const hitStop = open.side === "buy" ? price <= open.stop : price >= open.stop;
    const hitTp = open.side === "buy" ? price >= open.tp1 : price <= open.tp1;
    if (hitStop) {
      return { open: null, history: cap([...history, close(open, open.stop, "stop", now)]) };
    }
    if (hitTp) {
      return { open: null, history: cap([...history, close(open, open.tp1, "tp1", now)]) };
    }
    // flip / mudança de ativo-tf / setup sumiu → cancela ao preço atual
    const contextChanged = open.symbol !== symbol || open.timeframe !== timeframe;
    const flipped = setup ? setup.side !== open.side : true;
    if (contextChanged || flipped) {
      const cancelled = close(open, price, "cancel", now);
      const nextHist = cap([...history, cancelled]);
      // abre o novo setup imediatamente, se houver e o contexto bate
      if (setup && !contextChanged && setup.side !== open.side) {
        return { open: openTrade(setup, now, symbol, timeframe), history: nextHist };
      }
      return { open: null, history: nextHist };
    }
    // segue aberto, sem mudança persistente (P&L ao vivo é calculado na exibição)
    return state;
  }

  // 2) Sem trade aberto: abre se houver setup novo (assinatura != último fechado)
  if (setup) {
    const last = history[history.length - 1];
    const sameAsLast = last && last.symbol === symbol && last.timeframe === timeframe && sig(setup) === `${last.side}|${Math.round(last.entry * 1e6) / 1e6}`;
    if (!sameAsLast) {
      return { open: openTrade(setup, now, symbol, timeframe), history };
    }
  }
  return state;
}

function openTrade(s: PaperSetup, now: number, symbol: string, timeframe: string): PaperTrade {
  return {
    id: `${symbol}|${timeframe}|${now}`,
    symbol, timeframe,
    side: s.side, entry: s.entry, stop: s.stop, tp1: s.tp1,
    openedAt: now, status: "open",
  };
}

function cap(h: PaperTrade[]): PaperTrade[] {
  return h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h;
}

export function paperStats(history: PaperTrade[]): PaperStats {
  const closed = history.filter((t) => t.status === "tp1" || t.status === "stop" || t.status === "cancel");
  const wins = closed.filter((t) => (t.r ?? 0) > 0).length;
  const losses = closed.filter((t) => (t.r ?? 0) <= 0).length;
  const totalR = closed.reduce((a, t) => a + (t.r ?? 0), 0);
  const avgPnl = closed.length ? closed.reduce((a, t) => a + (t.pnlPct ?? 0), 0) / closed.length : 0;
  return {
    closed: closed.length,
    wins, losses,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    totalR,
    avgR: closed.length ? totalR / closed.length : 0,
    avgPnlPct: avgPnl,
  };
}

// helper exportado p/ a borda calcular P&L ao vivo do trade aberto
export function livePnl(t: PaperTrade, price: number): { pnlPct: number; r: number } {
  const dir = t.side === "buy" ? 1 : -1;
  const pnlPct = ((price - t.entry) / t.entry) * 100 * dir;
  const risk = Math.abs(t.entry - t.stop);
  const r = risk > 0 ? ((price - t.entry) * dir) / risk : 0;
  return { pnlPct, r };
}
