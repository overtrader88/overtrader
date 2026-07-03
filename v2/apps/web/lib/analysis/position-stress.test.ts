import { describe, it, expect } from "vitest";
import { NAMES } from "@tradeai/engine";
import {
  verdictFor, llmDirection, invertDirection, isPositionSide,
  computePositionRisk, conditionalDirection, consensusDirection,
  buildOpinion, llmOpinion, tallyVerdicts,
} from "./position-stress";
import type { FullAnalysis } from "./full";
import type { ClassReading } from "./engines";

const dto = (p: unknown) => p as FullAnalysis;
const reading = (p: unknown) => p as ClassReading;

describe("verdictFor (tradução leitura → veredito sobre a posição)", () => {
  it("comprado: lado oposto SAI, neutro/mesmo lado SEGURA, mesmo lado forte AUMENTA", () => {
    expect(verdictFor("SELL", "long")).toBe("sairia");
    expect(verdictFor("STRONG_SELL", "long")).toBe("sairia");
    expect(verdictFor("NEUTRAL", "long")).toBe("seguraria");
    expect(verdictFor("WEAK_BUY", "long")).toBe("seguraria");
    expect(verdictFor("BUY", "long")).toBe("seguraria");
    expect(verdictFor("STRONG_BUY", "long")).toBe("aumentaria");
  });

  it("vendido: espelhado", () => {
    expect(verdictFor("BUY", "short")).toBe("sairia");
    expect(verdictFor("NEUTRAL", "short")).toBe("seguraria");
    expect(verdictFor("SELL", "short")).toBe("seguraria");
    expect(verdictFor("STRONG_SELL", "short")).toBe("aumentaria");
  });
});

describe("llmDirection (mesmo corte do emissor: ≥80 = STRONG)", () => {
  it("mapeia lado + convicção", () => {
    expect(llmDirection({ side: "buy", conviction: 85, rationale: "" })).toBe("STRONG_BUY");
    expect(llmDirection({ side: "buy", conviction: 65, rationale: "" })).toBe("BUY");
    expect(llmDirection({ side: "sell", conviction: 80, rationale: "" })).toBe("STRONG_SELL");
    expect(llmDirection({ side: "sell", conviction: 40, rationale: "" })).toBe("SELL");
    expect(llmDirection({ side: "neutral", conviction: 90, rationale: "" })).toBe("NEUTRAL");
  });
});

describe("invertDirection (motor contrário)", () => {
  it("espelha e é involutiva", () => {
    expect(invertDirection("STRONG_BUY")).toBe("STRONG_SELL");
    expect(invertDirection("WEAK_SELL")).toBe("WEAK_BUY");
    expect(invertDirection("NEUTRAL")).toBe("NEUTRAL");
    expect(invertDirection(invertDirection("BUY"))).toBe("BUY");
  });
});

describe("computePositionRisk (R não-realizado + stop da casa)", () => {
  const base = dto({ analysis: { risk: { entry: 110, distSL: 5 } } }); // preço atual 110, stop da casa a 5

  it("comprado no lucro: R positivo, stop abaixo do preço atual", () => {
    const r = computePositionRisk(base, "long", 100)!;
    expect(r.current).toBe(110);
    expect(r.unrealizedR).toBeCloseTo(2); // (110-100)/5
    expect(r.unrealizedPct).toBeCloseTo(10);
    expect(r.houseStop).toBe(105); // tese morre abaixo
    expect(r.stopDistPct).toBeCloseTo((5 / 110) * 100);
  });

  it("vendido contra: R negativo, stop acima do preço atual", () => {
    const r = computePositionRisk(base, "short", 100)!;
    expect(r.unrealizedR).toBeCloseTo(-2); // subiu 10 contra o short
    expect(r.unrealizedPct).toBeCloseTo(-10);
    expect(r.houseStop).toBe(115); // tese morre acima
  });

  it("sem distSL: PnL% sai, R e stop ficam nulos", () => {
    const r = computePositionRisk(dto({ analysis: { risk: { entry: 110, distSL: 0 } } }), "long", 100)!;
    expect(r.unrealizedPct).toBeCloseTo(10);
    expect(r.unrealizedR).toBeNull();
    expect(r.houseStop).toBeNull();
  });

  it("entrada inválida ou dto sem preço → null", () => {
    expect(computePositionRisk(base, "long", 0)).toBeNull();
    expect(computePositionRisk(dto({ analysis: { risk: { entry: 0, distSL: 5 } } }), "long", 100)).toBeNull();
  });
});

