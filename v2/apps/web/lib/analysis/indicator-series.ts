/**
 * Séries de indicadores para DESENHAR no gráfico ao vivo (client-side, a partir
 * dos candles). Puro. Períodos batem com o motor (EMA 20/50/200, Bollinger 20/2σ)
 * para coerência visual com a leitura do Resumo Técnico.
 */
export function emaSeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0]!;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export interface BollingerBands { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[]; }

export function bollingerSeries(values: number[], period = 20, mult = 2): BollingerBands {
  const mid = smaSeries(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const m = mid[i];
    if (m == null) { upper.push(null); lower.push(null); continue; }
    let varSum = 0;
    for (let j = i - period + 1; j <= i; j++) varSum += (values[j]! - m) ** 2;
    const sd = Math.sqrt(varSum / period);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { upper, mid, lower };
}
