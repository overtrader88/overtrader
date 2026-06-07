import { describe, it, expect } from "vitest";
import { buildWyckoffSeries } from "./wyckoff-series";
import type { WyckoffEvent } from "./wyckoff-events";

const NOW = 1_000_000_000_000;
const ev = (over: Partial<WyckoffEvent>): WyckoffEvent => ({ type: "Spring", side: "bull", price: 100, time: NOW, note: "", ...over });

describe("buildWyckoffSeries", () => {
  it("ordena do mais antigo ao mais recente", () => {
    const s = buildWyckoffSeries([
      ev({ time: NOW - 1000, type: "SOS" }),
      ev({ time: NOW - 5000, type: "AR" }),
      ev({ time: NOW - 3000, type: "ST", side: "bear" }),
    ], NOW);
    expect(s.map((x) => x.type)).toEqual(["AR", "ST", "SOS"]);
  });

  it("marca os 3 mais recentes como recent e formata tempo relativo", () => {
    const evs = Array.from({ length: 5 }, (_, i) => ev({ time: NOW - i * 3_600_000 }));
    const s = buildWyckoffSeries(evs, NOW);
    const recents = s.filter((x) => x.recent);
    expect(recents).toHaveLength(3);
    // o mais recente (time=NOW) → "agora"
    expect(s[s.length - 1]!.ago).toBe("agora");
    expect(s[0]!.ago).toMatch(/h$/);
  });

  it("ignora eventos sem preço/tempo válidos e lida com vazio", () => {
    expect(buildWyckoffSeries(undefined, NOW)).toEqual([]);
    const s = buildWyckoffSeries([ev({ price: NaN })], NOW);
    expect(s).toHaveLength(0);
  });
});
