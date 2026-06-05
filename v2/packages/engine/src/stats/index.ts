/**
 * Camada estatística — a fundação da credibilidade do TradeAI v2.
 *
 * Em vez de exibir números crus, o motor sempre acompanha a incerteza:
 * intervalo de confiança + tamanho de amostra. Estes helpers são puros e
 * testáveis contra valores conhecidos.
 */
import type { Estimate } from "../types";

/** Média aritmética. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Desvio-padrão amostral (denominador n-1). */
export function sampleStdev(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / (n - 1));
}

/**
 * CDF da normal padrão via aproximação de Abramowitz & Stegun 7.1.26
 * (erro absoluto ~1.5e-7). Φ(0) = 0.5.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** PDF da normal padrão. */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Percentil por interpolação linear (método "linear"/R-7). p em [0,1].
 * Para p=0.5 devolve a mediana interpolada.
 */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
}

/**
 * Intervalo de confiança de Wilson para uma proporção (mais honesto que o
 * normal/Wald em amostras pequenas — nunca sai de [0,1]). z padrão = 1.96 (95%).
 *
 * Retorna a proporção pontual + IC, como `Estimate` (valor/CI em [0,1]).
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Estimate {
  if (n <= 0) return { value: 0, ci95: [0, 0], n: 0 };
  const phat = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n)) / denom;
  return {
    value: phat,
    ci95: [Math.max(0, center - margin), Math.min(1, center + margin)],
    n,
  };
}

/** Aproximação do valor t crítico (95%, bicaudal) por g.l. Suficiente para UI. */
function tCritical95(df: number): number {
  if (df <= 0) return Infinity;
  // Tabela para g.l. pequenos; converge para 1.96 conforme df cresce.
  const table: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 30: 2.042, 60: 2.0, 120: 1.98,
  };
  if (table[df] !== undefined) return table[df];
  if (df > 120) return 1.96;
  // interpola linearmente entre as chaves conhecidas
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  let lo = keys[0]!;
  let hi = keys[keys.length - 1]!;
  for (let i = 0; i < keys.length - 1; i++) {
    if (df >= keys[i]! && df <= keys[i + 1]!) {
      lo = keys[i]!;
      hi = keys[i + 1]!;
      break;
    }
  }
  const tLo = table[lo]!;
  const tHi = table[hi]!;
  return tLo + ((tHi - tLo) * (df - lo)) / (hi - lo);
}

/**
 * IC de 95% para a MÉDIA de uma amostra (t-Student). Útil para retorno médio
 * de trades/meses. Devolve `Estimate` com a média e o IC.
 */
export function meanConfidenceInterval(xs: number[], period?: string): Estimate {
  const n = xs.length;
  const m = mean(xs);
  if (n < 2) return { value: m, ci95: [m, m], n, period };
  const se = sampleStdev(xs) / Math.sqrt(n);
  const t = tCritical95(n - 1);
  return { value: m, ci95: [m - t * se, m + t * se], n, period };
}

/**
 * p-valor bicaudal de um teste binomial (H0: p=0.5) por aproximação normal
 * com correção de continuidade. Responde "quão improvável é ver `successes`
 * de `n` se fosse moeda justa?" — usado para checar se a confluência é melhor
 * que o acaso.
 */
export function binomialTwoSidedP(successes: number, n: number, p0 = 0.5): number {
  if (n <= 0) return 1;
  const meanB = n * p0;
  const sd = Math.sqrt(n * p0 * (1 - p0));
  if (sd === 0) return successes === meanB ? 1 : 0;
  const z = (Math.abs(successes - meanB) - 0.5) / sd;
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

/**
 * IC por bootstrap (percentil) de uma estatística sobre a amostra.
 * `rng` é injetável para testes determinísticos (default Math.random).
 */
export function bootstrapInterval(
  xs: number[],
  statistic: (sample: number[]) => number,
  options: { iterations?: number; rng?: () => number; period?: string } = {},
): Estimate {
  const n = xs.length;
  const iterations = options.iterations ?? 2000;
  const rng = options.rng ?? Math.random;
  if (n === 0) return { value: 0, ci95: [0, 0], n: 0, period: options.period };
  const point = statistic(xs);
  const stats: number[] = [];
  for (let it = 0; it < iterations; it++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) sample.push(xs[Math.floor(rng() * n)]!);
    stats.push(statistic(sample));
  }
  return {
    value: point,
    ci95: [percentile(stats, 0.025), percentile(stats, 0.975)],
    n,
    period: options.period,
  };
}
