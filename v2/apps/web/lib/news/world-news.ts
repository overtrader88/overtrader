/**
 * Provedor de notícias — World News API (worldnewsapi.com), endpoint /search-news.
 *
 * Busca por keyword (mapeada do símbolo) e retorna artigos com `sentiment` (-1..+1,
 * EN/DE; 0 quando ausente). Key em `WORLDNEWS_API_KEY`. Fetcher injetável (testável
 * sem rede). Sem key ou falha → lista vazia (a análise segue). Honesto: o card
 * credita a fonte; um único provedor cobre cripto e mercados tradicionais por busca.
 */
import type { AssetType } from "@tradeai/shared";
import { withTimeout } from "../http/with-timeout";

export interface NewsItem {
  title: string;
  url: string;
  /** host derivado da URL (ex.: coindesk.com). */
  source: string;
  /** ms epoch (0 se desconhecido). */
  publishedAt: number;
  /** Sentimento do provedor, -1..+1 (0 se ausente). */
  sentiment: number;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const BASE = "https://api.worldnewsapi.com/search-news";

/** Mapeia (símbolo, classe) → texto de busca relevante. */
export function symbolToQuery(symbol: string, assetType: AssetType): string {
  const s = symbol.toUpperCase();
  if (assetType === "crypto") {
    const base = s.replace(/USDT$/, "").replace(/USD$/, "");
    const names: Record<string, string> = {
      BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", XRP: "XRP", BNB: "BNB",
      ADA: "Cardano", DOGE: "Dogecoin", AVAX: "Avalanche", LINK: "Chainlink",
    };
    return names[base] ?? base;
  }
  if (assetType === "forex") return `${s.replace(/(\w{3})(\w{3})/, "$1/$2")} forex`;
  if (assetType === "commodities") {
    const m: Record<string, string> = {
      XAUUSD: "gold price", XAGUSD: "silver price", WTIUSD: "crude oil price", BRNUSD: "Brent oil price",
    };
    return m[s] ?? s;
  }
  if (assetType === "indices") {
    const m: Record<string, string> = {
      SPX: "S&P 500", NDX: "Nasdaq 100", IBOV: "Ibovespa", DAX: "DAX index", DJI: "Dow Jones",
    };
    return m[s] ?? s;
  }
  // stocks
  const m: Record<string, string> = {
    AAPL: "Apple stock", TSLA: "Tesla stock", MSFT: "Microsoft stock", NVDA: "NVIDIA stock",
    PETR4: "Petrobras", VALE3: "Vale mining", ITUB4: "Itaú Unibanco", BBDC4: "Bradesco",
  };
  return m[s] ?? `${s} stock`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

/** "2024-01-01 12:00:00" (sem TZ) ou ISO → ms epoch (UTC). 0 se inválido. */
function toEpoch(s: unknown): number {
  if (typeof s !== "string") return 0;
  const norm = s.includes("T") ? s : `${s.replace(" ", "T")}Z`;
  const ms = Date.parse(norm);
  return Number.isFinite(ms) ? ms : 0;
}

/** Parser PURO da resposta do /search-news. */
export function parseWorldNews(payload: unknown, limit = 8): NewsItem[] {
  if (typeof payload !== "object" || payload === null) return [];
  const news = (payload as { news?: unknown }).news;
  if (!Array.isArray(news)) return [];
  const items: NewsItem[] = [];
  for (const raw of news) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as { title?: unknown; url?: unknown; publish_date?: unknown; sentiment?: unknown };
    if (typeof a.title !== "string" || typeof a.url !== "string") continue;
    const sentiment =
      typeof a.sentiment === "number" && Number.isFinite(a.sentiment) ? Math.max(-1, Math.min(1, a.sentiment)) : 0;
    items.push({ title: a.title, url: a.url, source: hostOf(a.url), publishedAt: toEpoch(a.publish_date), sentiment });
    if (items.length >= limit) break;
  }
  return items;
}

export interface FetchNewsOptions {
  apiKey?: string;
  fetcher?: FetchLike;
  limit?: number;
}

/** Busca notícias do ativo. Sem key ou qualquer falha → []. */
export async function fetchNews(symbol: string, assetType: AssetType, opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const apiKey = opts.apiKey ?? process.env.WORLDNEWS_API_KEY;
  if (!apiKey) return [];
  const limit = opts.limit ?? 8;
  const fetcher = opts.fetcher ?? ((url) => fetch(url, { next: { revalidate: 900 } }));
  const url = new URL(BASE);
  // Sem sort por recência → ranking por RELEVÂNCIA (corta o ruído de mercado geral).
  url.searchParams.set("text", symbolToQuery(symbol, assetType));
  url.searchParams.set("number", String(limit));
  url.searchParams.set("api-key", apiKey);
  try {
    const res = await withTimeout(fetcher(url.toString()), 6000);
    if (!res.ok) return [];
    return parseWorldNews(await res.json(), limit);
  } catch {
    return [];
  }
}

export interface NewsSentiment {
  overall: "bullish" | "bearish" | "neutral" | "mixed";
  /** média dos scores dos artigos com sentimento (-1..+1, arredondada). */
  score: number;
  /** quantos artigos traziam sentimento do provedor (≠ 0). */
  scored: number;
  count: number;
}

/**
 * Agrega o sentimento dos artigos — PURO, custo ZERO (usa os scores que o provedor
 * já entrega). `neutral` quando nenhum artigo tem score (ex.: notícias em PT, que o
 * provedor não pontua). Honesto: expõe `scored`/`count` p/ a UI comunicar a base.
 */
export function aggregateSentiment(items: NewsItem[]): NewsSentiment {
  const count = items.length;
  const scored = items.filter((i) => i.sentiment !== 0);
  if (scored.length === 0) return { overall: "neutral", score: 0, scored: 0, count };
  const avg = scored.reduce((s, i) => s + i.sentiment, 0) / scored.length;
  const pos = scored.filter((i) => i.sentiment > 0.15).length;
  const neg = scored.filter((i) => i.sentiment < -0.15).length;
  let overall: NewsSentiment["overall"];
  if (pos > 0 && neg > 0 && Math.abs(pos - neg) <= 1) overall = "mixed";
  else if (avg > 0.15) overall = "bullish";
  else if (avg < -0.15) overall = "bearish";
  else overall = "neutral";
  return { overall, score: Math.round(avg * 100) / 100, scored: scored.length, count };
}
