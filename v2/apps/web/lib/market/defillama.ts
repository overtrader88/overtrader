/**
 * Camada FUNDAMENTAL on-chain (cripto) — fonte pública DefiLlama (free, sem key).
 *
 * Mesmo padrão honesto do `fear-greed.ts`: parser PURO + fetcher injetável
 * (testável sem rede). Qualquer falha vira `null` — a tela degrada graciosamente
 * ("indisponível") em vez de quebrar. A UI credita a fonte.
 *
 * Importante (credibilidade-first): TVL é uma série OBSERVADA, não uma amostra
 * estatística. Por isso NÃO usamos `Estimate`/IC aqui — seria pseudo-rigor. O selo
 * técnico (backtest com IC) continua intocado; isto é só CONTEXTO complementar.
 *
 * O DefiLlama é chain/protocolo-cêntrico, não token-cêntrico. O `MAP` traduz cada
 * símbolo do catálogo para a chain ou protocolo correspondente — e diz
 * honestamente quando não há fundamento DeFi mensurável (`null`).
 */
import { withTimeout } from "../http/with-timeout";

export type FundamentalApplicability = "chain" | "protocol" | "limited" | "not_applicable";
export type TvlTrend = "rising" | "stable" | "declining";

export interface FundamentalResult {
  /** Rótulo honesto, igual `kind:"qualitative"` do SMC/harmônicos. */
  kind: "fundamental";
  applicability: FundamentalApplicability;
  source: "DefiLlama";
  /** ms epoch do último ponto observado (0 quando não aplicável). */
  asOf: number;
  /** Métricas OBSERVADAS — só quando aplicável. */
  tvlUsd?: number;
  /** Variação observada do TVL em ~30d (% arredondado a 1 casa). */
  tvlChange30dPct?: number;
  tvlTrend?: TvlTrend;
  /** Observações honestas (ex.: DeFi raso, ativo sem fundamento). */
  notes: string[];
  disclaimer: string;
}

type FundamentalTarget =
  | { kind: "chain"; slug: string; depth?: "limited" }
  | { kind: "protocol"; slug: string };

/**
 * Mapa token → DefiLlama (fonte única da verdade). 34 cripto do catálogo:
 *  - chains (L1/L2): TVL/atividade on-chain como proxy de adoção;
 *  - protocolos DeFi: TVL do protocolo (encaixe mais rico);
 *  - `null`: reserva de valor / pagamento / privacidade / meme — sem fundamento DeFi.
 * `depth:"limited"` marca redes de DeFi raso (TVL pouco representativo).
 */
const MAP: Record<string, FundamentalTarget | null> = {
  // — Chains (L1/L2) —
  ETHUSDT: { kind: "chain", slug: "Ethereum" },
  BNBUSDT: { kind: "chain", slug: "BSC" },
  SOLUSDT: { kind: "chain", slug: "Solana" },
  ADAUSDT: { kind: "chain", slug: "Cardano", depth: "limited" },
  TRXUSDT: { kind: "chain", slug: "Tron" },
  ATOMUSDT: { kind: "chain", slug: "CosmosHub", depth: "limited" },
  MATICUSDT: { kind: "chain", slug: "Polygon" },
  AVAXUSDT: { kind: "chain", slug: "Avalanche" },
  NEARUSDT: { kind: "chain", slug: "Near" },
  APTUSDT: { kind: "chain", slug: "Aptos" },
  ARBUSDT: { kind: "chain", slug: "Arbitrum" },
  OPUSDT: { kind: "chain", slug: "OP Mainnet" },
  SUIUSDT: { kind: "chain", slug: "Sui" },
  ALGOUSDT: { kind: "chain", slug: "Algorand", depth: "limited" },
  VETUSDT: { kind: "chain", slug: "VeChain", depth: "limited" },
  NEOUSDT: { kind: "chain", slug: "NEO", depth: "limited" },
  EOSUSDT: { kind: "chain", slug: "EOS EVM", depth: "limited" },
  ETCUSDT: { kind: "chain", slug: "EthereumClassic", depth: "limited" },
  XLMUSDT: { kind: "chain", slug: "Stellar", depth: "limited" },
  FILUSDT: { kind: "chain", slug: "Filecoin", depth: "limited" },
  // — Protocolos DeFi (TVL atual do protocolo via endpoint leve; sem série 30d) —
  AAVEUSDT: { kind: "protocol", slug: "aave" },
  UNIUSDT: { kind: "protocol", slug: "uniswap" },
  LDOUSDT: { kind: "protocol", slug: "lido" },
  INJUSDT: { kind: "chain", slug: "Injective", depth: "limited" },
  // — Sem fundamento DeFi mensurável (reserva de valor / pagamento / privacidade / meme / oráculo) —
  BTCUSDT: null,
  XRPUSDT: null,
  DOGEUSDT: null,
  LTCUSDT: null,
  BCHUSDT: null,
  XMRUSDT: null,
  DASHUSDT: null,
  SHIBUSDT: null,
  LINKUSDT: null,
  DOTUSDT: null, // DefiLlama não rastreia TVL da relay chain do Polkadot
};

