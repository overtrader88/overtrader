/**
 * Derivativos cripto — dados PÚBLICOS e GRATUITOS da Binance Futures (sem API key).
 * Funding rate, Open Interest (variação) e long/short ratio de contas. Usado SÓ
 * pelo Motor 2 (cripto) como sentimento/exaustão. Em qualquer falha retorna null
 * — nunca inventa número (a Binance pode bloquear por região no servidor).
 *
 *  - /fapi/v1/premiumIndex            → lastFundingRate (taxa por 8h)
 *  - /futures/data/openInterestHist   → sumOpenInterest (variação recente)
 *  - /futures/data/globalLongShortAccountRatio → longShortRatio de contas
 */
const FAPI = "https://fapi.binance.com";

export interface BinanceDerivatives {
  symbol: string;
  fundingRate: number;        // por período de 8h (decimal, ex.: 0.0001 = 0,01%)
  fundingAnnualizedPct: number; // funding * 3 * 365 * 100
  nextFundingTime: number | null;
  oiChangePct: number | null; // variação % do OI entre os 2 últimos pontos
  longShortRatio: number | null; // >1 = mais contas compradas
  longPct: number | null;     // % de contas compradas (0–100)
}

/** Só perpétuos USDT da Binance (BTCUSDT, ETHUSDT, …). */
function toBinancePerp(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s.endsWith("USDT")) return null;
  return s;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function getBinanceDerivatives(symbol: string): Promise<BinanceDerivatives | null> {
  const sym = toBinancePerp(symbol);
  if (!sym) return null;

  const [prem, oiHist, ls] = await Promise.all([
    getJson(`${FAPI}/fapi/v1/premiumIndex?symbol=${sym}`),
    getJson(`${FAPI}/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=2`),
    getJson(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`),
  ]);

  const p = prem as Record<string, unknown> | null;
  const fundingRate = p ? num(p.lastFundingRate) : null;
  if (fundingRate == null) return null; // sem funding não há leitura de derivativos

  let oiChangePct: number | null = null;
  if (Array.isArray(oiHist) && oiHist.length >= 2) {
    const prev = num((oiHist[0] as Record<string, unknown>)?.sumOpenInterest);
    const last = num((oiHist[oiHist.length - 1] as Record<string, unknown>)?.sumOpenInterest);
    if (prev != null && last != null && prev > 0) oiChangePct = ((last - prev) / prev) * 100;
  }

  let longShortRatio: number | null = null;
  let longPct: number | null = null;
  if (Array.isArray(ls) && ls.length > 0) {
    const row = ls[0] as Record<string, unknown>;
    longShortRatio = num(row.longShortRatio);
    const la = num(row.longAccount);
    if (la != null) longPct = la * 100;
  }

  return {
    symbol: sym,
    fundingRate,
    fundingAnnualizedPct: fundingRate * 3 * 365 * 100,
    nextFundingTime: p ? num(p.nextFundingTime) : null,
    oiChangePct,
    longShortRatio,
    longPct,
  };
}
