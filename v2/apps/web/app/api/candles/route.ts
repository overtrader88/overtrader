/**
 * GET /api/candles?symbol&type&tf — janela recente de OHLC para o gráfico.
 * Reusa o getCandles (providers + cache). Tempo em SEGUNDOS (formato lightweight-charts),
 * ascendente e sem duplicatas. 502 se o provedor falhar.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import type { AssetType, Timeframe } from "@tradeai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_TYPES: readonly string[] = ["crypto", "forex", "commodities", "indices", "stocks"];
const TFS: readonly string[] = ["15m", "1h", "4h", "1d", "1w", "1M"];
const CHART_CANDLES = 240;

export async function GET(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "candles", 60);
  if (limited) return limited;
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol ausente" }, { status: 400 });

  const tfRaw = searchParams.get("tf") ?? "";
  const timeframe: Timeframe = (TFS.includes(tfRaw) ? tfRaw : "4h") as Timeframe;
  const typeRaw = searchParams.get("type") ?? "";
  const assetType: AssetType = (ASSET_TYPES.includes(typeRaw) ? typeRaw : "crypto") as AssetType;

  try {
    const candles = await getCandles(symbol, assetType, timeframe, 320, {
      providers: realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY }),
      cache: getMarketCache(),
      cacheTtlSeconds: 60,
      minCandles: 30,
    });
    // ascendente, sem duplicatas de tempo (lightweight-charts exige), em segundos.
    const seen = new Set<number>();
    const out = candles
      .slice(-CHART_CANDLES)
      .map((c) => ({ time: Math.floor(c.time / 1000), open: c.open, high: c.high, low: c.low, close: c.close }))
      .filter((c) => (seen.has(c.time) ? false : (seen.add(c.time), true)))
      .sort((a, b) => a.time - b.time);
    return NextResponse.json({ candles: out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao buscar candles." }, { status: 502 });
  }
}