const BASE = "https://api.llama.fi";
const DAY_MS = 86_400_000;
/** ±5% em ~30d define rising/declining; entre eles, stable. */
const TREND_PCT = 5;
const DISCLAIMER =
  "Fundamentos on-chain (DefiLlama): valores OBSERVADOS, não probabilidades. " +
  "Complementam — não substituem — a análise técnica e o selo de qualidade.";

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
// TVL tem granularidade diária: cache agressivo (1h) evita martelar a API.
const defaultFetch: FetchLike = (url) => fetch(url, { next: { revalidate: 3600 } });

export interface TvlPoint {
  /** ms epoch. */
  time: number;
  tvl: number;
}

/** Normaliza uma série bruta `{<dateKey>, <tvlKey>}[]` → pontos ordenados. Null se vazio/malformado. */
function normalizeSeries(raw: unknown, dateKey: string, tvlKey: string): TvlPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const pts: TvlPoint[] = [];
  for (const row of raw) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const dateSec = Number(r[dateKey]);
    const tvl = Number(r[tvlKey]);
    if (!Number.isFinite(dateSec) || !Number.isFinite(tvl)) continue;
    pts.push({ time: dateSec * 1000, tvl });
  }
  if (pts.length === 0) return null;
  pts.sort((a, b) => a.time - b.time);
  return pts;
}

/** Parser PURO do `/v2/historicalChainTvl/{chain}` (array de `{date, tvl}`). */
export function parseChainTvl(payload: unknown): TvlPoint[] | null {
  return normalizeSeries(payload, "date", "tvl");
}

/**
 * Parser PURO do `/tvl/{slug}` — endpoint LEVE (~18 bytes) que devolve só o TVL
 * atual do protocolo (número cru, ou às vezes `{ tvl: number }`). Evitamos o
 * `/protocol/{slug}` (objeto histórico de ~9,7 MB por incluir `tokens`/
 * `tokensInUsd` por dia — os params `exclude*` são pro-only e os slugs filhos
 * não são menores). O custo é não ter série → sem tendência 30d p/ protocolos.
 */
