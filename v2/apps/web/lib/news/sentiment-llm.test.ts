import { describe, it, expect } from "vitest";
import { parseSentimentJson, summarizeNewsSentiment } from "./sentiment-llm";

const item = (title: string) => ({ title, url: "https://a.com/x", source: "a.com", publishedAt: 0, sentiment: 0 });

describe("parseSentimentJson", () => {
  it("parseia JSON válido", () => {
    const r = parseSentimentJson('{"overall":"bullish","score":0.5,"summary":"Cenário positivo."}');
    expect(r).not.toBeNull();
    expect(r!.overall).toBe("bullish");
    expect(r!.score).toBe(0.5);
  });
  it("tolera cercas de markdown ```json", () => {
    const r = parseSentimentJson('```json\n{"overall":"bearish","score":-0.4,"summary":"Pressão de venda."}\n```');
    expect(r!.overall).toBe("bearish");
  });
  it("retorna null em JSON inválido ou fora do schema", () => {
    expect(parseSentimentJson("não é json")).toBeNull();
    expect(parseSentimentJson('{"overall":"foo","score":0,"summary":"x"}')).toBeNull();
    expect(parseSentimentJson('{"overall":"bullish","score":5,"summary":"x"}')).toBeNull(); // score fora de [-1,1]
  });
});

describe("summarizeNewsSentiment", () => {
  it("usa o caller injetado e parseia", async () => {
    const r = await summarizeNewsSentiment("BTCUSDT", [item("Bitcoin sobe forte")], async () => '{"overall":"bullish","score":0.6,"summary":"Alta."}');
    expect(r?.overall).toBe("bullish");
    expect(r?.summary).toBe("Alta.");
  });
  it("null quando não há itens", async () => {
    expect(await summarizeNewsSentiment("BTCUSDT", [], async () => '{"overall":"bullish","score":1,"summary":"x"}')).toBeNull();
  });
  it("null quando o caller falha (sem key/erro)", async () => {
    expect(await summarizeNewsSentiment("BTCUSDT", [item("X")], async () => null)).toBeNull();
  });
});
