import { describe, expect, it } from "vitest";
import {
  mean,
  sampleStdev,
  normalCdf,
  percentile,
  wilsonInterval,
  meanConfidenceInterval,
  binomialTwoSidedP,
  bootstrapInterval,
} from "../src/stats";

describe("stats — valores conhecidos", () => {
  it("mean e sampleStdev", () => {
    expect(mean([2, 4, 6])).toBe(4);
    // stdev amostral de [2,4,6] = 2
    expect(sampleStdev([2, 4, 6])).toBeCloseTo(2, 10);
  });

  it("normalCdf em pontos âncora", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("percentil interpola (mediana)", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(percentile([10], 0.9)).toBe(10);
  });

  it("Wilson IC de 8/10 fica em torno de [0.49, 0.94]", () => {
    const e = wilsonInterval(8, 10);
    expect(e.value).toBeCloseTo(0.8, 10);
    expect(e.n).toBe(10);
    expect(e.ci95[0]).toBeGreaterThan(0.4);
    expect(e.ci95[0]).toBeLessThan(0.55);
    expect(e.ci95[1]).toBeGreaterThan(0.9);
    expect(e.ci95[1]).toBeLessThanOrEqual(1);
  });

  it("IC da média tem largura > 0 e contém a média", () => {
    const e = meanConfidenceInterval([1, 2, 3, 4, 5]);
    expect(e.value).toBe(3);
    expect(e.ci95[0]).toBeLessThan(3);
    expect(e.ci95[1]).toBeGreaterThan(3);
  });

  it("binomial: 5/10 ~ p alto; 10/10 ~ p baixo", () => {
    expect(binomialTwoSidedP(5, 10)).toBeGreaterThan(0.7);
    expect(binomialTwoSidedP(10, 10)).toBeLessThan(0.05);
  });

  it("bootstrap é determinístico com rng injetado", () => {
    let s = 1;
    const rng = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const e = bootstrapInterval([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], mean, {
      iterations: 500,
      rng,
    });
    expect(e.value).toBe(5.5);
    expect(e.ci95[0]).toBeLessThan(e.value);
    expect(e.ci95[1]).toBeGreaterThan(e.value);
  });
});
