/**
 * Provedor de notícias alternativo — NewsData.io (endpoint /latest).
 *
 * Mesma interface `NewsItem` do World News API (intercambiável via NEWS_PROVIDER).
 * Key em `NEWSDATA_API_KEY`. Free: 200 créditos/dia, delay 12h, **uso comercial OK**,
 * porém **sem sentimento** (sentiment é pago) → `sentiment: 0`. Para tickers B3
 * (terminam em dígito, ex.: PETR4) usa `language=pt` + `country=br` p/ relevância.
 */
import type { AssetType } from "@tradeai/shared";
import { withTimeout } from "../http/with-timeout";
import { symbolToQuery, type NewsItem, type FetchNewsOptions } from "./world-news";

const BASE = "https://newsdata.io/api/1/latest";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

function toEpoch(s: unknown): number {
  if (typeof s !== "string") return 0;
  const ms = Date.parse(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : 0;
}

/** NewsData entrega sentimento como rótulo (só no pago); mapeia p/ número. Ausente → 0. */
function sentimentToNum(s: unknown): number {
  return s === "positive" ? 0.5 : s === "negative" ? -0.5 : 0;
}

/** B3 (tickers terminam em dígito) → notícia em PT do Brasil; senão inglês. */
function localeParams(symbol: string, assetType: AssetType): Record<string, string> {
  if (assetType === "stocks" && /\d$/.test(symbol)) return { language: "pt", country: "br" };
  return { language: "en" };
}

/** Parser PURO da resposta do /latest. */
export function parseNewsData(payload: unknown, limit = 8): NewsItem[] {
  if (typeof payload !== "object" || payload === null) return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const items: NewsItem[] = [];
  for (const raw of results) {
    if (typeof raw !== "object" || raw === null) continue;
    const a = raw as { title?: unknown; link?: unknown; source_name?: unknown; source_id?: unknown; pubDate?: unknown; sentiment?: unknown };
    if (typeof a.title !== "string" || typeof a.link !== "string") continue;
    const source = typeof a.source_name === "string" ? a.source_name : typeof a.source_id === "string" ? a.source_id : hostOf(a.link);
    items.push({ title: a.title, url: a.link, source, publishedAt: toEpoch(a.pubDate), sentiment: sentimentToNum(a.sentiment) });
    if (items.length >= limit) break;
  }
  return items;
}

/** Busca notícias do ativo no NewsData.io. Sem key ou falha → []. */
export async function fetchNewsData(symbol: string, assetType: AssetType, opts: FetchNewsOptions = {}): Promise<NewsItem[]> {
  const apiKey = opts.apiKey ?? process.env.NEWSDATA_API_KEY;
  if (!apiKey) return [];
  const limit = opts.limit ?? 8;
  const fetcher = opts.fetcher ?? ((url) => fetch(url, { next: { revalidate: 900 } }));
  const url = new URL(BASE);
  url.searchParams.set("apikey", apiKey);
  // qInTitle (não q): só artigos com o termo no TÍTULO → muito mais relevante p/ o ativo.
  url.searchParams.set("qInTitle", symbolToQuery(symbol, assetType));
  for (const [k, v] of Object.entries(localeParams(symbol, assetType))) url.searchParams.set(k, v);
  try {
    const res = await withTimeout(fetcher(url.toString()), 6000);
    if (!res.ok) return [];
    return parseNewsData(await res.json(), limit);
  } catch {
    return [];
  }
}
