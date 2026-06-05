/**
 * PRNG determinístico + ruído gaussiano. Substitui `Math.random()` do v1 para
 * que toda simulação (Monte Carlo) seja REPRODUTÍVEL — pré-requisito de testes
 * golden e do motor "auditável".
 */

/** Gerador uniforme [0,1) determinístico (mulberry32). Mesma seed → mesma sequência. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tipo de uma fonte de aleatoriedade uniforme [0,1). */
export type Rng = () => number;

/**
 * Ruído normal padrão N(0,1) via Box-Muller, consumindo `rng`.
 * Guarda o segundo valor do par para a chamada seguinte (eficiência).
 */
export function gaussianSampler(rng: Rng): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    // evita log(0)
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}
