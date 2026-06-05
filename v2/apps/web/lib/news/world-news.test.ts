import { describe, it, expect } from "vitest";
import { parseWorldNews, symbolToQuery, fetchNews, aggregateSentiment } from "./world-news";

const SAMPLE = {
  offset: 0,
  number: 2,
  available: 100,
  news: [
    {
      id: 1,
      title: "Bitcoin rompe resistência",
      url: "https://www.coindesk.com/markets/btc",
      summary: "BTC sobe forte.",
      publish_date: "2026-06-04 10:30:00",
      sentiment: 0.6,
      language: "en",
    },
    { id: 2, title: "Reguladores discutem cripto", url: "https://reuters.com/tech/crypto", publish_date: "2026-06-03 22:00:00", sentiment: -1.8 },
    { id: 3, url: "https://x.com/sem-titulo" }, // sem título → descartado
  ],
};

describe("parseWorldNews", () => {
  it("extrai itens, deriva host e clampa sentimento", () => {
    const items = parseWorldNews(SAMPLE);
    expect(items).toHaveLength(2); // o terceiro (sem título) é descartado
    expect(items[0]!.title).toBe("Bitcoin rompe resistência");
    expect(items[0]!.source).toBe("coindesk.com"); // www. removido
    expect(items[0]!.sentiment).toBe(0.6);
    expect(items[0]!.publishedAt).toBeGreaterThan(0);
    expect(items[1]!.sentiment).toBe(-1); // -1.8 clampado p/ -1
  });

  it("usa 0 de sentimento quando ausente e respeita o limit", () => {
    const noSent = { news: [{ title: "X", url: "https://a.com/x" }] };
    expect(parseWorldNews(noSent)[0]!.sentiment).toBe(0);
    expect(parseWorldNews(SAMPLE, 1)).toHaveLength(1);
  });

  it("retorna [] em payloads malformados", () => {
    expect(parseWorldNews(null)).toEqual([]);
    expect(parseWorldNews({})).toEqual([]);
    expect(parseWorldNews({ news: "nope" })).toEqual([]);
  });
});

describe("symbolToQuery", () => {
  it("mapeia cripto, ações, forex e commodities", () => {
    expect(symbolToQuery("BTCUSDT", "crypto")).toBe("Bitcoin");
    expect(symbolToQuery("PETR4", "stocks")).toBe("Petrobras");
    expect(symbolToQuery("EURUSD", "forex")).toBe("EUR/USD forex");
    expect(symbolToQuery("XAUUSD", "commodities")).toBe("gold price");
    expect(symbolToQuery("ZZZ", "stocks")).toBe("ZZZ stock");
  });
});

describe("fetchNews", () => {
  it("sem key → []", async () => {
    expect(await fetchNews("BTCUSDT", "crypto", { apiKey: "" })).toEqual([]);
  });

  it("usa fetcher injetado, monta a query e parseia", async () => {
    let calledUrl = "";
    const items = await fetchNews("BTCUSDT", "crypto", {
      apiKey: "k",
      fetcher: async (url) => {
        calledUrl = url;
        return { ok: true, json: async () => SAMPLE };
      },
    });
    expect(items).toHaveLength(2);
    expect(calledUrl).toContain("text=Bitcoin");
    expect(calledUrl).toContain("api-key=k");
  });

  it("retorna [] em resposta não-ok ou erro", async () => {
    expect(await fetchNews("BTCUSDT", "crypto", { apiKey: "k", fetcher: async () => ({ ok: false, json: async () => ({}) }) })).toEqual([]);
    expect(await fetchNews("BTCUSDT", "crypto", { apiKey: "k", fetcher: async () => { throw new Error("net"); } })).toEqual([]);
  });
});

describe("aggregateSentiment", () => {
  const mk = (sentiment: number) => ({ title: "t", url: "https://a.com/x", source: "a.com", publishedAt: 0, sentiment });
  it("neutral quando nenhum artigo tem score", () => {
    const r = aggregateSentiment([mk(0), mk(0)]);
    expect(r.overall).toBe("neutral");
    expect(r.scored).toBe(0);
    expect(r.count).toBe(2);
  });
  it("bullish/bearish pela média", () => {
    expect(aggregateSentiment([mk(0.6), mk(0.4)]).overall).toBe("bullish");
    expect(aggregateSentiment([mk(-0.5), mk(-0.3)]).overall).toBe("bearish");
  });
  it("mixed com positivos e negativos equilibrados", () => {
    expect(aggregateSentiment([mk(0.7), mk(-0.6)]).overall).toBe("mixed");
  });
});
