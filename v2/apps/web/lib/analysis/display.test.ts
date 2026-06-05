import { describe, it, expect } from "vitest";
import { signalToDir, signalLabelPt, sealFromStatus, sealText, relativeTime, shortDateTime } from "./display";

describe("display mappers", () => {
  it("signalToDir colapsa direção", () => {
    expect(signalToDir("STRONG_BUY")).toBe("buy");
    expect(signalToDir("WEAK_BUY")).toBe("buy");
    expect(signalToDir("SELL")).toBe("sell");
    expect(signalToDir("NEUTRAL")).toBe("neu");
  });

  it("signalLabelPt traduz", () => {
    expect(signalLabelPt("BUY")).toBe("Compra");
    expect(signalLabelPt("STRONG_SELL")).toBe("Venda forte");
    expect(signalLabelPt("NEUTRAL")).toBe("Neutro");
  });

  it("sealFromStatus mapeia o selo do motor p/ a UI", () => {
    expect(sealFromStatus("green")).toBe("green");
    expect(sealFromStatus("yellow")).toBe("amber");
    expect(sealFromStatus("red")).toBe("red");
    expect(sealFromStatus("grey")).toBe("gray");
    expect(sealFromStatus(undefined)).toBe("gray");
    expect(sealFromStatus(null)).toBe("gray");
  });

  it("sealText rotula em pt-BR", () => {
    expect(sealText("green")).toBe("verde");
    expect(sealText("gray")).toBe("amostra");
  });

  it("relativeTime é determinístico dado nowMs", () => {
    const now = 1_700_000_000_000;
    expect(relativeTime(new Date(now - 20_000).toISOString(), now)).toBe("agora");
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("há 5 min");
    expect(relativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("há 3 h");
    expect(relativeTime(new Date(now - 24 * 3_600_000).toISOString(), now)).toBe("ontem");
  });

  it("shortDateTime tem formato dd/mm hh:mm", () => {
    expect(shortDateTime(new Date(1_700_000_000_000).toISOString())).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});
