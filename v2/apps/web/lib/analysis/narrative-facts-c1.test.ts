import { describe, expect, it } from "vitest";
import { toDecisionFacts, toLevelsFacts } from "./narrative";
import type { FullAnalysis } from "./full";

/**
 * Fatos enriquecidos da era ~c1 (achados 14, 16 e 17a): escalares objetivos
 * (compressão + contexto de tempo derivado do ÚLTIMO CANDLE, nunca wall-clock),
 * restrições invariantes do plano (derivadas do config em runtime) e níveis
 * com dist_atr pré-computada + filtro opt-in >3 ATR (POC/VAH/VAL sempre ficam).
 */
function base(): FullAnalysis {
  return {
    generatedAt: 1750000000000,
    type: "complete",
    period: "jan/24–jun/26",
    analysis: {
      signal: { signal: "BUY", strength: 80, confluence: 8, votes: { buy: 8, neutral: 2, sell: 0 } },
      risk: { entry: 100, stopLoss: 95, takeProfit1: 110, takeProfit2: 120, takeProfit3: 130, distSL: 5, rr1: 2 },
      explanation: { summary: "" },
      indicators: [],
      meta: { asset: "BTCUSDT", assetType: "crypto", timeframe: "4h", regime: "trending", adxValue: 30 },
    },
    atr: 2,
    // quarta-feira, 18/06/2025 09:00 UTC (sessão de Londres)
    lastCandleTime: Date.UTC(2025, 5, 18, 9, 0, 0),
    compression20Atr: 3.456,
    volumeProfile: { poc: 100.5, vah: 103, val: 99 },
    smc: {
      bias: "bullish", marketStructure: "bullish_bos",
      orderBlocks: [
        { type: "bullish", zoneTop: 97, zoneBottom: 96 },   // mid 96.5 → −1.75 ATR (fica)
        { type: "bearish", zoneTop: 112, zoneBottom: 110 }, // mid 111  → +5.5 ATR (filtrado a ≤3)
      ],
      liquidityZones: [{ type: "sell_stops_below", level: 99.7, swept: false }],
      fvgs: [],
    },
  } as unknown as FullAnalysis;
}

interface DecisionFactsShape {
  compressao_range20_atr: number | null;
  contexto_tempo: { hora_utc: number; dia_semana: string; sessao: string } | null;
  plano_execucao: { stop_dist_atr?: number; tp1_rr: number; tp2_rr: number; tp3_rr: number; expira_em_candles: number; candle_horas: number | null };
}

describe("toDecisionFacts — era ~c1", () => {
  it("expõe compressão, contexto de tempo (do último candle) e plano_execucao derivado do config", () => {
    const f = toDecisionFacts(base(), "crypto", {}) as DecisionFactsShape;
    expect(f.compressao_range20_atr).toBe(3.46);
    expect(f.contexto_tempo).toEqual({ hora_utc: 9, dia_semana: "quarta", sessao: "Londres" });
    // Derivado em runtime: slMult 1.2 × LLM_ATR_SCALE 1.4 = 1.68; RRs 1.5/2.5/3.75.
    expect(f.plano_execucao.stop_dist_atr).toBe(1.68);
    expect(f.plano_execucao.tp1_rr).toBe(1.5);
    expect(f.plano_execucao.tp2_rr).toBe(2.5);
    expect(f.plano_execucao.tp3_rr).toBe(3.75);
    // Janela REAL do juiz (mesmo mapa do resolve-signals): 4h → 60 candles de 4h.
    expect(f.plano_execucao.expira_em_candles).toBe(60);
    expect(f.plano_execucao.candle_horas).toBe(4);
  });

  it("1d usa a janela de 25 candles do juiz (mapa por timeframe)", () => {
    const d = base();
    (d.analysis.meta as { timeframe: string }).timeframe = "1d";
    const f = toDecisionFacts(d, "crypto", {}) as DecisionFactsShape;
    expect(f.plano_execucao.expira_em_candles).toBe(25);
    expect(f.plano_execucao.candle_horas).toBe(24);
  });

  it("degrada gracioso: sem lastCandleTime/compressão os campos ficam null", () => {
    const d = base();
    delete (d as { lastCandleTime?: number }).lastCandleTime;
    delete (d as { compression20Atr?: number }).compression20Atr;
    const f = toDecisionFacts(d, "crypto", {}) as DecisionFactsShape;
    expect(f.compressao_range20_atr).toBeNull();
    expect(f.contexto_tempo).toBeNull();
  });
});

interface LevelsFactsShape {
  atr: number | null;
  volume: { perfil: { poc: number; dist_atr_poc: number | null; dist_atr_vah: number | null; dist_atr_val: number | null } | null };
  suporte_resistencia: { order_blocks: { topo: number; dist_atr: number | null }[]; zonas_liquidez: { nivel: number; dist_atr: number | null }[] } | null;
}

describe("toLevelsFacts — era ~c1 (dist_atr + filtro opt-in)", () => {
  it("pré-computa atr e dist_atr assinada em cada nível", () => {
    const f = toLevelsFacts(base()) as LevelsFactsShape;
    expect(f.atr).toBe(2);
    expect(f.volume.perfil?.dist_atr_poc).toBe(0.25);  // (100.5−100)/2
    expect(f.volume.perfil?.dist_atr_val).toBe(-0.5);  // (99−100)/2
    expect(f.suporte_resistencia?.zonas_liquidez[0]?.dist_atr).toBe(-0.15);
    // sem filtro: os 2 order blocks aparecem
    expect(f.suporte_resistencia?.order_blocks).toHaveLength(2);
  });

  it("filtro maxAtrDist=3 (família VSF) corta níveis distantes mas mantém POC/VAH/VAL", () => {
    const f = toLevelsFacts(base(), { maxAtrDist: 3 }) as LevelsFactsShape;
    // OB bearish a 5.5 ATR sai; o bullish a 1.75 ATR fica.
    expect(f.suporte_resistencia?.order_blocks).toHaveLength(1);
    expect(f.suporte_resistencia?.order_blocks[0]?.topo).toBe(97);
    // núcleo do pilar volume é SEMPRE mantido
    expect(f.volume.perfil?.poc).toBe(100.5);
  });

  it("sem ATR: dist_atr omitida (null) e nada é filtrado", () => {
    const d = base();
    delete (d as { atr?: number }).atr;
    (d.analysis.meta as { atrRatio?: number }).atrRatio = undefined;
    const f = toLevelsFacts(d, { maxAtrDist: 3 }) as LevelsFactsShape;
    expect(f.atr).toBeNull();
    expect(f.volume.perfil?.dist_atr_poc).toBeNull();
    expect(f.suporte_resistencia?.order_blocks).toHaveLength(2);
  });
});
