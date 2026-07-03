import { describe, it, expect } from "vitest";
import { decideSimulatorGate } from "./quota";
import { SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST } from "@/lib/billing-constants";

describe("decideSimulatorGate", () => {
  it("dentro da cota diária é grátis, mesmo sem saldo", () => {
    for (let used = 0; used < SIMULATOR_FREE_PER_DAY; used++) {
      const g = decideSimulatorGate(used, 0);
      expect(g.allowed).toBe(true);
      expect(g.needsCharge).toBe(false);
    }
  });

  it("estourou a cota + tem saldo → permite e cobra", () => {
    const g = decideSimulatorGate(SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST);
    expect(g.allowed).toBe(true);
    expect(g.needsCharge).toBe(true);
  });

  it("estourou a cota + sem saldo → bloqueia", () => {
    const g = decideSimulatorGate(SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST - 1);
    expect(g.allowed).toBe(false);
    expect(g.needsCharge).toBe(true);
  });

  it("muito além da cota continua cobrando (não volta a ser grátis)", () => {
    const g = decideSimulatorGate(SIMULATOR_FREE_PER_DAY + 10, 5);
    expect(g.allowed).toBe(true);
    expect(g.needsCharge).toBe(true);
  });

  it("ecoa usedToday e balance pro chamador exibir", () => {
    const g = decideSimulatorGate(2, 7);
    expect(g.usedToday).toBe(2);
    expect(g.balance).toBe(7);
  });
});
