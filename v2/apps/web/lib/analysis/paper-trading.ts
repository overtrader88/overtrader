/**
 * Paper-trading com HISTÓRICO — máquina de estado PURA (sem efeitos colaterais).
 *
 * Modelo MULTI: um trade aberto por (ativo|TF). Trocar o ativo/TF que você está
 * vendo NÃO cancela os outros — eles ficam abertos e são liquidados quando:
 *  - o preço ao vivo do PRÓPRIO ativo bate TP1/Stop (enquanto você olha), ou
 *  - ao voltar pra ele, os CANDLES desde a abertura mostram que bateu TP/Stop
 *    (liquidação retroativa — honesta, baseada em high/low das velas).
 * Cancelamento só acontece quando o sinal INVERTE de lado no mesmo contexto.
 *
 * Determinístico: recebe now/price/candles por parâmetro. Persistência
 * (localStorage) fica na borda. Honesto: simulação, não ordem real.
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
  pnlPct?: number;
  r?: number;
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
  closed: number;   // DECISIVOS (tp1 + stop) — cancelados não entram
  wins: number;     // só tp1
  losses: number;   // só stop
  winRate: number;  // 0–100 sobre decisivos
  totalR: number;
  avgR: number;
  avgPnlPct: number;
}

export const keyOf = (symbol: string, timeframe: string) => `${symbol}|${timeframe}`;
export const EMPTY_PAPER_STATE: PaperState = { open: {}, history: [] };
const HISTORY_CAP = 80;

const sigOf = (side: PaperSide, entry: number) => `${side}|${Math.round(entry * 1e6) / 1e6}`;

function close(t: PaperTrade, exit: number, status: PaperStatus, when: number): PaperTrade {
  const dir = t.side === "buy" ? 1 : -1;
  const pnlPct = ((exit - t.entry) / t.entry) * 100 * dir;
  const risk = Math.abs(t.entry - t.stop);
  const r = risk > 0 ? ((exit - t.entry) * dir) / risk : 0;
  return { ...t, closedAt: when, exit, status, pnlPct, r };
}

/** Acha o 1º ponto (candles desde a abertura, depois preço ao vivo) que bate
 *  TP1/Stop. Se uma vela toca os dois, conta STOP (conservador/honesto). */
function findExit(t: PaperTrade, candles: PaperCandle[], price: number): { exit: number; status: PaperStatus; at: number | null } | null {
  for (const c of candles) {
    if (c.time <= t.openedAt || !Number.isFinite(c.high) || !Number.isFinite(c.low)) continue;
    const stopHit = t.side === "buy" ? c.low <= t.stop : c.high >= t.stop;
    const tpHit = t.side === "buy" ? c.high >= t.tp1 : c.low <= t.tp1;
    if (stopHit) return { exit: t.stop, status: "stop", at: c.time };
    if (tpHit) return { exit: t.tp1, status: "tp1", at: c.time };
  }
  if (Number.isFinite(price)) {
    const stopHit = t.side === "buy" ? price <= t.stop : price >= t.stop;
    const tpHit = t.side === "buy" ? price >= t.tp1 : price <= t.tp1;
    if (stopHit) return { exit: t.stop, status: "stop", at: null };
    if (tpHit) return { exit: t.tp1, status: "tp1", at: null };
  }
  return null;
}

function openTrade(s: PaperSetup, now: number, symbol: string, timeframe: string): PaperTrade {
  return { id: `${symbol}|${timeframe}|${now}`, symbol, timeframe, side: s.side, entry: s.entry, stop: s.stop, tp1: s.tp1, openedAt: now, status: "open" };
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
    const hit = findExit(cur, candles, price);
    if (hit) {
      history = cap([...history, close(cur, hit.exit, hit.status, hit.at ?? now)]);
      open = { ...open }; delete open[key];
      changed = true;
    } else if (setup && setup.side !== cur.side) {
      // inverteu de lado no mesmo contexto → cancela e abre o novo
      history = cap([...history, close(cur, price, "cancel", now)]);
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
  // DECISIVOS = só TP1 (ganho) e Stop (perda). Cancelados NÃO contam.
  const decisive = history.filter((t) => t.status === "tp1" || t.status === "stop");
  const wins = decisive.filter((t) => t.status === "tp1").length;
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

/** P&L ao vivo do trade aberto (na exibição). */
export function livePnl(t: PaperTrade, price: number): { pnlPct: number; r: number } {
  const dir = t.side === "buy" ? 1 : -1;
  const pnlPct = ((price - t.entry) / t.entry) * 100 * dir;
  const risk = Math.abs(t.entry - t.stop);
  const r = risk > 0 ? ((price - t.entry) * dir) / risk : 0;
  return { pnlPct, r };
}

/** Normaliza estado vindo do localStorage (migra o formato antigo de 1 trade). */
export function normalizePaperState(raw: unknown): PaperState {
  if (!raw || typeof raw !== "object") return { open: {}, history: [] };
  const r = raw as { open?: unknown; history?: unknown };
  const history = Array.isArray(r.history) ? (r.history as PaperTrade[]) : [];
  const open = r.open;
  if (!open || typeof open !== "object") return { open: {}, history };
  // formato antigo: open era um único trade (tem symbol+side)
  const maybe = open as PaperTrade;
  if (typeof maybe.symbol === "string" && (maybe.side === "buy" || maybe.side === "sell")) {
    return { open: { [keyOf(maybe.symbol, maybe.timeframe)]: maybe }, history };
  }
  return { open: open as Record<string, PaperTrade>, history };
}
