import { describe, it, expect } from "vitest";
import { stepPaperTrading, paperStats, paperLiveState, livePnl, keyOf, normalizePaperState, EMPTY_PAPER_STATE, type PaperState, type PaperSetup, type PaperTrade } from "./paper-trading";

// risco 5 (entry 100, stop 95); alvos 110/120/130 → R por alvo 2/4/6.
const BUY: PaperSetup = { side: "buy", entry: 100, stop: 95, tp1: 110, tp2: 120, tp3: 130 };
const ctx = { symbol: "BTCUSDT", timeframe: "4h" };
const K = keyOf("BTCUSDT", "4h");

describe("stepPaperTrading (multi-open + gestão em terços)", () => {
  it("abre um trade por contexto", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    expect(s.open[K]).toBeTruthy();
    expect(s.open[K]!.side).toBe("buy");
  });

  it("trocar de ativo/TF NÃO cancela o trade aberto do outro contexto", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: { side: "sell", entry: 50, stop: 53, tp1: 44, tp2: 38, tp3: 32 }, price: 50, now: 2, symbol: "ETHUSDT", timeframe: "1h" });
    expect(s.open[K]).toBeTruthy();
    expect(s.open[keyOf("ETHUSDT", "1h")]).toBeTruthy();
    expect(s.history).toHaveLength(0); // nada cancelado
  });

  it("TP1 sozinho NÃO fecha — realiza 1/3 e segue com stop no breakeven", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 111, now: 2, ...ctx }); // tocou TP1
    expect(s.open[K]).toBeTruthy();          // continua aberta
    expect(s.history).toHaveLength(0);
    const lc = paperLiveState(s.open[K]!, [], 111);
    expect(lc.tp1Hit).toBe(true);
    expect(lc.stopStage).toBe("breakeven");
    expect(lc.currentStop).toBeCloseTo(100, 5); // stop subiu pra entrada
  });

  it("TP1 e VOLTA ao breakeven → fecha como tp1 (zera o restante a zero), R≈+0,67", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 99, now: 5000, ...ctx, candles: [
      { time: 2000, high: 111, low: 108 }, // bate TP1 → stop pro breakeven
      { time: 3000, high: 112, low: 99 },  // volta e toca o breakeven (100)
    ] });
    expect(s.open[K]).toBeUndefined();
    expect(s.history.at(-1)!.status).toBe("tp1");
    expect(s.history.at(-1)!.r).toBeCloseTo(0.667, 2); // 1/3*2 + 2/3*0
    expect(s.history.at(-1)!.closedAt).toBe(3000);
  });

  it("TP1 → TP2 → recua ao stop em TP1 → fecha como tp2", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 109, now: 5000, ...ctx, candles: [
      { time: 2000, high: 111, low: 108 }, // TP1
      { time: 3000, high: 121, low: 112 }, // TP2 → stop sobe pra TP1 (110)
      { time: 4000, high: 113, low: 108 }, // recua e toca 110
    ] });
    expect(s.history.at(-1)!.status).toBe("tp2");
    expect(s.history.at(-1)!.r).toBeCloseTo(2.667, 2); // 1/3*2 + 1/3*4 + 1/3*2
  });

  it("vela que estoura tudo → tp3 (R≈+4)", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 131, now: 5000, ...ctx, candles: [{ time: 2000, high: 135, low: 101 }] });
    expect(s.history.at(-1)!.status).toBe("tp3");
    expect(s.history.at(-1)!.r).toBeCloseTo(4, 2); // (2+4+6)/3
  });

  it("liquida RETROATIVO por candles ao voltar (stop antes de qualquer TP)", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 99, now: 5000, ...ctx, candles: [{ time: 2000, high: 101, low: 94 }] });
    expect(s.open[K]).toBeUndefined();
    expect(s.history.at(-1)!.status).toBe("stop");
    expect(s.history.at(-1)!.r).toBeCloseTo(-1, 2);
    expect(s.history.at(-1)!.closedAt).toBe(2000);
  });

  it("vela que toca TP e Stop juntos conta STOP (conservador)", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1000, ...ctx });
    s = stepPaperTrading(s, { setup: null, price: 100, now: 5000, ...ctx, candles: [{ time: 2000, high: 111, low: 94 }] });
    expect(s.history.at(-1)!.status).toBe("stop");
  });

  it("flip de lado no mesmo contexto cancela e abre o novo", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const SELL: PaperSetup = { side: "sell", entry: 102, stop: 107, tp1: 92, tp2: 82, tp3: 72 };
    s = stepPaperTrading(s, { setup: SELL, price: 102, now: 2, ...ctx });
    expect(s.history.at(-1)!.status).toBe("cancel");
    expect(s.open[K]!.side).toBe("sell");
  });
});

