/**
 * GET /api/quotes?symbols=BTCUSDT,ETHUSDT — preço atual + variação % do dia por
 * símbolo, para os tickers do dashboard. Deriva de getCandles (1d, cacheado),
 * resolvendo a classe de ativo pelo catálogo. Sem `symbols` → DEFAULT_TICKERS.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { DEFAULT_TICKERS, findAsset, type Quote } from "@/lib/market/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "quotes", 60);
  if (limited) return limited;
  const url = new URL(req.url);
  const param = url.searchParams.get("symbols");
  const symbols = param
    ? param.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20)
    : DEFAULT_TICKERS;

  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();

  const quotes: Quote[] = await Promise.all(
    symbols.map(async (symbol): Promise<Quote> => {
      const asset = findAsset(symbol);
      if (!asset) return { symbol, error: "símbolo fora do catálogo" };
      try {
        const candles = await getCandles(symbol, asset.assetType, "1d", 3, {
          providers,
          cache,
          cacheTtlSeconds: 120,
          minCandles: 2,
        });
        const lastC = candles.at(-1);
        const prev = candles.at(-2);
        if (!lastC || !prev) return { symbol, name: asset.name, assetType: asset.assetType, error: "sem dados" };
        const price = lastC.close;
        const changePct = prev.close ? ((price - prev.close) / prev.close) * 100 : 0;
        return { symbol, name: asset.name, assetType: asset.assetType, price, changePct };
      } catch (e) {
        return { symbol, name: asset.name, assetType: asset.assetType, error: e instanceof Error ? e.message : "falha" };
      }
    }),
  );

  return NextResponse.json({ quotes });
}
