/**
 * Breadth (amplitude de mercado) — PROXY APROXIMADO por amostra, grátis via Yahoo.
 * Sem API limpa e gratuita de advance-decline, usamos a participação dos 11 ETFs
 * setoriais SPDR do S&P 500: % deles negociando ACIMA da própria média móvel de
 * 50 e 200 dias. É um proxy honesto de "quantos setores estão em tendência", NÃO
 * o advance-decline oficial. Cacheado 1h (breadth muda devagar). Falha → null.
 */
const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

/** Setores SPDR do S&P 500 (participação ampla do mercado dos EUA). */
const SECTORS = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC"];

export interface BreadthProxy {
  pctAbove50: number;  // % dos setores acima da MM50 (0–100)
  pctAbove200: number; // % dos setores acima da MM200 (0–100)
  sampleSize: number;  // setores efetivamente lidos
}

const sma = (arr: number[], period: number): number | null => {
  if (arr.length < period) return null;
  let s = 0;
  for (let i = arr.length - period; i < arr.length; i++) s += arr[i]!;
  return s / period;
};

async function closes(symbol: string): Promise<number[] | null> {
  try {
    const url = `${YF}/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const r = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] } };
    const raw = j.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(raw)) return null;
    const clean = raw.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
    return clean.length >= 50 ? clean : null;
  } catch {
    return null;
  }
}

export async function getBreadthProxy(): Promise<BreadthProxy | null> {
  const series = await Promise.all(SECTORS.map(closes));
  const valid = series.filter((s): s is number[] => s != null);
  if (valid.length < 6) return null; // amostra fraca demais → honesto

  let above50 = 0, above200 = 0, n200 = 0;
  for (const c of valid) {
    const last = c[c.length - 1]!;
    const m50 = sma(c, 50);
    const m200 = sma(c, 200);
    if (m50 != null && last > m50) above50++;
    if (m200 != null) { n200++; if (last > m200) above200++; }
  }
  return {
    pctAbove50: Math.round((above50 / valid.length) * 100),
    pctAbove200: n200 > 0 ? Math.round((above200 / n200) * 100) : 0,
    sampleSize: valid.length,
  };
}
