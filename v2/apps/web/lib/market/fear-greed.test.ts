import { describe, it, expect } from "vitest";
import { parseFearGreed, fetchFearGreed } from "./fear-greed";

const SAMPLE = {
  name: "Fear and Greed Index",
  data: [{ value: "72", value_classification: "Greed", timestamp: "1717459200", time_until_update: "3600" }],
};

describe("parseFearGreed", () => {
  it("extrai valor, classificação e timestamp (segundos → ms)", () => {
    const fg = parseFearGreed(SAMPLE);
    expect(fg).not.toBeNull();
    expect(fg!.value).toBe(72);
    expect(fg!.classification).toBe("Greed");
    expect(fg!.timestamp).toBe(1717459200 * 1000);
  });

  it("retorna null em payloads malformados", () => {
    expect(parseFearGreed(null)).toBeNull();
    expect(parseFearGreed({})).toBeNull();
    expect(parseFearGreed({ data: [] })).toBeNull();
    expect(parseFearGreed({ data: [{ value: "abc" }] })).toBeNull();
  });
});

describe("fetchFearGreed", () => {
  it("usa o fetcher injetado e parseia", async () => {
    const fg = await fetchFearGreed(async () => ({ ok: true, json: async () => SAMPLE }));
    expect(fg?.value).toBe(72);
    expect(fg?.classification).toBe("Greed");
  });

  it("retorna null quando o fetch lança", async () => {
    const fg = await fetchFearGreed(async () => {
      throw new Error("network");
    });
    expect(fg).toBeNull();
  });

  it("retorna null em resposta não-ok", async () => {
    const fg = await fetchFearGreed(async () => ({ ok: false, json: async () => ({}) }));
    expect(fg).toBeNull();
  });
});
