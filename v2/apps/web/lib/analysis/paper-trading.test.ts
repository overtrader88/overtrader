import { describe, it, expect } from "vitest";
import { stepPaperTrading, paperStats, livePnl, keyOf, normalizePaperState, EMPTY_PAPER_STATE, type PaperState, type PaperSetup } from "./paper-trading";

const BUY: PaperSetup = { side: "buy", entry: 100, stop: 95, tp1: 110 };
const ctx = { symbol: "BTCUSDT", timeframe: "4h" };
const K = keyOf("BTCUSDT", "4h");

describe("stepPaperTrading (multi-open)", () => {
  it("abre um trade por contexto", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    expect(s.open[K]).toBeTruthy();
    expect(s.open[K]!.side).toBe("buy");
  });

  it("trocar de ativo/TF NÃO cancela o trade aberto do outro contexto", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    // agora olha outro contexto (ETH 1h) com um setup próprio
    s = stepPaperTrading(s, { setup: { side: "sell", entry: 50, stop: 53, tp1: 44 }, price: 50, now: 2, symbol: "ETHUSDT", timeframe: "1h" });
    // o BTC 4h continua aberto, e abriu o ETH 1h
    expect(s.open[K]).toBeTruthy();
    expect(s.open[keyOf("ETHUSDT", "1h")]).toBeTruthy();
    expect(s.history).toHaveLength(0); // nada cancelado
  });

  it("fecha em TP1 (ganho) pelo preço ao vivo", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 110, now: 2, ...ctx });
    expect(s.open[K]).toBeUndefined();
    expect(s.history.at(-1)!.status).toBe("tp1");
    expect(s.history.at(-1)!.r).toBeCloseTo(2, 1);
  });

  it("liquida RETROATIVO por candles ao voltar (stop batido enquanto fora)", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    // volta com candles que furaram o stop (low 94 <= 95)
    s = stepPaperTrading(s, { setup: null, price: 99, now: 5000, ...ctx, candles: [{ time: 2000, high: 101, low: 94 }] });
    expect(s.open[K]).toBeUndefined();
    expect(s.history.at(-1)!.status).toBe("stop");
    expect(s.history.at(-1)!.closedAt).toBe(2000);
  });

  it("vela que toca TP e Stop juntos conta STOP (conservador)", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 100, now: 5000, ...ctx, candles: [{ time: 2000, high: 111, low: 94 }] });
    expect(s.history.at(-1)!.status).toBe("stop");
  });

  it("flip de lado no mesmo contexto cancela e abre o novo", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const SELL: PaperSetup = { side: "sell", entry: 102, stop: 107, tp1: 92 };
    s = stepPaperTrading(s, { setup: SELL, price: 102, now: 2, ...ctx });
    expect(s.history.at(-1)!.status).toBe("cancel");
    expect(s.open[K]!.side).toBe("sell");
  });
});

describe("paperStats — cancelados NÃO contam", () => {
  it("win rate só sobre decisivos (tp1/stop); cancel fica de fora", () => {
    const history = [
      { status: "tp1", r: 2, pnlPct: 10 },
      { status: "stop", r: -1, pnlPct: -5 },
      { status: "cancel", r: 0.001, pnlPct: 0.01 }, // NÃO pode virar "acerto"
    ] as never[];
    const st = paperStats(history);
    expect(st.closed).toBe(2);   // só decisivos
    expect(st.wins).toBe(1);
    expect(st.losses).toBe(1);
    expect(st.winRate).toBeCloseTo(50, 1);
    expect(st.totalR).toBeCloseTo(1, 1); // 2 - 1 (cancel não soma)
  });

  it("um único cancel → 0 fechados, 0% (não 100%)", () => {
    const st = paperStats([{ status: "cancel", r: 0.001, pnlPct: 0.01 }] as never[]);
    expect(st.closed).toBe(0);
    expect(st.wins).toBe(0);
    expect(st.winRate).toBe(0);
  });
});

describe("normalizePaperState", () => {
  it("migra formato antigo (open = 1 trade) p/ mapa", () => {
    const old = { open: { symbol: "BTCUSDT", timeframe: "4h", side: "buy", entry: 100, stop: 95, tp1: 110, openedAt: 1, status: "open", id: "x" }, history: [] };
    const s = normalizePaperState(old);
    expect(s.open[K]).toBeTruthy();
  });
  it("mantém formato novo (mapa) e trata vazio", () => {
    expect(normalizePaperState({ open: {}, history: [] }).open).toEqual({});
    expect(normalizePaperState(null)).toEqual({ open: {}, history: [] });
  });
});

describe("livePnl", () => {
  it("calcula P&L e R", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const lp = livePnl(s.open[K]!, 105);
    expect(lp.pnlPct).toBeCloseTo(5, 1);
    expect(lp.r).toBeCloseTo(1, 1);
  });
});
