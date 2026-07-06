import { describe, expect, it } from "vitest";
import { buildVsfPlan } from "./emit";
import type { FullAnalysis } from "@/lib/analysis/full";

/**
 * buildVsfPlan — âncora no nivel_referencia com VALIDAÇÃO DURA (era ~c1,
 * achado 17b): o campo novo NUNCA derruba um sinal; inválido → comportamento
 * anterior (nível válido mais próximo, ~lvl2).
 *
 * Cenário: entry=100, ATR=2 (buffer=0.5; guarda-corpo [1.2, 5.0] em preço):
 *   - VAL 99          → stop 98.5 (0.75 ATR)  VÁLIDO (mais próximo)
 *   - OB bullish 96   → stop 95.5 (2.25 ATR)  VÁLIDO (mais fundo)
 *   - liquidez 99.7   → stop 99.2 (0.40 ATR)  REJEITADA pelo guarda-corpo
 */
function dto(): FullAnalysis {
  return {
    generatedAt: 0,
    type: "complete",
    period: null,
    analysis: {
      signal: { signal: "BUY", strength: 60, confluence: 7, votes: { buy: 8, sell: 2, neutral: 10 } },
      risk: { entry: 100, stopLoss: 97.6, takeProfit1: 103.6, takeProfit2: 106, takeProfit3: 109, distSL: 2.4, rr1: 1.5 },
      explanation: { summary: "" },
      indicators: [],
      meta: { asset: "BTCUSDT", assetType: "crypto", timeframe: "4h", regime: "trending", adxValue: 30 },
    },
    atr: 2,
    volumeProfile: { poc: 100.5, vah: 103, val: 99 },
    smc: {
      bias: "bullish", marketStructure: "bullish_bos",
      orderBlocks: [{ type: "bullish", zoneTop: 97, zoneBottom: 96 }],
      liquidityZones: [{ type: "sell_stops_below", level: 99.7, swept: false }],
      fvgs: [],
    },
  } as unknown as FullAnalysis;
}

describe("buildVsfPlan — nivel_referencia (era ~c1)", () => {
  it("sem refLevel escolhe o nível VÁLIDO mais próximo (não ancorado, ~lvl2)", () => {
    const r = buildVsfPlan(dto(), "buy");
    expect(r.plan).not.toBeNull();
    expect(r.plan!.stopLoss).toBeCloseTo(98.5, 10); // VAL 99 − buffer 0.5
    expect(r.reject).toBeNull();
    if (r.reject === null) expect(r.anchored).toBe(false);
  });

  it("refLevel casando com nível válido (±0.05 ATR) ancora o stop nele (~lvl3)", () => {
    const r = buildVsfPlan(dto(), "buy", 96.05); // tolerância 0.1 → casa com o OB 96
    expect(r.plan).not.toBeNull();
    expect(r.plan!.stopLoss).toBeCloseTo(95.5, 10); // OB 96 − buffer 0.5
    if (r.reject === null) expect(r.anchored).toBe(true);
  });

  it("refLevel de nível REJEITADO pelo guarda-corpo NÃO ancora — cai no válido mais próximo", () => {
    const r = buildVsfPlan(dto(), "buy", 99.7); // liquidez a 0.4 ATR: fora do guarda-corpo
    expect(r.plan).not.toBeNull();
    expect(r.plan!.stopLoss).toBeCloseTo(98.5, 10);
    if (r.reject === null) expect(r.anchored).toBe(false);
  });

  it("refLevel inventado (não enviado nos fatos) NÃO ancora nem derruba o sinal", () => {
    const r = buildVsfPlan(dto(), "buy", 150);
    expect(r.plan).not.toBeNull();
    expect(r.plan!.stopLoss).toBeCloseTo(98.5, 10);
    if (r.reject === null) expect(r.anchored).toBe(false);
  });

  it("alvos preservam os RRs da casa a partir do stop ancorado", () => {
    const r = buildVsfPlan(dto(), "buy", 96);
    expect(r.plan).not.toBeNull();
    const dist = 100 - r.plan!.stopLoss; // 4.5
    expect(r.plan!.takeProfit1).toBeCloseTo(100 + (dist / 1.2) * 1.8, 10);
    expect(r.plan!.takeProfit3).toBeCloseTo(100 + (dist / 1.2) * 4.5, 10);
  });

  it("sem nível protegido devolve reject='nolvl' (fallback ATR instrumentado)", () => {
    const d = dto();
    (d as unknown as { smc: unknown; volumeProfile: unknown }).smc = undefined;
    (d as unknown as { smc: unknown; volumeProfile: unknown }).volumeProfile = undefined;
    const r = buildVsfPlan(d, "buy", 96);
    expect(r.plan).toBeNull();
    expect(r.reject).toBe("nolvl");
  });
});