describe("conditionalDirection (decisão sem emitir)", () => {
  it("dto sem os valores canônicos → null", () => {
    expect(conditionalDirection(dto({ analysis: { indicators: [], risk: { entry: 100 }, meta: {} } }))).toBeNull();
  });

  it("dto com valores completos → devolve uma direção válida", () => {
    const inds = [
      { name: NAMES.macd, category: "Tendência", vote: "BUY", value: { macdLine: 1, signal: 0.5, histogram: 0.5 } },
      { name: NAMES.stoch, category: "Osciladores", vote: "BUY", value: { k: 55, d: 50 } },
      { name: NAMES.adx, category: "Tendência", vote: "BUY", value: { adx: 30, plusDI: 25, minusDI: 15 } },
      { name: NAMES.bollinger, category: "Volatilidade", vote: "NEUTRAL", value: { upper: 110, middle: 100, lower: 90, bandwidth: 0.2 } },
      { name: NAMES.obv, category: "Volume", vote: "BUY", value: { current: 1000, slope: 1 } },
      { name: NAMES.ema20, category: "Médias Móveis", vote: "BUY", value: 101 },
      { name: NAMES.ema50, category: "Médias Móveis", vote: "BUY", value: 99 },
      { name: NAMES.ema200, category: "Médias Móveis", vote: "BUY", value: 95 },
      { name: NAMES.sma50, category: "Médias Móveis", vote: "BUY", value: 99 },
      { name: NAMES.vwma20, category: "Médias Móveis", vote: "BUY", value: 100 },
      { name: NAMES.rsi, category: "Osciladores", vote: "BUY", value: 58 },
      { name: NAMES.cci, category: "Osciladores", vote: "BUY", value: 80 },
      { name: NAMES.williamsR, category: "Osciladores", vote: "BUY", value: -30 },
      { name: NAMES.awesome, category: "Osciladores", vote: "BUY", value: 1 },
      { name: NAMES.mfi, category: "Volume", vote: "BUY", value: 60 },
      { name: NAMES.roc, category: "Osciladores", vote: "BUY", value: 2 },
      { name: NAMES.trix, category: "Tendência", vote: "BUY", value: 0.5 },
      { name: NAMES.atr, category: "Volatilidade", vote: "NEUTRAL", value: 3 },
      { name: NAMES.cmf, category: "Volume", vote: "BUY", value: 0.2 },
    ];
    const d = dto({ analysis: { indicators: inds, risk: { entry: 102, distSL: 3 }, meta: { regime: "trending" } } });
    const dir = conditionalDirection(d);
    expect(dir).not.toBeNull();
    expect(["STRONG_BUY", "BUY", "WEAK_BUY", "NEUTRAL", "WEAK_SELL", "SELL", "STRONG_SELL"]).toContain(dir);
  });
});

describe("consensusDirection (interseção dos dois motores)", () => {
  const d = dto({ analysis: { signal: { signal: "BUY" } } });

  it("os dois no mesmo lado com convicção → direção do Motor 1", () => {
    expect(consensusDirection(d, reading({ side: "buy", score: 70 }))).toBe("BUY");
  });

  it("classe do outro lado, sem convicção ou Motor 1 neutro → NEUTRAL", () => {
    expect(consensusDirection(d, reading({ side: "sell", score: 30 }))).toBe("NEUTRAL");
    expect(consensusDirection(d, reading({ side: "buy", score: 60 }))).toBe("NEUTRAL"); // |60-50| < 15
    expect(consensusDirection(dto({ analysis: { signal: { signal: "NEUTRAL" } } }), reading({ side: "buy", score: 80 }))).toBe("NEUTRAL");
  });
});

describe("mesa de motores (opiniões + placar)", () => {
  it("buildOpinion traduz a direção; llmOpinion null → indisponível", () => {
    const o = buildOpinion("padrao", "Padrão", "deterministico", "STRONG_SELL", "short");
    expect(o.verdict).toBe("aumentaria");
    const un = llmOpinion("llm", "LLM·GPT", null, "long");
    expect(un.direction).toBeNull();
    expect(un.verdict).toBeNull();
    const ok = llmOpinion("llm", "LLM·GPT", { side: "sell", conviction: 66, rationale: "r" }, "long");
    expect(ok.verdict).toBe("sairia");
    expect(ok.conviction).toBe(66);
  });

  it("tallyVerdicts conta vereditos e indisponíveis", () => {
    const t = tallyVerdicts([
      buildOpinion("a", "A", "deterministico", "STRONG_BUY", "long"),
      buildOpinion("b", "B", "deterministico", "NEUTRAL", "long"),
      buildOpinion("c", "C", "deterministico", "SELL", "long"),
      llmOpinion("d", "D", null, "long"),
    ]);
    expect(t).toEqual({ aumentaria: 1, seguraria: 1, sairia: 1, read: 3, unavailable: 1 });
  });

  it("isPositionSide valida o parâmetro da URL", () => {
    expect(isPositionSide("long")).toBe(true);
    expect(isPositionSide("comprado")).toBe(false);
  });
});
