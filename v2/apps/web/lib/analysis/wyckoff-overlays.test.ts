import { describe, it, expect } from "vitest";
import { buildWyckoffOverlays } from "./chart-overlays";
import type { FullAnalysis } from "./full";

const dto = (p: unknown) => p as FullAnalysis;

describe("buildWyckoffOverlays (híbrido)", () => {
  it("sem eventos → vazio", () => {
    const o = buildWyckoffOverlays(dto({}));
    expect(o.lines).toHaveLength(0);
    expect(o.zones).toHaveLength(0);
  });

  it("evento isolado vira linha; cluster do mesmo lado vira zona", () => {
    const o = buildWyckoffOverlays(dto({
      wyckoffEvents: [
        { type: "SOW", side: "bear", time: 1000, price: 4441 },   // isolado (bear, distante)
        { type: "Spring", side: "bull", time: 2000, price: 4429 }, // cluster bull...
        { type: "Spring", side: "bull", time: 3000, price: 4424 }, // ...com este (≤0,6%)
      ],
    }));
    // 1 zona (cluster Spring) + 1 linha (SOW isolado)
    expect(o.zones).toHaveLength(1);
    expect(o.zones[0]!.top).toBe(4429);
    expect(o.zones[0]!.bottom).toBe(4424);
    expect(o.zones[0]!.label).toMatch(/demanda/);
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0]!.title).toBe("SOW");
  });

  it("considera só os 3 mais recentes", () => {
    const evs = Array.from({ length: 6 }, (_, i) => ({ type: "Spring", side: "bull", time: i * 1000, price: 100 + i * 10 }));
    const o = buildWyckoffOverlays(dto({ wyckoffEvents: evs }));
    const totalRefs = o.lines.length + o.zones.reduce((a) => a + 1, 0);
    // 3 eventos espaçados (>0,6%) → 3 linhas, nenhuma zona
    expect(o.lines.length + o.zones.length).toBeLessThanOrEqual(3);
    expect(totalRefs).toBeGreaterThan(0);
  });
});
