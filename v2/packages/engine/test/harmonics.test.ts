import { describe, expect, it } from "vitest";
import { detectHarmonics } from "../src/harmonics";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import { seededWalk } from "./fixtures/candles";

describe("detectHarmonics", () => {
  it("é qualitativo e determinístico", () => {
    const c = seededWalk(300, 51);
    const a = detectHarmonics(c);
    const b = detectHarmonics(c);
    expect(a.kind).toBe("qualitative");
    expect(a.disclaimer.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("todo padrão retornado tem PRZ válida (low ≤ high) e métricas em faixa", () => {
    const c = seededWalk(400, 52);
    const r = detectHarmonics(c);
    expect(r.patterns.length).toBeLessThanOrEqual(5);
    for (const p of r.patterns) {
      expect(p.prz.low).toBeLessThanOrEqual(p.prz.high); // hardening: nada de PRZ fabricada inválida
      expect(p.quality).toBeGreaterThanOrEqual(0);
      expect(p.quality).toBeLessThanOrEqual(100);
      expect(p.completion).toBeGreaterThanOrEqual(0);
      expect(p.completion).toBeLessThanOrEqual(100);
    }
  });

  it("tolerância maior detecta ao menos tantos padrões quanto a menor (wiring do config)", () => {
    const c = seededWalk(500, 53);
    const tight = detectHarmonics(c, { ...DEFAULT_ENGINE_CONFIG.harmonics, tolerance: 0.02 });
    const loose = detectHarmonics(c, { ...DEFAULT_ENGINE_CONFIG.harmonics, tolerance: 0.4 });
    expect(loose.patterns.length).toBeGreaterThanOrEqual(tight.patterns.length);
  });

  it("dados insuficientes → vazio", () => {
    const r = detectHarmonics(seededWalk(40, 54));
    expect(r.patterns).toHaveLength(0);
  });
});
