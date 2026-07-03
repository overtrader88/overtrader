import { describe, expect, it } from "vitest";
import {
  analyzeInputSchema, watchlistCreateSchema, warCouncilSchema, hublaWebhookSchema, telegramUpdateSchema, parseTelegramCommand,
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
  it("aceita lado de venda como gatilho (watchlist de venda)", () => {
    expect(watchlistCreateSchema.safeParse({ symbol: "ETH", timeframe: "4h", min_signal_strength: "SELL" }).success).toBe(true);
    expect(watchlistCreateSchema.safeParse({ symbol: "ETH", timeframe: "4h", min_signal_strength: "STRONG_SELL" }).success).toBe(true);
  });
  it("rejeita NEUTRAL (gatilho precisa ser acionável)", () => {
    expect(watchlistCreateSchema.safeParse({ symbol: "ETH", timeframe: "4h", min_signal_strength: "NEUTRAL" }).success).toBe(false);
  });
});

describe("warCouncilSchema", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  it("aceita analysisId + pergunta, com history default vazio", () => {
    const r = warCouncilSchema.parse({ analysisId: id, question: "Por que o selo é amarelo?" });
    expect(r.history).toEqual([]);
  });
  it("aceita dto serializado no lugar do analysisId", () => {
    expect(warCouncilSchema.safeParse({ dto: { generatedAt: 1 }, question: "Qual o risco?" }).success).toBe(true);
  });
  it("rejeita sem analysisId E sem dto (não há análise pra ancorar)", () => {
    expect(warCouncilSchema.safeParse({ question: "Qual o risco?" }).success).toBe(false);
  });
  it("rejeita pergunta curta demais e histórico acima do teto", () => {
    expect(warCouncilSchema.safeParse({ analysisId: id, question: "a" }).success).toBe(false);
    const history = Array.from({ length: 25 }, () => ({ role: "user", content: "x" }));
    expect(warCouncilSchema.safeParse({ analysisId: id, question: "Qual o risco?", history }).success).toBe(false);
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
