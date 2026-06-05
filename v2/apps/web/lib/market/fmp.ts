/**
 * Provider FMP (Financial Modeling Prep) — fundamentos de ações e perfil de empresa.
 *
 * Padrão honesto: fetcher INJETÁVEL (testável sem rede); qualquer falha vira null
 * (degrada graciosamente — o card mostra "indisponível"). Free tier cobre:
 *   - profile (market cap, setor, país, P/E, beta, IPO date)
 *   - ratios TTM (30+ métricas: margens, ROE, P/L, EV/EBITDA, dividend yield…)
 *   - income statement (2 anos: receita, EBITDA, EPS)
 *
 * Upgrade pra Premium ($49/mês) desbloqueia cotações em tempo real de índices
 * globais (DAX, CAC…) e forex — zero mudança de código aqui, só a key.
 *
 * NÃO usar pra cripto — DefiLlama é a fonte específica (TVL on-chain).
 * Aplicável: stocks, (indices, commodities, forex com Premium).
 */
import { withTimeout } from "../http/with-timeout";

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const BASE = "https://financialmodelingprep.com/stable";

export interface FmpFundamental {
  kind: "fmp";
  source: "FMP";
  asOf: number;

  // Perfil
  companyName: string;
  sector?: string;
  industry?: string;
  country?: string;
  marketCapUsd?: number;
  ipoDate?: string;
  employees?: number;

  // Cotação atual
  price?: number;
  priceChangePct?: number;
  beta?: number;

  // Ratios TTM
  peRatioTTM?: number;
  pegRatioTTM?: number;
  pbRatioTTM?: number;
  evEbitdaTTM?: number;
  netMarginTTM?: number;
  grossMarginTTM?: number;
  operatingMarginTTM?: number;
  roeTTM?: number;
  roaTTM?: number;
  debtToEquityTTM?: number;
  currentRatioTTM?: number;
  dividendYieldTTM?: number;
  epsTTM?: number;
  fcfYieldTTM?: number;

  // Income (último ano fiscal)
  revenueLatest?: number;
  netIncomeLatest?: number;
  ebitdaLatest?: number;
  revenueGrowthYoY?: number; // (latest - prev) / prev

  disclaimer: string;
}

async function fetchJson(url: string, fetcher: FetchLike): Promise<unknown> {
  const res = await withTimeout(fetcher(url), 10_000);
  if (!res.ok) throw new Error(`FMP HTTP ${url}`);
  return res.json();
}

function defaultFetch(url: string) {
  return fetch(url) as unknown as Promise<{ ok: boolean; json: () => Promise<unknown> }>;
}

/** Busca fundamentos FMP para um símbolo de ação (ex.: AAPL, NVDA). */
export async function fetchFmpFundamental(
  symbol: string,
  apiKey: string,
  fetcher: FetchLike = defaultFetch,
): Promise<FmpFundamental | null> {
  if (!apiKey || !symbol) return null;
  const sym = symbol.toUpperCase();

  try {
    const [profileRaw, ratiosRaw, metricsRaw, incomeRaw] = await Promise.all([
      fetchJson(`${BASE}/profile?symbol=${sym}&apikey=${apiKey}`, fetcher),
      fetchJson(`${BASE}/ratios-ttm?symbol=${sym}&apikey=${apiKey}`, fetcher),
      fetchJson(`${BASE}/key-metrics-ttm?symbol=${sym}&apikey=${apiKey}`, fetcher),
      fetchJson(`${BASE}/income-statement?symbol=${sym}&period=annual&limit=2&apikey=${apiKey}`, fetcher),
    ]);

    const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as Record<string, unknown> | undefined;
    const ratios = (Array.isArray(ratiosRaw) ? ratiosRaw[0] : ratiosRaw) as Record<string, unknown> | undefined;
    const metrics = (Array.isArray(metricsRaw) ? metricsRaw[0] : metricsRaw) as Record<string, unknown> | undefined;
    const income = Array.isArray(incomeRaw) ? (incomeRaw as Record<string, unknown>[]) : [];

    if (!profile?.symbol) return null;

    const latest = income[0];
    const prev = income[1];
    const revenueLatest = typeof latest?.revenue === "number" ? latest.revenue : undefined;
    const revenuePrev = typeof prev?.revenue === "number" ? prev.revenue : undefined;
    const revenueGrowthYoY =
      revenueLatest != null && revenuePrev != null && revenuePrev !== 0
        ? (revenueLatest - revenuePrev) / Math.abs(revenuePrev)
        : undefined;

    const n = (v: unknown): number | undefined => (typeof v === "number" && isFinite(v) ? v : undefined);

    return {
      kind: "fmp",
      source: "FMP",
      asOf: Date.now(),
      companyName: String(profile.companyName ?? sym),
      sector: typeof profile.sector === "string" ? profile.sector : undefined,
      industry: typeof profile.industry === "string" ? profile.industry : undefined,
      country: typeof profile.country === "string" ? profile.country : undefined,
      marketCapUsd: n(profile.marketCap),
      ipoDate: typeof profile.ipoDate === "string" ? profile.ipoDate : undefined,
      employees: typeof profile.fullTimeEmployees === "string"
        ? parseInt(profile.fullTimeEmployees.replace(/\D/g, ""), 10) || undefined
        : n(profile.fullTimeEmployees),
      price: n(profile.price),
      priceChangePct: n(profile.changePercentage),
      beta: n(profile.beta),

      // Ratios TTM
      peRatioTTM: n(ratios?.priceToEarningsRatioTTM),
      pegRatioTTM: n(ratios?.priceToEarningsGrowthRatioTTM),
      pbRatioTTM: n(ratios?.priceToBookRatioTTM),
      evEbitdaTTM: n(ratios?.enterpriseValueMultipleTTM),
      netMarginTTM: n(ratios?.netProfitMarginTTM),
      grossMarginTTM: n(ratios?.grossProfitMarginTTM),
      operatingMarginTTM: n(ratios?.operatingProfitMarginTTM),
      roeTTM: n(metrics?.returnOnEquityTTM),
      roaTTM: n(metrics?.returnOnAssetsTTM),
      debtToEquityTTM: n(ratios?.debtToEquityRatioTTM),
      currentRatioTTM: n(ratios?.currentRatioTTM),
      dividendYieldTTM: n(ratios?.dividendYieldTTM),
      epsTTM: n(ratios?.netIncomePerShareTTM),
      fcfYieldTTM: n(metrics?.freeCashFlowYieldTTM),

      // Income
      revenueLatest,
      netIncomeLatest: typeof latest?.netIncome === "number" ? latest.netIncome : undefined,
      ebitdaLatest: typeof latest?.ebitda === "number" ? latest.ebitda : undefined,
      revenueGrowthYoY,

      disclaimer:
        "Dados fundamentalistas (FMP). Análise, não recomendação de investimento. Risco de perda.",
    };
  } catch {
    return null;
  }
}
