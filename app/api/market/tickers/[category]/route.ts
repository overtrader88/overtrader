/**
 * GET /api/market/tickers/[category]
 *
 * Retorna snapshot de tickers de uma categoria.
 *   - crypto:  via Binance REST (gratis, sem limites praticos)
 *   - forex / commodities / stocks / indices: via Twelve Data (free tier 8 req/min)
 *
 * Frontend chama 1x e depois faz polling a cada 60s.
 * Os simbolos sao curadoria fixa por categoria (FEATURED_BY_CATEGORY).
 */
import { NextResponse } from "next/server";

import { getAsset } from "@/lib/market";

interface FeaturedAsset {
  symbol: string;
  display: string;
  emoji: string;
}

// Crypto: 8 ativos (Binance e gratuito e suporta batch endpoint - sem rate limit pratico)
//   → grid 2x4 no desktop fica visualmente cheio
// Demais: 4 ativos (limite do free tier TwelveData = 8 req/min)
//   → grid 1x4 limpo, sem desperdicio
export const FEATURED_BY_CATEGORY: Record<string, FeaturedAsset[]> = {
  crypto: [
    { symbol: "BTCUSDT", display: "BTC", emoji: "₿" },
    { symbol: "ETHUSDT", display: "ETH", emoji: "Ξ" },
    { symbol: "SOLUSDT", display: "SOL", emoji: "◎" },
    { symbol: "BNBUSDT", display: "BNB", emoji: "🟡" },
    { symbol: "XRPUSDT", display: "XRP", emoji: "✕" },
    { symbol: "ADAUSDT", display: "ADA", emoji: "₳" },
    { symbol: "DOGEUSDT", display: "DOGE", emoji: "🐕" },
    { symbol: "AVAXUSDT", display: "AVAX", emoji: "🔺" },
  ],
  forex: [
    { symbol: "EURUSD", display: "EUR/USD", emoji: "🇪🇺" },
    { symbol: "GBPUSD", display: "GBP/USD", emoji: "🇬🇧" },
    { symbol: "USDJPY", display: "USD/JPY", emoji: "🇯🇵" },
    { symbol: "AUDUSD", display: "AUD/USD", emoji: "🇦🇺" },
  ],
  commodities: [
    { symbol: "XAUUSD", display: "Ouro", emoji: "🥇" },
    { symbol: "XAGUSD", display: "Prata", emoji: "🥈" },
    { symbol: "WTIUSD", display: "WTI", emoji: "🛢️" },
    { symbol: "BRNUSD", display: "Brent", emoji: "⛽" },
  ],
  stocks: [
    { symbol: "AAPL", display: "AAPL", emoji: "🍎" },
    { symbol: "MSFT", display: "MSFT", emoji: "🪟" },
    { symbol: "NVDA", display: "NVDA", emoji: "🟢" },
    { symbol: "TSLA", display: "TSLA", emoji: "🚗" },
  ],
  // Indices: TwelveData free tier NAO cobre SPX/NDX/DJI diretamente.
  // Usamos ETFs equivalentes que sao cobertos no free tier.
  indices: [
    { symbol: "SPY", display: "S&P 500 (SPY)", emoji: "🇺🇸" },
    { symbol: "QQQ", display: "Nasdaq (QQQ)", emoji: "💻" },
    { symbol: "DIA", display: "Dow Jones (DIA)", emoji: "📊" },
    { symbol: "EWZ", display: "Brasil (EWZ)", emoji: "🇧🇷" },
  ],
};

interface BinanceTickerResp {
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
}

