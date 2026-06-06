import { describe, it, expect } from "vitest";
import { buildLiveNarration } from "./live-narration";
import type { NarrativeFacts } from "./narrative-facts";

const base: NarrativeFacts = {
  symbol: "BTCUSDT", timeframe: "4h", assetType: "crypto",
  regime: "tendência", adx: 27.3,
  signal: "BUY", strengthPct: 62, confluence: 4,
  votes: { buy: 6, sell: 1, neutral: 2 },
  entry: 64200, stopLoss: 62800, takeProfit1: 67500, rr1: 2.1,
  seal: { status: "yellow", reason: "out-of-sample fraco" },
  backtest: { decisiveTrades: 142, sufficient: true, pf: 1.4, pfCi: [1.1, 1.8], winRatePct: 54.2, period: "jan/24–mai/26" },
};

describe("buildLiveNarration", () => {
  it("monta headline, bullets e fala grounded para um sinal de compra", () => {
    const n = buildLiveNarration(base);
    expect(n.side).toBe("buy");
    expect(n.headline).toContain("BTCUSDT");
    expect(n.headline).toContain("COMPRA");
    expect(n.speech).toContain("142"); // cita n
    expect(n.speech).toContain("64200"); // cita entrada
    expect(n.speech).toMatch(/análise, não recomendação/i);
    expect(n.bullets.some((b) => b.includes("profit factor") && b.includes("IC 95%"))).toBe(true);
  });

  it("avisa quando a amostra é insuficiente", () => {
    const n = buildLiveNarration({ ...base, backtest: { ...base.backtest!, decisiveTrades: 12, sufficient: false } });
    expect(n.speech).toMatch(/insuficiente/i);
  });

  it("neutro → sem plano operacional", () => {
    const n = buildLiveNarration({ ...base, signal: "NEUTRAL" });
    expect(n.side).toBe("neutral");
    expect(n.speech).toMatch(/aguardar/i);
  });

  it("key muda quando o sinal muda (dispara nova fala)", () => {
    const a = buildLiveNarration(base);
    const b = buildLiveNarration({ ...base, signal: "STRONG_BUY" });
    expect(a.key).not.toBe(b.key);
  });

  it("key estável quando nada relevante muda", () => {
    const a = buildLiveNarration(base);
    const b = buildLiveNarration({ ...base, strengthPct: 63 }); // força muda, mas não a key
    expect(a.key).toBe(b.key);
  });
});
