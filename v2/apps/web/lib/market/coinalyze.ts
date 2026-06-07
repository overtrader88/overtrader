/**
 * Coinalyze — dados REAIS de derivativos (liquidações + open interest). Cripto.
 * Server-only. Grátis (40 req/min) com chave em COINALYZE_API_KEY.
 *
 * PRINCÍPIO (dado real, nunca fictício): tudo aqui retorna `null` se faltar a
 * chave, se a chamada falhar, ou se a resposta não vier no formato esperado.
 * Nunca devolve número inventado — quem consome só exibe quando há dado real.
 *
 * O símbolo do Coinalyze (ex.: "BTCUSDT_PERP.A") é DESCOBERTO via /future-markets
 * (não hardcoded), pra não errar o formato.
 */
const BASE = "https://api.coinalyze.net/v1";

function key(): string | null {
  return process.env.COINALYZE_API_KEY || null;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const k = key();
  if (!k) return null;
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { api_key: k },
      // cache curto p/ respeitar o rate limit (40/min)
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface FutureMarket { symbol: string; base_asset?: string; is_perpetual?: boolean; exchange?: string; }

let marketsCache: FutureMarket[] | null | undefined;
async function futureMarkets(): Promise<FutureMarket[] | null> {
  if (marketsCache !== undefined) return marketsCache;
  const data = await call<FutureMarket[]>("/future-markets", {});
  marketsCache = Array.isArray(data) ? data : null;
  return marketsCache;
}

/** Descobre o símbolo Coinalyze do PERPÉTUO da base (ex.: "BTC" → "BTCUSDT_PERP.A"). */
export async function coinalyzeSymbol(ourSymbol: string): Promise<string | null> {
  const base = ourSymbol.replace(/USDT$|USD$/i, "").toUpperCase();
  const markets = await futureMarkets();
  if (!markets) return null;
  // prioriza perpétuo USDT na Binance (exchange "A"); senão qualquer perp da base.
  const usdtPerp = markets.find(
    (m) => m.is_perpetual && (m.base_asset ?? "").toUpperCase() === base && /USDT_PERP\.A$/i.test(m.symbol),
  );
  const anyPerp = markets.find((m) => m.is_perpetual && (m.base_asset ?? "").toUpperCase() === base);
  return usdtPerp?.symbol ?? anyPerp?.symbol ?? null;
}

export interface LiquidationPoint { time: number; longUsd: number; shortUsd: number; }
export interface OpenInterestPoint { time: number; valueUsd: number; }

interface HistResp { symbol: string; history: Record<string, number>[]; }

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Liquidações REAIS recentes (histórico). null se indisponível/sem chave. */
export async function getLiquidations(ourSymbol: string, interval = "1hour", hours = 24): Promise<LiquidationPoint[] | null> {
  const sym = await coinalyzeSymbol(ourSymbol);
  if (!sym) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - hours * 3600;
  const data = await call<HistResp[]>("/liquidation-history", {
    symbols: sym, interval, from: String(from), to: String(to), convert_to_usd: "true",
  });
  const hist = Array.isArray(data) ? data[0]?.history : null;
  if (!Array.isArray(hist)) return null;
  const out: LiquidationPoint[] = [];
  for (const h of hist) {
    const t = num(h.t);
    const l = num(h.l); // long liquidations
    const s = num(h.s); // short liquidations
    if (t == null || l == null || s == null) return null; // formato inesperado → não inventa
    out.push({ time: t * 1000, longUsd: l, shortUsd: s });
  }
  return out;
}

/** Open Interest REAL mais recente (em USD). null se indisponível. */
export async function getOpenInterest(ourSymbol: string): Promise<OpenInterestPoint | null> {
  const sym = await coinalyzeSymbol(ourSymbol);
  if (!sym) return null;
  const to = Math.floor(Date.now() / 1000);
  const from = to - 6 * 3600;
  const data = await call<HistResp[]>("/open-interest-history", {
    symbols: sym, interval: "1hour", from: String(from), to: String(to), convert_to_usd: "true",
  });
  const hist = Array.isArray(data) ? data[0]?.history : null;
  if (!Array.isArray(hist) || hist.length === 0) return null;
  const last = hist[hist.length - 1]!;
  const t = num(last.t);
  const v = num(last.c) ?? num(last.o); // close do OI no último bucket
  if (t == null || v == null) return null;
  return { time: t * 1000, valueUsd: v };
}
