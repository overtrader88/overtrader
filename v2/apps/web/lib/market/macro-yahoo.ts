/**
 * Macro grátis via Yahoo Finance (sem key): DXY (índice do dólar) e VIX (medo).
 * Usado pelo Motor 2 — DXY p/ forex & commodities, VIX p/ índices. Falha → null
 * (nunca inventa). Mesmo endpoint público de chart já usado nos provedores.
 */
const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

export interface MacroQuote {
  value: number;     // último fechamento
  changePct: number; // variação % vs. fechamento anterior
}
export interface MacroContext {
  dxy: MacroQuote | null;
  vix: MacroQuote | null;
}

async function getQuote(symbol: string): Promise<MacroQuote | null> {
  try {
    const url = `${YF}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const closes = j.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(closes)) return null;
    const clean = closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
    if (clean.length < 2) return null;
    const value = clean[clean.length - 1]!;
    const prev = clean[clean.length - 2]!;
    if (!(prev > 0)) return null;
    return { value, changePct: ((value - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

export async function getMacroContext(opts: { dxy?: boolean; vix?: boolean }): Promise<MacroContext> {
  const [dxy, vix] = await Promise.all([
    opts.dxy ? getQuote("DX-Y.NYB") : Promise.resolve(null),
    opts.vix ? getQuote("^VIX") : Promise.resolve(null),
  ]);
  return { dxy, vix };
}
