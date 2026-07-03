import { describe, expect, it } from "vitest";
import {
  HUMAN_ENGINE_COLOR,
  humanEngineLabel,
  humanEngineTag,
  humanSignalSchema,
  isHumanEngine,
  slugifyCompetitor,
  validateHumanPlan,
} from "./human";

describe("isHumanEngine", () => {
  it("reconhece o prefixo humano_", () => {
    expect(isHumanEngine("humano_joao")).toBe(true);
    expect(isHumanEngine("humano_ana_b")).toBe(true);
  });
  it("não confunde motores da casa", () => {
    for (const id of ["padrao", "classe_b", "llm_ds_vsf_surv", "evo_gpt", "consenso", "humanoide"]) {
      expect(isHumanEngine(id)).toBe(false);
    }
  });
});

describe("humanEngineLabel / humanEngineTag", () => {
  it("capitaliza o slug", () => {
    expect(humanEngineLabel("humano_joao")).toBe("Joao");
    expect(humanEngineLabel("humano_joao_silva")).toBe("Joao Silva");
    expect(humanEngineLabel("humano_ana-b")).toBe("Ana B");
  });
  it("degrada p/ o id quando o slug é vazio", () => {
    expect(humanEngineLabel("humano_")).toBe("humano_");
  });
  it("tag leva o ícone 🧑", () => {
    expect(humanEngineTag("humano_joao")).toBe("🧑 Joao");
  });
  it("cor é a rosa combinada (não amarelo)", () => {
    expect(HUMAN_ENGINE_COLOR).toBe("#fb7185");
  });
});

describe("slugifyCompetitor", () => {
  it("normaliza nome com acento e espaço", () => {
    expect(slugifyCompetitor("João Silva")).toBe("joao_silva");
  });
  it("remove símbolos e bordas", () => {
    expect(slugifyCompetitor("  @Ana! B.  ")).toBe("ana_b");
  });
  it("limita a 24 caracteres", () => {
    expect(slugifyCompetitor("a".repeat(40)).length).toBeLessThanOrEqual(24);
  });
  it("devolve vazio quando não sobra nada", () => {
    expect(slugifyCompetitor("!!!")).toBe("");
  });
});

describe("validateHumanPlan", () => {
  const buyPlan = { side: "buy" as const, entry: 100, stop: 95, tp1: 105, tp2: 110, tp3: 120 };
  const sellPlan = { side: "sell" as const, entry: 100, stop: 105, tp1: 95, tp2: 90, tp3: 80 };

  it("aceita compra coerente", () => {
    expect(validateHumanPlan(buyPlan)).toBeNull();
  });
  it("aceita venda coerente (espelhada)", () => {
    expect(validateHumanPlan(sellPlan)).toBeNull();
  });
  it("rejeita compra com stop acima da entrada", () => {
    expect(validateHumanPlan({ ...buyPlan, stop: 101 })).toMatch(/stop/i);
  });
  it("rejeita compra com alvos fora de ordem", () => {
    expect(validateHumanPlan({ ...buyPlan, tp2: 104 })).toMatch(/alvos/i);
  });
  it("rejeita venda com stop abaixo da entrada", () => {
    expect(validateHumanPlan({ ...sellPlan, stop: 99 })).toMatch(/stop/i);
  });
  it("rejeita venda com alvos acima da entrada", () => {
    expect(validateHumanPlan({ ...sellPlan, tp1: 101 })).toMatch(/alvos/i);
  });
});

describe("humanSignalSchema", () => {
  const valid = {
    slug: "joao", symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h",
    side: "buy", entry: 100, stop: 95, tp1: 105, tp2: 110, tp3: 120,
  };
  it("aceita body válido", () => {
    expect(humanSignalSchema.safeParse(valid).success).toBe(true);
    expect(humanSignalSchema.safeParse({ ...valid, strong: true }).success).toBe(true);
  });
  it("rejeita slug com maiúscula/acento e timeframe desconhecido", () => {
    expect(humanSignalSchema.safeParse({ ...valid, slug: "João" }).success).toBe(false);
    expect(humanSignalSchema.safeParse({ ...valid, timeframe: "2h" }).success).toBe(false);
  });
  it("rejeita preço não-positivo", () => {
    expect(humanSignalSchema.safeParse({ ...valid, entry: 0 }).success).toBe(false);
    expect(humanSignalSchema.safeParse({ ...valid, stop: -1 }).success).toBe(false);
  });
});
