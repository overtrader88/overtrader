/**
 * POST /api/report — gera o Relatório Executivo em PDF a partir do DTO de análise
 * já calculado na página (o PDF reflete EXATAMENTE o que o usuário vê). Enriquece
 * com candles (gráfico) e narrativa de IA buscados no servidor — ambos opcionais
 * e graciosos. Renderização via @react-pdf/renderer (sem Chromium).
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { renderToBuffer } from "@react-pdf/renderer";
import { AnalysisReport, type ReportCandle } from "@/lib/report/report-document";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { generateNarrative } from "@/lib/analysis/narrative";
import type { FullAnalysis } from "@/lib/analysis/full";
import type { AssetType, Timeframe } from "@tradeai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_TYPES = ["crypto", "forex", "commodities", "indices", "stocks"];
const TFS = ["15m", "1h", "4h", "1d", "1w", "1M"];
const CHART_CANDLES = 120;

function safe(str: string): string {
  return str.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24) || "ativo";
}

/** Busca candles para o gráfico; `undefined` se falhar (o PDF degrada sem gráfico). */
async function loadCandles(symbol: string, assetType: AssetType, timeframe: Timeframe): Promise<ReportCandle[] | undefined> {
  try {
    const candles = await getCandles(symbol, assetType, timeframe, 320, {
      providers: realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY }),
      cache: getMarketCache(),
      cacheTtlSeconds: 60,
      minCandles: 30,
    });
    return candles.slice(-CHART_CANDLES).map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
  } catch {
    return undefined;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "report", 10);
  if (limited) return limited;
  let body: { dto?: FullAnalysis; symbol?: string; assetType?: string; timeframe?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { dto, symbol, assetType, timeframe } = body;
  if (
    !dto || typeof dto !== "object" || !dto.analysis?.signal?.signal ||
    typeof symbol !== "string" || !symbol ||
    typeof assetType !== "string" || !ASSET_TYPES.includes(assetType) ||
    typeof timeframe !== "string" || !TFS.includes(timeframe)
  ) {
    return NextResponse.json({ error: "Parâmetros inválidos para o relatório." }, { status: 400 });
  }

  try {
    // gráfico + narrativa em paralelo; cada falha degrada gracioso.
    const [candles, narrative] = await Promise.all([
      loadCandles(symbol, assetType as AssetType, timeframe as Timeframe),
      generateNarrative(dto).catch(() => null),
    ]);

    const buffer = await renderToBuffer(
      AnalysisReport({ dto, symbol, assetType: assetType as AssetType, timeframe: timeframe as Timeframe, candles, narrative }),
    );
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Overtrader-${safe(symbol)}-${safe(timeframe)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao gerar o PDF." }, { status: 500 });
  }
}
