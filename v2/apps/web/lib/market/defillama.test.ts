import { describe, it, expect } from "vitest";
import {
  parseChainTvl,
  parseCurrentTvl,
  summarizeTvl,
  fetchFundamental,
  fundamentalConvergence,
  type FundamentalResult,
} from "./defillama";

// ~30d separam os dois pontos (segundos epoch); a borda converte p/ ms.
const D0 = 1714867200; // ponto ~30d atrás
const D1 = 1717459200; // último ponto (2024-06-04)

const CHAIN_SAMPLE = [
  { date: D0, tvl: 100 },
  { date: D1, tvl: 120 }, // +20% → rising
];
const CHAIN_DECLINING = [
  { date: D0, tvl: 1000 },
  { date: D1, tvl: 900 }, // -10% → declining
];

describe("parseChainTvl", () => {
  it("normaliza a série e converte segundos → ms (ordenado)", () => {
    const s = parseChainTvl([CHAIN_SAMPLE[1], CHAIN_SAMPLE[0]]); // fora de ordem
    expect(s).not.toBeNull();
    expect(s!).toHaveLength(2);
    expect(s![0]!.time).toBe(D0 * 1000);
    expect(s![1]!.tvl).toBe(120);
  });

  it("retorna null em payloads malformados", () => {
    expect(parseChainTvl(null)).toBeNull();
    expect(parseChainTvl({})).toBeNull();
    expect(parseChainTvl([])).toBeNull();
    expect(parseChainTvl([{ date: "x", tvl: "y" }])).toBeNull();
  });
});

describe("parseCurrentTvl", () => {
  it("aceita número cru (formato do `/tvl/{slug}`)", () => {
    expect(parseCurrentTvl(12611375686.42)).toBe(12611375686.42);
  });

  it("aceita objeto `{ tvl: number }`", () => {
    expect(parseCurrentTvl({ tvl: 900 })).toBe(900);
  });

  it("retorna null em payload inválido ou não-positivo", () => {
    expect(parseCurrentTvl(null)).toBeNull();
    expect(parseCurrentTvl("abc")).toBeNull();
    expect(parseCurrentTvl(0)).toBeNull();
    expect(parseCurrentTvl(-5)).toBeNull();
  });
});

describe("summarizeTvl", () => {
  it("calcula variação 30d e tendência (rising)", () => {
    const r = summarizeTvl(parseChainTvl(CHAIN_SAMPLE)!);
    expect(r.tvlUsd).toBe(120);
    expect(r.tvlChange30dPct).toBe(20);
    expect(r.tvlTrend).toBe("rising");
  });

  it("classifica declining", () => {
    const r = summarizeTvl(parseChainTvl(CHAIN_DECLINING)!);
    expect(r.tvlTrend).toBe("declining");
    expect(r.tvlChange30dPct).toBe(-10);
  });
});

describe("fetchFundamental", () => {
  it("BTC → não aplicável (honesto, sem inventar número)", async () => {
    const f = await fetchFundamental("BTCUSDT");
    expect(f?.applicability).toBe("not_applicable");
    expect(f?.tvlUsd).toBeUndefined();
  });

  it("símbolo fora do catálogo cripto → null", async () => {
    expect(await fetchFundamental("AAPL")).toBeNull();
    expect(await fetchFundamental("EURUSD")).toBeNull();
  });

  it("chain (ETH) usa o fetcher injetado e resume o TVL", async () => {
    const f = await fetchFundamental("ETHUSDT", async () => ({ ok: true, json: async () => CHAIN_SAMPLE }));
    expect(f?.applicability).toBe("chain");
    expect(f?.tvlTrend).toBe("rising");
    expect(f?.source).toBe("DefiLlama");
  });

  it("protocolo (AAVE) usa o endpoint leve `/tvl/{slug}`: TVL atual, sem tendência", async () => {
    const f = await fetchFundamental("AAVEUSDT", async () => ({ ok: true, json: async () => 12500000000 }));
    expect(f?.applicability).toBe("protocol");
    expect(f?.tvlUsd).toBe(12500000000);
    expect(f?.tvlTrend).toBeUndefined(); // 30d indisponível barato p/ protocolos
    expect(f?.notes.length).toBeGreaterThan(0);
  });

  it("chain de DeFi raso é marcada como `limited`", async () => {
    const f = await fetchFundamental("VETUSDT", async () => ({ ok: true, json: async () => CHAIN_SAMPLE }));
    expect(f?.applicability).toBe("limited");
    expect(f?.notes.length).toBeGreaterThan(0);
  });

  it("retorna null quando o fetch lança", async () => {
    const f = await fetchFundamental("ETHUSDT", async () => {
      throw new Error("network");
    });
    expect(f).toBeNull();
  });

  it("retorna null em resposta não-ok", async () => {
    const f = await fetchFundamental("ETHUSDT", async () => ({ ok: false, json: async () => ({}) }));
    expect(f).toBeNull();
  });
});

describe("fundamentalConvergence", () => {
  const rising: FundamentalResult = { kind: "fundamental", applicability: "chain", source: "DefiLlama", asOf: 0, tvlTrend: "rising", notes: [], disclaimer: "" };
  const declining: FundamentalResult = { ...rising, tvlTrend: "declining" };

  it("compra + TVL subindo → converge", () => {
    expect(fundamentalConvergence("buy", rising)).toBe("converge");
  });
  it("compra + TVL caindo → diverge", () => {
    expect(fundamentalConvergence("buy", declining)).toBe("diverge");
  });
  it("venda + TVL caindo → converge", () => {
    expect(fundamentalConvergence("sell", declining)).toBe("converge");
  });
  it("não aplicável ou neutro → neutro", () => {
    expect(fundamentalConvergence("buy", null)).toBe("neutro");
    expect(fundamentalConvergence("neutral", rising)).toBe("neutro");
  });
});
