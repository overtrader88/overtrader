import { describe, expect, it } from "vitest";
import {
  analyzeInputSchema, watchlistCreateSchema, hublaWebhookSchema, telegramUpdateSchema, parseTelegramCommand,
} from "./schemas";

describe("analyzeInputSchema", () => {
  it("normaliza símbolo p/ maiúsculas e aplica default de type", () => {
    const r = analyzeInputSchema.parse({ symbol: "btcusdt", assetType: "crypto", timeframe: "1h" });
    expect(r.symbol).toBe("BTCUSDT");
    expect(r.type).toBe("complete");
  });
  it("rejeita timeframe inválido", () => {
    expect(analyzeInputSchema.safeParse({ symbol: "BTC", assetType: "crypto", timeframe: "2h" }).success).toBe(false);
  });
});

describe("watchlistCreateSchema", () => {
  it("default STRONG_BUY", () => {
    expect(watchlistCreateSchema.parse({ symbol: "ETHUSDT", timeframe: "4h" }).min_signal_strength).toBe("STRONG_BUY");
  });
  it("rejeita lado de venda como min_signal_strength", () => {
    expect(watchlistCreateSchema.safeParse({ symbol: "ETH", timeframe: "4h", min_signal_strength: "SELL" }).success).toBe(false);
  });
});

describe("hublaWebhookSchema", () => {
  it("aceita payload mínimo com email e mantém extras", () => {
    const r = hublaWebhookSchema.parse({ type: "purchase.approved", data: { email: "a@b.com", productId: "p1", extra: 1 } });
    expect(r.data.email).toBe("a@b.com");
  });
  it("rejeita email inválido", () => {
    expect(hublaWebhookSchema.safeParse({ type: "x", data: { email: "naoemail" } }).success).toBe(false);
  });
});

describe("telegram", () => {
  it("valida update com mensagem", () => {
    expect(telegramUpdateSchema.safeParse({ update_id: 1, message: { text: "/btc 1h", chat: { id: 9 }, from: { id: 9 } } }).success).toBe(true);
  });
  it("parseTelegramCommand extrai comando e args", () => {
    expect(parseTelegramCommand("/btc 1h")).toEqual({ command: "btc", args: ["1h"] });
    expect(parseTelegramCommand("/start ABC123")).toEqual({ command: "start", args: ["ABC123"] });
    expect(parseTelegramCommand("ola tudo bem")).toBeNull();
  });
});
