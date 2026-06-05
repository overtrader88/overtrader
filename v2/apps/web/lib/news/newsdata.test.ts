import { describe, it, expect } from "vitest";
import { parseNewsData, fetchNewsData } from "./newsdata";

const SAMPLE = {
  status: "success",
  totalResults: 3,
  results: [
    { article_id: "1", title: "Bitcoin sobe", link: "https://www.coindesk.com/x", source_name: "CoinDesk", pubDate: "2026-06-04 10:00:00", sentiment: "positive" },
    { article_id: "2", title: "Mercado cai", link: "https://reuters.com/y", source_id: "reuters", pubDate: "2026-06-03 09:00:00", sentiment: "negative" },
    { article_id: "3", link: "https://x.com/no-title" }, // sem título → descartado
  ],
};

describe("parseNewsData", () => {
  it("extrai itens, fonte e mapeia sentimento label→número", () => {
    const items = parseNewsData(SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0]!.title).toBe("Bitcoin sobe");
    expect(items[0]!.source).toBe("CoinDesk");
    expect(items[0]!.sentiment).toBe(0.5);
    expect(items[0]!.publishedAt).toBeGreaterThan(0);
    expect(items[1]!.sentiment).toBe(-0.5);
  });
  it("sentimento ausente → 0 e respeita limit", () => {
    const noSent = { results: [{ title: "X", link: "https://a.com/x" }] };
    expect(parseNewsData(noSent)[0]!.sentiment).toBe(0);
    expect(parseNewsData(SAMPLE, 1)).toHaveLength(1);
  });
  it("retorna [] em payloads malformados", () => {
    expect(parseNewsData(null)).toEqual([]);
    expect(parseNewsData({})).toEqual([]);
    expect(parseNewsData({ results: "nope" })).toEqual([]);
  });
});

describe("fetchNewsData", () => {
  it("sem key → []", async () => {
    expect(await fetchNewsData("BTCUSDT", "crypto", { apiKey: "" })).toEqual([]);
  });
  it("monta q + apikey e aplica locale pt/br p/ ticker B3", async () => {
    let calledUrl = "";
    const items = await fetchNewsData("PETR4", "stocks", {
      apiKey: "k",
      fetcher: async (url) => {
        calledUrl = url;
        return { ok: true, json: async () => SAMPLE };
      },
    });
    expect(items).toHaveLength(2);
    expect(calledUrl).toContain("apikey=k");
    expect(calledUrl).toContain("qInTitle=Petrobras");
    expect(calledUrl).toContain("language=pt");
    expect(calledUrl).toContain("country=br");
  });
  it("retorna [] em resposta não-ok", async () => {
    expect(await fetchNewsData("BTCUSDT", "crypto", { apiKey: "k", fetcher: async () => ({ ok: false, json: async () => ({}) }) })).toEqual([]);
  });
});
