/**
 * POST /api/backtest — backtest SOB DEMANDA parametrizável (Fase B3). O usuário
 * escolhe estratégia / período / perfil de R:R; aqui buscamos candles (cacheados)
 * e rodamos `runBacktest` com as opções. CPU puro — sem LLM, sem API por trade.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { runBacktest, computeQualityBanner, DEFAULT_ENGINE_CONFIG, type EngineConfig } from "@tradeai/engine";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { toBacktestView, equityFromTrades } from "@/lib/analysis/backtest-view";
import { isStrategy, riskPresetById, monthsToCandles, PERIOD_OPTIONS } from "@/lib/analysis/backtest-params";
import type { AssetType, Timeframe } from "@tradeai/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSET_TYPES = ["crypto", "forex", "commodities", "indices", "stocks"];
const TFS = ["15m", "1h", "4h", "1d", "1w", "1M"];
const SCAN_LIMIT = 3000;

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "backtest", 20);
  if (limited) return limited;
  let body: { symbol?: string; assetType?: string; timeframe?: string; strategy?: string; months?: number; riskPresetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { symbol, assetType, timeframe, strategy, months, riskPresetId } = body;
  if (
    typeof symbol !== "string" || !symbol ||
    typeof assetType !== "string" || !ASSET_TYPES.includes(assetType) ||
    typeof timeframe !== "string" || !TFS.includes(timeframe) ||
    !isStrategy(strategy) ||
    typeof months !== "number" || !(PERIOD_OPTIONS as readonly number[]).includes(months) ||
    typeof riskPresetId !== "string"
  ) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const at = assetType as AssetType;
  const tf = timeframe as Timeframe;

  try {
    const candles = await getCandles(symbol, at, tf, SCAN_LIMIT, {
      providers: realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY }),
      cache: getMarketCache(),
      cacheTtlSeconds: 300,
      minCandles: 200,
    });

    const preset = riskPresetById(riskPresetId);
    // Sobrepõe os multiplicadores de risco (R:R). Como o usuário ESCOLHEU este
    // perfil, baixamos o gate de R:R mínimo para não rejeitar o próprio perfil:
    // "Alvo curto · R:R 1:1" tem rr1=1.0, abaixo do minRr1 padrão (1.5), o que
    // antes zerava TODAS as entradas. Math.min nunca AUMENTA o gate.
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      risk: { slMult: preset.slMult, tp1Mult: preset.tp1Mult, tp2Mult: preset.tp2Mult, tp3Mult: preset.tp3Mult },
      gates: { ...DEFAULT_ENGINE_CONFIG.gates, minRr1: Math.min(DEFAULT_ENGINE_CONFIG.gates.minRr1, preset.rr) },
    };

    const bt = runBacktest(
      { symbol, assetType: at, timeframe: tf, candles },
      { strategy, config, maxCandlesToScan: monthsToCandles(at, tf, months) },
    );

    return NextResponse.json({
      backtest: toBacktestView(bt),
      quality: computeQualityBanner(bt),
      equityCurve: equityFromTrades(bt.trades),
      params: { strategy, months, riskPresetId, rr: preset.rr },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao rodar o backtest." }, { status: 502 });
  }
}
