/**
 * Provedores de noticias e sentimento macro.
 *
 * Estrategia hibrida (free-first):
 *   - Cripto      : CryptoPanic (free 500/dia, ja tem sentiment scoring)
 *   - Forex/Stocks/Indices/Commodities: NewsAPI.org (free 100/dia)
 *
 * Cache compartilhado via market_cache (TTL 15min) — multiplos usuarios pegam
 * mesma resposta.
 *
 * Fail-safe: se uma fonte falha, retorna lista vazia (nao quebra a analise).
 */

import type { AssetType } from "@/lib/market";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  /** ISO timestamp */
  publishedAt: string;
  /** "positive" | "negative" | "neutral" | "important" — quando o provider fornece */
  sentiment?: "positive" | "negative" | "neutral" | "important";
  /** Texto curto, geralmente o lead da noticia */
  summary?: string;
}

// ============================================================
// CRYPTOPANIC (Cripto)
// ============================================================

interface CryptoPanicResp {
  results?: Array<{
    title: string;
    url: string;
    published_at: string;
    domain?: string;
    source?: { domain?: string };
    votes?: {
      positive?: number;
      negative?: number;
      important?: number;
    };
    metadata?: { description?: string };
  }>;
}

/**
 * Mapeia o asset interno (ex: BTCUSDT) para o codigo da moeda no CryptoPanic.
 * BTCUSDT -> BTC, ETHUSDT -> ETH
 */
function symbolToCryptoCode(symbol: string): string {
  return symbol.replace(/USDT$/, "").replace(/USD$/, "").toUpperCase();
}

export async function fetchCryptoPanicNews(
  symbol: string,
  limit = 10
): Promise<NewsItem[]> {
  const key = process.env.CRYPTOPANIC_API_KEY;
  if (!key) {
    console.warn("[news] CRYPTOPANIC_API_KEY nao configurada");
    return [];
  }

  const code = symbolToCryptoCode(symbol);
  const url = new URL("https://cryptopanic.com/api/v1/posts/");
  url.searchParams.set("auth_token", key);
  url.searchParams.set("currencies", code);
  url.searchParams.set("public", "true");
  url.searchParams.set("kind", "news"); // exclui media/blog

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 900 }, // 15 min cache
    });
    if (!res.ok) return [];
    const data = (await res.json()) as CryptoPanicResp;

    return (data.results ?? []).slice(0, limit).map((p) => {
      const votes = p.votes ?? {};
      let sentiment: NewsItem["sentiment"] = "neutral";
      if ((votes.important ?? 0) > 0) sentiment = "important";
      else if ((votes.positive ?? 0) > (votes.negative ?? 0)) sentiment = "positive";
      else if ((votes.negative ?? 0) > (votes.positive ?? 0)) sentiment = "negative";

      return {
        title: p.title,
        url: p.url,
        source: p.source?.domain ?? p.domain ?? "cryptopanic.com",
        publishedAt: p.published_at,
        sentiment,
        summary: p.metadata?.description,
      };
    });
  } catch (err) {
    console.warn("[news] cryptopanic falhou:", err);
    return [];
  }
}

// ============================================================
// NEWSAPI.ORG (Forex/Stocks/Indices/Commodities)
// ============================================================

interface NewsApiResp {
  articles?: Array<{
    title: string;
    url: string;
    description?: string;
    publishedAt: string;
    source?: { name?: string };
  }>;
}

/**
 * Mapeia asset pro query do NewsAPI.
 * AAPL -> "Apple stock"
 * EURUSD -> "EUR USD forex"
 * XAUUSD -> "gold price"
 */
function symbolToNewsQuery(symbol: string, assetType: AssetType): string {
  const sym = symbol.toUpperCase();
  if (assetType === "stocks") {
    const stockMap: Record<string, string> = {
      AAPL: "Apple stock",
      MSFT: "Microsoft stock",
      NVDA: "NVIDIA",
      TSLA: "Tesla",
      GOOGL: "Google stock",
      AMZN: "Amazon stock",
    };
    return stockMap[sym] ?? `${sym} stock`;
  }
  if (assetType === "commodities") {
    const commMap: Record<string, string> = {
      XAUUSD: "gold price",
      XAGUSD: "silver price",
      WTIUSD: "WTI crude oil",
      BRNUSD: "Brent oil",
      XPTUSD: "platinum price",
    };
    return commMap[sym] ?? sym;
  }
  if (assetType === "forex") {
    return sym.replace(/(\w{3})(\w{3})/, "$1/$2 forex");
  }
  if (assetType === "indices") {
    const idxMap: Record<string, string> = {
      SPY: "S&P 500",
      QQQ: "Nasdaq",
      DIA: "Dow Jones",
      EWZ: "Brazil stocks",
    };
    return idxMap[sym] ?? sym;
  }
  return sym;
}

