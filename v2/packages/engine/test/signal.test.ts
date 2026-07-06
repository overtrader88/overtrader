import { describe, expect, it } from "vitest";
import { ratioToSignal } from "../src/signal/levels";
import { computeSignal } from "../src/signal/aggregate";
import { buildIndicatorResults } from "../src/signal/votes";
import { computeIndicatorValues } from "../src/indicators";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import { signalSide } from "@tradeai/shared";
import { upTrendCandles, downTrendCandles } from "./fixtures/candles";

describe("ratioToSignal — fronteiras", () => {
  it("mapeia os extremos e o centro", () => {
    expect(ratioToSignal(0.1)).toBe("STRONG_SELL");
    expect(ratioToSignal(0.3)).toBe("SELL");
    expect(ratioToSignal(0.4)).toBe("WEAK_SELL");
    expect(ratioToSignal(0.5)).toBe("NEUTRAL");
    expect(ratioToSignal(0.6)).toBe("WEAK_BUY");
    expect(ratioToSignal(0.75)).toBe("BUY");
    expect(ratioToSignal(0.95)).toBe("STRONG_BUY");
  });

  it("é monótono: ratio maior nunca dá sinal mais vendedor", () => {
    const order = ["STRONG_SELL", "SELL", "WEAK_SELL", "NEUTRAL", "WEAK_BUY", "BUY", "STRONG_BUY"];
    let prev = -1;
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const idx = order.indexOf(ratioToSignal(Math.min(1, r)));
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});

describe("computeSignal — através do caminho real", () => {
  it("uptrend forte vota majoritariamente COMPRA", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(upTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.votes.buy).toBeGreaterThan(sig.votes.sell);
    expect(signalSide(sig.signal)).toBe("buy");
  });

  it("downtrend forte vota majoritariamente VENDA", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(downTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.votes.sell).toBeGreaterThan(sig.votes.buy);
    expect(signalSide(sig.signal)).toBe("sell");
  });

  it("força fica em 0..100 e confluência em 0..10", () => {
    const ind = buildIndicatorResults(computeIndicatorValues(upTrendCandles(250)), DEFAULT_ENGINE_CONFIG);
    const sig = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    expect(sig.strength).toBeGreaterThanOrEqual(0);
    expect(sig.strength).toBeLessThanOrEqual(100);
    expect(sig.confluence).toBeGreaterThanOrEqual(0);
    expect(sig.confluence).toBeLessThanOrEqual(10);
  });
});

describe("regimeAwareVotes — experimento gateado (achado 1, Pacote C)", () => {
  const values = computeIndicatorValues(upTrendCandles(250));

  it("com flag OFF (default), passar o regime NÃO muda nenhum voto", () => {
    const base = buildIndicatorResults(values, DEFAULT_ENGINE_CONFIG);
    const withRegime = buildIndicatorResults(values, DEFAULT_ENGINE_CONFIG, "ranging");
    expect(withRegime).toEqual(base);
  });

  it("com flag ON em RANGING, RSI/CCI/MFI viram fade (uptrend: BUY momentum → SELL/NEUTRAL fade)", () => {
    const cfg = structuredClone(DEFAULT_ENGINE_CONFIG);
    cfg.signal.regimeAwareVotes = true;
    const base = buildIndicatorResults(values, DEFAULT_ENGINE_CONFIG, "ranging");
    const fade = buildIndicatorResults(values, cfg, "ranging");
    const voteOf = (list: typeof base, name: string) => list.find((i) => i.name === name)?.vote;
    // No uptrend sintético o RSI está alto (>65) → fade vota SELL onde momentum votava BUY.
    const rsiBase = voteOf(base, "RSI (14)");
    const rsiFade = voteOf(fade, "RSI (14)");
    expect(rsiBase).toBe("BUY");
    expect(rsiFade === "SELL" || rsiFade === "NEUTRAL").toBe(true);
    // Fora de ranging, flag ON não muda nada (fade só em ranging).
    expect(buildIndicatorResults(values, cfg, "trending")).toEqual(buildIndicatorResults(values, DEFAULT_ENGINE_CONFIG, "trending"));
    // Demais indicadores intocados na mesma chamada.
    expect(voteOf(fade, "EMA (20)")).toBe(voteOf(base, "EMA (20)"));
    expect(voteOf(fade, "MACD (12,26,9)")).toBe(voteOf(base, "MACD (12,26,9)"));
  });

  it("regimeAwareTrendClass ON em TRENDING repondera RSI/Stoch/CCI/MFI como trend (ratio muda, votos não)", () => {
    const cfg = structuredClone(DEFAULT_ENGINE_CONFIG);
    cfg.signal.regimeAwareTrendClass = true;
    const ind = buildIndicatorResults(values, DEFAULT_ENGINE_CONFIG, "trending");
    const off = computeSignal(ind, DEFAULT_ENGINE_CONFIG, "trending");
    const on = computeSignal(ind, cfg, "trending");
    // Mesmos votos crus (a reclassificação afeta só o PESO)...
    expect(on.votes).toEqual(off.votes);
    // ...e em uptrend (osciladores BUY alinhados) o peso deles sobe (0.5→1.3) → força não diminui.
    expect(on.strength).toBeGreaterThanOrEqual(off.strength);
    // Em ranging o flag não atua.
    expect(computeSignal(ind, cfg, "ranging")).toEqual(computeSignal(ind, DEFAULT_ENGINE_CONFIG, "ranging"));
  });
});
