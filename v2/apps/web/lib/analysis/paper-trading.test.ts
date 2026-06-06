import { describe, it, expect } from "vitest";
import { stepPaperTrading, paperStats, livePnl, EMPTY_PAPER_STATE, type PaperState, type PaperSetup } from "./paper-trading";

const BUY: PaperSetup = { side: "buy", entry: 100, stop: 95, tp1: 110 };
const ctx = { symbol: "BTCUSDT", timeframe: "4h" };

describe("stepPaperTrading", () => {
  it("abre um trade quando surge setup e não há aberto", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    expect(s.open).toBeTruthy();
    expect(s.open!.side).toBe("buy");
    expect(s.open!.entry).toBe(100);
    expect(s.history).toHaveLength(0);
  });

  it("fecha em TP1 (ganho) e registra +R no histórico", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 110, now: 2, ...ctx }); // bate TP1
    expect(s.open).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.status).toBe("tp1");
    expect(s.history[0]!.r).toBeCloseTo(2, 1); // (110-100)/(100-95) = 2R
    expect(s.history[0]!.pnlPct).toBeCloseTo(10, 1);
  });

  it("fecha em Stop (perda) e registra R negativo", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 95, now: 2, ...ctx }); // bate Stop
    expect(s.open).toBeNull();
    expect(s.history[0]!.status).toBe("stop");
    expect(s.history[0]!.r).toBeCloseTo(-1, 1);
  });

  it("não reabre o mesmo setup logo após fechar", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 110, now: 2, ...ctx }); // fecha tp1
    s = stepPaperTrading(s, { setup: BUY, price: 108, now: 3, ...ctx }); // mesmo setup → não reabre
    expect(s.open).toBeNull();
    expect(s.history).toHaveLength(1);
  });

  it("flip de lado cancela o aberto e abre o novo", () => {
    let s: PaperState = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const SELL: PaperSetup = { side: "sell", entry: 102, stop: 107, tp1: 92 };
    s = stepPaperTrading(s, { setup: SELL, price: 102, now: 2, ...ctx });
    expect(s.history).toHaveLength(1);
    expect(s.history[0]!.status).toBe("cancel");
    expect(s.open!.side).toBe("sell");
  });

  it("livePnl calcula P&L e R contra o preço corrente", () => {
    const s = stepPaperTrading(EMPTY_PAPER_STATE, { setup: BUY, price: 100, now: 1, ...ctx });
    const lp = livePnl(s.open!, 105);
    expect(lp.pnlPct).toBeCloseTo(5, 1);
    expect(lp.r).toBeCloseTo(1, 1);
  });
});

describe("paperStats", () => {
  it("agrega win-rate, total R e médias", () => {
    let s: PaperState = EMPTY_PAPER_STATE;
    // trade 1: ganho +2R
    s = stepPaperTrading(s, { setup: BUY, price: 100, now: 1, ...ctx });
    s = stepPaperTrading(s, { setup: BUY, price: 110, now: 2, ...ctx });
    // trade 2: perda -1R (entry diferente p/ não ser "mesmo setup")
    const BUY2: PaperSetup = { side: "buy", entry: 200, stop: 190, tp1: 230 };
    s = stepPaperTrading(s, { setup: BUY2, price: 200, now: 3, ...ctx });
    s = stepPaperTrading(s, { setup: BUY2, price: 190, now: 4, ...ctx });
    const st = paperStats(s.history);
    expect(st.closed).toBe(2);
    expect(st.wins).toBe(1);
    expect(st.losses).toBe(1);
    expect(st.winRate).toBeCloseTo(50, 1);
    expect(st.totalR).toBeCloseTo(1, 1); // +2 -1
  });
});
