import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WAR_COUNCIL_MAX_TURNS, WAR_COUNCIL_SYSTEM, capWarCouncilHistory, generateWarCouncilAnswer, toWarCouncilFacts,
  type WarCouncilTurn,
} from "./war-council";
import type { FullAnalysis } from "./full";

/** DTO mínimo com os campos que os extratores de fatos acessam sem optional chaining. */
function base(): FullAnalysis {
  return {
    generatedAt: 1750000000000,
    type: "complete",
    period: "jan/24–jun/26",
    analysis: {
      signal: { signal: "BUY", strength: 80, confluence: 8, votes: { buy: 8, neutral: 2, sell: 0 } },
      risk: { entry: 100, stopLoss: 95, takeProfit1: 110, takeProfit2: 120, takeProfit3: 130, distSL: 5, rr1: 2 },
      explanation: { summary: "" },
      indicators: [{ name: "RSI (14)", category: "momentum", vote: "BUY", value: 62 }],
      meta: { asset: "BTCUSDT", assetType: "crypto", timeframe: "4h", regime: "trending", adxValue: 30 },
    },
    quality: { status: "green", reason: "ok" },
    backtest: {
      decisiveTrades: 120,
      sampleSufficient: true,
      winRate: { value: 0.55, ci95: [0.5, 0.6], n: 120 },
      profitFactor: { value: 1.8, ci95: [1.5, 2.1], n: 120 },
    },
    volumeProfile: { poc: 99, vah: 105, val: 94 },
    smc: { bias: "bullish", marketStructure: "bullish_bos", orderBlocks: [], liquidityZones: [], fvgs: [] },
  } as unknown as FullAnalysis;
}

describe("toWarCouncilFacts", () => {
  it("compõe resumo + decisão + níveis a partir do DTO", () => {
    const f = toWarCouncilFacts(base()) as {
      resumo: { symbol: string; seal?: { status: string } };
      decisao: { ativo: string; preco_atual: number | null; dados_classe: { dxy: unknown } };
      niveis: { volume: { perfil: { poc: number } | null } };
      gerada_em: string;
      periodo_dados: string | null;
    };
    expect(f.resumo.symbol).toBe("BTCUSDT");
    expect(f.resumo.seal?.status).toBe("green");
    expect(f.decisao.ativo).toBe("BTCUSDT");
    expect(f.decisao.preco_atual).toBe(100);
    expect(f.niveis.volume.perfil?.poc).toBe(99);
    expect(f.gerada_em).toBe(new Date(1750000000000).toISOString());
    expect(f.periodo_dados).toBe("jan/24–jun/26");
  });

  it("dados de classe ficam null (o snapshot não tem extras vivos)", () => {
    const f = toWarCouncilFacts(base()) as { decisao: { dados_classe: Record<string, unknown> } };
    expect(f.decisao.dados_classe.dxy).toBeNull();
    expect(f.decisao.dados_classe.cot).toBeNull();
  });
});

describe("capWarCouncilHistory", () => {
  it("capa nos últimos ~10 turnos (20 mensagens), preservando as mais recentes", () => {
    const history: WarCouncilTurn[] = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `msg ${i}`,
    }));
    const capped = capWarCouncilHistory(history);
    expect(capped).toHaveLength(WAR_COUNCIL_MAX_TURNS * 2);
    expect(capped[0]?.content).toBe("msg 10");
    expect(capped.at(-1)?.content).toBe("msg 29");
  });

  it("histórico curto passa intacto", () => {
    const history: WarCouncilTurn[] = [{ role: "user", content: "oi" }];
    expect(capWarCouncilHistory(history)).toEqual(history);
  });
});

describe("WAR_COUNCIL_SYSTEM", () => {
  it("trava a resposta nos dados e manda admitir o que não tem (honestidade = marca)", () => {
    expect(WAR_COUNCIL_SYSTEM).toContain("APENAS com base nos dados fornecidos");
    expect(WAR_COUNCIL_SYSTEM).toContain("não tem esse dado");
    expect(WAR_COUNCIL_SYSTEM).toContain("não recomendação de investimento");
  });
});

describe("generateWarCouncilAnswer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("retorna null sem OPENAI_API_KEY (degrada gracioso, sem chamada de rede)", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(generateWarCouncilAnswer(base(), "Por que o selo é verde?", [])).resolves.toBeNull();
  });
});
