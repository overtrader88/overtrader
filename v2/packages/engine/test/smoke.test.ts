import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, DEFAULT_ENGINE_CONFIG } from "../src/index";
import { TIMEFRAMES, SIGNAL_DIRECTIONS } from "@tradeai/shared";

describe("engine scaffold (M0)", () => {
  it("expõe uma versão semântica", () => {
    expect(ENGINE_VERSION).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("config default tem a estrutura esperada", () => {
    expect(DEFAULT_ENGINE_CONFIG.minCandles).toBeGreaterThan(0);
    expect(Object.keys(DEFAULT_ENGINE_CONFIG.categoryWeights).length).toBeGreaterThan(0);
    expect(DEFAULT_ENGINE_CONFIG.gates.minRr1).toBeGreaterThan(1);
  });

  it("consome constantes do @tradeai/shared", () => {
    expect(TIMEFRAMES).toContain("4h");
    expect(SIGNAL_DIRECTIONS).toContain("NEUTRAL");
  });
});