export function parseCurrentTvl(payload: unknown): number | null {
  const n = typeof payload === "object" && payload !== null ? (payload as { tvl?: unknown }).tvl : payload;
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Resume a série em valor atual + variação 30d + tendência (puro). */
export function summarizeTvl(series: TvlPoint[]): Pick<FundamentalResult, "tvlUsd" | "tvlChange30dPct" | "tvlTrend"> {
  const last = series[series.length - 1];
  if (!last) return {};
  const target = last.time - 30 * DAY_MS;
  let prev = series[0]!;
  for (const p of series) {
    if (p.time <= target) prev = p;
    else break;
  }
  if (prev === last || prev.tvl === 0) return { tvlUsd: last.tvl };
  const change = ((last.tvl - prev.tvl) / prev.tvl) * 100;
  const tvlTrend: TvlTrend = change > TREND_PCT ? "rising" : change < -TREND_PCT ? "declining" : "stable";
  return { tvlUsd: last.tvl, tvlChange30dPct: Math.round(change * 10) / 10, tvlTrend };
}

const PROTOCOL_NOTE =
  "TVL atual do protocolo. Tendência 30d indisponível na fonte pública gratuita para protocolos — exibindo só o valor atual.";

/**
 * Busca o fundamento de um símbolo. Retorna:
 *  - `null` — símbolo fora do catálogo cripto, ou falha (rede/timeout/parse): degrada gracioso;
 *  - `{applicability:"not_applicable"}` — cripto sem fundamento DeFi (honesto, não inventa número);
 *  - chains: TVL + variação 30d + tendência (série leve `/v2/historicalChainTvl`);
 *  - protocolos: só TVL atual (endpoint leve `/tvl/{slug}`; histórico custaria ~9,7 MB).
 */
export async function fetchFundamental(symbol: string, fetcher: FetchLike = defaultFetch): Promise<FundamentalResult | null> {
  const target = MAP[symbol.toUpperCase()];
  if (target === undefined) return null; // não é cripto do catálogo
  if (target === null) {
    return {
      kind: "fundamental",
      applicability: "not_applicable",
      source: "DefiLlama",
      asOf: 0,
      notes: ["Ativo sem fundamentos DeFi mensuráveis (reserva de valor / pagamento / privacidade / meme / oráculo)."],
      disclaimer: DISCLAIMER,
    };
  }
  try {
    if (target.kind === "protocol") {
      // Endpoint LEVE: só o número atual (18 bytes vs 9,7 MB do histórico).
      const res = await withTimeout(fetcher(`${BASE}/tvl/${encodeURIComponent(target.slug)}`), 5000);
      if (!res.ok) return null;
      const tvlUsd = parseCurrentTvl(await res.json());
      if (tvlUsd === null) return null;
      return {
        kind: "fundamental",
        applicability: "protocol",
        source: "DefiLlama",
        asOf: 0, // o endpoint leve não traz timestamp do ponto
        tvlUsd,
        notes: [PROTOCOL_NOTE],
        disclaimer: DISCLAIMER,
      };
    }
    // chain: série leve → TVL + variação 30d + tendência.
    const res = await withTimeout(fetcher(`${BASE}/v2/historicalChainTvl/${encodeURIComponent(target.slug)}`), 5000);
    if (!res.ok) return null;
    const series = parseChainTvl(await res.json());
    if (!series) return null;
    const limited = target.depth === "limited";
    return {
      kind: "fundamental",
      applicability: limited ? "limited" : "chain",
      source: "DefiLlama",
      asOf: series[series.length - 1]!.time,
      ...summarizeTvl(series),
      notes: limited ? ["DeFi raso nesta rede — TVL pouco representativo; leia como contexto fraco."] : [],
      disclaimer: DISCLAIMER,
    };
  } catch {
    return null;
  }
}

export type Convergence = "converge" | "diverge" | "neutro";

/**
 * Cruza o viés técnico com a tendência fundamental — PURO, não toca o motor nem o
 * selo. É o diferencial: "sinal de COMPRA + TVL subindo = convergência".
 */
export function fundamentalConvergence(bias: "buy" | "sell" | "neutral", f: FundamentalResult | null): Convergence {
  if (!f || f.applicability === "not_applicable" || !f.tvlTrend || bias === "neutral") return "neutro";
  if (f.tvlTrend === "stable") return "neutro";
  if (bias === "buy") return f.tvlTrend === "rising" ? "converge" : "diverge";
  return f.tvlTrend === "declining" ? "converge" : "diverge";
}