interface TickerOut {
  symbol: string;
  display: string;
  emoji: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

/**
 * Cripto via Binance batch endpoint (1 request, todos os symbols).
 */
async function fetchCryptoBatch(
  assets: FeaturedAsset[]
): Promise<TickerOut[]> {
  const symbols = assets.map((a) => a.symbol);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = (await res.json()) as Array<
    BinanceTickerResp & { symbol: string }
  >;

  const map = new Map(data.map((d) => [d.symbol, d]));
  return assets.map((a) => {
    const d = map.get(a.symbol);
    return {
      symbol: a.symbol,
      display: a.display,
      emoji: a.emoji,
      price: d ? parseFloat(d.lastPrice) : 0,
      change24h: d ? parseFloat(d.priceChangePercent) : 0,
      high24h: d ? parseFloat(d.highPrice) : 0,
      low24h: d ? parseFloat(d.lowPrice) : 0,
    };
  });
}

/**
 * Twelve Data — usa o endpoint batch /quote com multiplos symbols separados
 * por virgula. Cobra apenas 1 credito por batch (independente do n de symbols),
 * o que e crucial pra economizar a cota do free tier (800/dia, 8/min).
 *
 * Doc: https://twelvedata.com/docs#real-time-quote (Bulk request)
 */
async function fetchTwelveBatch(
  assets: FeaturedAsset[]
): Promise<TickerOut[]> {
  const key = process.env.TWELVEDATA_API_KEY;
  if (!key) {
    throw new Error(
      "TWELVEDATA_API_KEY nao configurado. Cadastre-se em https://twelvedata.com."
    );
  }

  // Resolve sourceSymbol de cada asset via catalogo (ex: XAUUSD -> XAU/USD)
  const sourceSymbols = assets.map((a) => {
    const meta = getAsset(a.symbol);
    return meta?.sourceSymbol ?? a.symbol;
  });

  // Endpoint batch — TD aceita ate 120 symbols comma-separated em 1 call
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", sourceSymbols.join(","));
  url.searchParams.set("apikey", key);
  url.searchParams.set("format", "JSON");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`TwelveData /quote batch: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Record<string, unknown> | unknown;

  // Quando ha apenas 1 symbol, TD retorna objeto direto.
  // Quando ha N symbols, retorna { "SYM1": {...}, "SYM2": {...} }.
  // Tambem pode retornar { status: "error", message: "..." } se a key invalida.
  interface QuoteData {
    symbol?: string;
    close?: string;
    percent_change?: string;
    high?: string;
    low?: string;
    status?: string;
    message?: string;
  }

  function parseQuote(q: QuoteData | undefined): {
    price: number;
    change24h: number;
    high24h: number;
    low24h: number;
  } | null {
    if (!q || q.status === "error" || !q.close) return null;
    return {
      price: parseFloat(q.close),
      change24h: q.percent_change ? parseFloat(q.percent_change) : 0,
      high24h: q.high ? parseFloat(q.high) : 0,
      low24h: q.low ? parseFloat(q.low) : 0,
    };
  }

  // Erro global do TD (key invalida, batch fora do plano, etc)
  if (
    data &&
    typeof data === "object" &&
    "status" in data &&
    (data as QuoteData).status === "error"
  ) {
    throw new Error(
      `TwelveData erro: ${(data as QuoteData).message ?? "resposta invalida"}`
    );
  }

  return assets.map((a, i) => {
    const sourceSymbol = sourceSymbols[i];

    // TD pode devolver direto (1 symbol) ou keyed por sourceSymbol (N symbols)
    let raw: QuoteData | undefined;
    if (assets.length === 1) {
      raw = data as QuoteData;
    } else {
      raw = (data as Record<string, QuoteData>)[sourceSymbol];
    }

    const parsed = parseQuote(raw);
    if (!parsed) {
      console.warn(
        `[tickers] sem dados para ${a.symbol} (${sourceSymbol}):`,
        raw?.message ?? "TD nao retornou cotacao"
      );
      return {
        symbol: a.symbol,
        display: a.display,
        emoji: a.emoji,
        price: 0,
        change24h: 0,
        high24h: 0,
        low24h: 0,
      };
    }

    return {
      symbol: a.symbol,
      display: a.display,
      emoji: a.emoji,
      ...parsed,
    };
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params;

  const assets = FEATURED_BY_CATEGORY[category];
  if (!assets) {
    return NextResponse.json(
      { error: `Categoria invalida: ${category}` },
      { status: 400 }
    );
  }

  try {
    const tickers =
      category === "crypto"
        ? await fetchCryptoBatch(assets)
        : await fetchTwelveBatch(assets);

    return NextResponse.json(
      { ok: true, category, tickers, generatedAt: Date.now() },
      {
        status: 200,
        headers: {
          // Cache server-side por 5min + serve stale por mais 10min em background.
          // Reduz drasticamente consumo do free tier TwelveData (800 calls/dia).
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro ao buscar tickers",
        detail: err instanceof Error ? err.message : "unknown",
        category,
      },
      { status: 500 }
    );
  }
}