export async function fetchNewsApiNews(
  symbol: string,
  assetType: AssetType,
  limit = 10
): Promise<NewsItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) {
    console.warn("[news] NEWSAPI_KEY nao configurada");
    return [];
  }

  const query = symbolToNewsQuery(symbol, assetType);
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("apiKey", key);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NewsApiResp;

    return (data.articles ?? []).slice(0, limit).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source?.name ?? "newsapi",
      publishedAt: a.publishedAt,
      summary: a.description ?? undefined,
      sentiment: "neutral",
    }));
  } catch (err) {
    console.warn("[news] newsapi falhou:", err);
    return [];
  }
}

// ============================================================
// PERFIS X (Twitter) — curadoria hardcoded
// ============================================================

/**
 * Lista curada de perfis X relevantes por categoria.
 * Mostrada como links no card de noticias — usuario clica e ve o perfil.
 *
 * Pra integracao automatizada (ler tweets) precisaria de API paga.
 * Por enquanto: links + nome + descricao breve.
 */
export const CURATED_X_PROFILES: Record<
  AssetType,
  Array<{ handle: string; name: string; bio: string; topic: string }>
> = {
  crypto: [
    { handle: "WClementeIII", name: "Will Clemente", bio: "On-chain analyst", topic: "Análise on-chain BTC" },
    { handle: "plan_market", name: "PlanB", bio: "S2F creator", topic: "Stock-to-Flow" },
    { handle: "CryptoCred", name: "CryptoCred", bio: "Educator", topic: "Análise técnica" },
    { handle: "TheCryptoLark", name: "Lark Davis", bio: "Trader/Educator", topic: "Cripto news" },
    { handle: "AltcoinDaily", name: "Altcoin Daily", bio: "News", topic: "Notícias cripto" },
    { handle: "Augusto_Backes", name: "Augusto Backes", bio: "BR cripto", topic: "Notícias Brasil" },
    { handle: "bitcoinminstrel", name: "BTC Brasil", bio: "BR community", topic: "Comunidade BR" },
  ],
  stocks: [
    { handle: "LizAnnSonders", name: "Liz Ann Sonders", bio: "Schwab Chief Strategist", topic: "Macro EUA" },
    { handle: "WSJmarkets", name: "WSJ Markets", bio: "Wall Street Journal", topic: "Mercados globais" },
    { handle: "Bastter", name: "Bastter", bio: "Investidor BR", topic: "B3 / longo prazo" },
    { handle: "TmoneyJoao", name: "João T. Money", bio: "Trader BR", topic: "Day trade B3" },
  ],
  forex: [
    { handle: "LiveSquawk", name: "LiveSquawk", bio: "FX news", topic: "Forex em tempo real" },
    { handle: "DailyFX", name: "DailyFX", bio: "IG Group", topic: "Análise forex" },
    { handle: "ForexLive", name: "ForexLive", bio: "FX news", topic: "Macro forex" },
  ],
  commodities: [
    { handle: "PeterSchiff", name: "Peter Schiff", bio: "Gold bull", topic: "Ouro e prata" },
    { handle: "javierblas", name: "Javier Blas", bio: "Bloomberg energy", topic: "Petróleo e energia" },
    { handle: "GoldTelegraph_", name: "Gold Telegraph", bio: "Metals", topic: "Metais preciosos" },
  ],
  indices: [
    { handle: "ZH_NewsTraders", name: "ZeroHedge Markets", bio: "Macro news", topic: "Macro global" },
    { handle: "lisaabramowicz1", name: "Lisa Abramowicz", bio: "Bloomberg", topic: "Renda fixa + macro" },
    { handle: "MercadoNomeio", name: "Mercado no Meio", bio: "BR macro", topic: "Ibovespa" },
  ],
};

// ============================================================
// FUNCAO UNIFICADA
// ============================================================

/**
 * Busca noticias do asset (free-tier friendly).
 * Roteamento:
 *   crypto → CryptoPanic
 *   forex/stocks/indices/commodities → NewsAPI
 */
export async function fetchAssetNews(
  symbol: string,
  assetType: AssetType,
  limit = 10
): Promise<NewsItem[]> {
  if (assetType === "crypto") {
    return fetchCryptoPanicNews(symbol, limit);
  }
  return fetchNewsApiNews(symbol, assetType, limit);
}