describe("paperLiveState — estado vivo da gestão", () => {
  it("após TP1 (ainda aberta): 1/3 travado, stop no breakeven, R aberto no restante", () => {
    const t: PaperTrade = { id: "x", ...ctx, side: "buy", entry: 100, stop: 95, tp1: 110, tp2: 120, tp3: 130, openedAt: 1000, status: "open" };
    const lc = paperLiveState(t, [{ time: 2000, high: 111, low: 108 }], 112);
    expect(lc.tp1Hit).toBe(true);
    expect(lc.tp2Hit).toBe(false);
    expect(lc.stopStage).toBe("breakeven");
    expect(lc.currentStop).toBeCloseTo(100, 5);
    expect(lc.realizedR).toBeCloseTo(0.667, 2);
    expect(lc.resolved).toBe(false);
    expect(lc.totalR).toBeGreaterThan(lc.realizedR); // soma o aberto do 2/3
  });
});

describe("paperStats — cancelados NÃO contam; tp1/tp2/tp3 são acertos", () => {
  it("win rate só sobre decisivos; cancel fica de fora", () => {
    const history = [
      { status: "tp2", r: 2.6, pnlPct: 13 },
      { status: "stop", r: -1, pnlPct: -5 },
      { status: "cancel", r: 0.001, pnlPct: 0.01 }, // NÃO pode virar "acerto"
    ] as never[];
    const st = paperStats(history);
    expect(st.closed).toBe(2);
    expect(st.wins).toBe(1);
    expect(st.losses).toBe(1);
    expect(st.winRate).toBeCloseTo(50, 1);
    expect(st.totalR).toBeCloseTo(1.6, 2);
  });

  it("um único cancel → 0 fechados, 0% (não 100%)", () => {
    const st = paperStats([{ status: "cancel", r: 0.001, pnlPct: 0.01 }] as never[]);
    expect(st.closed).toBe(0);
    expect(st.wins).toBe(0);
    expect(st.winRate).toBe(0);
  });
});

describe("normalizePaperState", () => {
  it("migra formato antigo (open = 1 trade, sem tp2/tp3) p/ mapa + alvos preenchidos", () => {
    const old = { open: { symbol: "BTCUSDT", timeframe: "4h", side: "buy", entry: 100, stop: 95, tp1: 110, openedAt: 1, status: "open", id: "x" }, history: [] };
    const s = normalizePaperState(old);
    expect(s.open[K]).toBeTruthy();
    expect(s.open[K]!.tp2).toBe(110); // colapsa pro alvo único
    expect(s.open[K]!.tp3).toBe(110);
  });
  it("mantém formato novo (mapa) e trata vazio", () => {
    expect(normalizePaperState({ open: {}, history: [] }).open).toEqual({});
    expect(normalizePaperState(null)).toEqual({ open: {}, history: [] });
  });
});

describe("livePnl", () => {
  it("calcula P&L e R (posição cheia)", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const lp = livePnl(s.open[K]!, 105);
    expect(lp.pnlPct).toBeCloseTo(5, 1);
    expect(lp.r).toBeCloseTo(1, 1);
  });
});
