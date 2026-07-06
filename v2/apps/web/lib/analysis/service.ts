/**
 * Serviço de análise da BORDA — busca candles (providers + cache) e compõe o
 * motor. Compartilhado pela rota `/api/analyze` e pela página de Análise (RSC),
 * para que ambos sigam o mesmo caminho (sem duplicar a orquestração).
 */
import type { AssetType, Timeframe, Candle } from "@tradeai/shared";
import { getHigherTimeframes, type AnalysisInput } from "@tradeai/engine";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { runFullAnalysis, type FullAnalysis } from "./full";

// Janela profunda: o backtest precisa de candles suficientes p/ ≥100 trades
// decisivos (selo honesto). O motor ainda recorta pela janela 24-36m internamente.
export const CANDLE_LIMIT = 3000;
export const MIN_CANDLES = 200;
/** TFs superiores p/ confluência: precisamos só do sinal, então menos candles. */
export const HIGHER_TF_LIMIT = 600;
/**
 * Sazonalidade mensal: série DIÁRIA profunda (independente do TF da análise).
 * ~3000 diários ≈ 8 anos → n≥5 por mês. Candles mensais não servem (1 por mês →
 * retorno 0); intraday cobre só ~1-2 anos. Cache longo: dado diário muda devagar.
 */
export const SEASONALITY_TF: Timeframe = "1d";
export const SEASONALITY_LIMIT = 3000;
/** Heatmap de horários: série 1h profunda (hora × dia precisa de granularidade horária). */
export const SESSION_TF: Timeframe = "1h";
export const SESSION_LIMIT = 2000;

export interface AnalyzeOptions {
  /**
   * Descarta candles EM FORMAÇÃO em TODAS as séries buscadas (TF principal,
   * TFs superiores, sazonalidade, heatmap). Era -j2: ligado SÓ na emissão do
   * track record (cron emit-signals) — a análise passa a operar exatamente a
   * distribuição do backtest (candles fechados). UI/demais rotas seguem "vivas".
   */
  dropForming?: boolean;
}

export async function analyzeSymbol(
  symbol: string,
  assetType: AssetType,
  timeframe: Timeframe,
  type: "simple" | "complete" = "complete",
  opts: AnalyzeOptions = {},
): Promise<FullAnalysis> {
  const dropForming = opts.dropForming ?? false;
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  const candles = await getCandles(symbol, assetType, timeframe, CANDLE_LIMIT, {
    providers, cache, cacheTtlSeconds: 60, minCandles: MIN_CANDLES, dropForming,
  });

  // Confluência multi-TF + sazonalidade (só no modo completo). Buscas em
  // paralelo; cada falha degrada gracioso (multi-TF sem aquele TF; sazonalidade
  // cai para os candles da análise).
  let higherTimeframes: (AnalysisInput | null)[] | undefined;
  let seasonalityCandles: Candle[] | undefined;
  let heatmapCandles: Candle[] | undefined;
  if (type === "complete") {
    const { higher, highest } = getHigherTimeframes(timeframe);
    const fetchTf = async (tf: Timeframe | null): Promise<AnalysisInput | null> => {
      if (!tf) return null;
      try {
        const tfCandles = await getCandles(symbol, assetType, tf, HIGHER_TF_LIMIT, {
          providers, cache, cacheTtlSeconds: 60, minCandles: MIN_CANDLES, dropForming,
        });
        return { symbol, assetType, timeframe: tf, candles: tfCandles };
      } catch {
        return null;
      }
    };
    // Série diária dedicada à sazonalidade; se o TF já é diário, reaproveita.
    const fetchSeasonality = async (): Promise<Candle[] | undefined> => {
      if (timeframe === SEASONALITY_TF) return candles;
      try {
        return await getCandles(symbol, assetType, SEASONALITY_TF, SEASONALITY_LIMIT, {
          providers, cache, cacheTtlSeconds: 3600, minCandles: MIN_CANDLES, dropForming,
        });
      } catch {
        return undefined;
      }
    };
    // Série 1h dedicada ao heatmap de horários; se o TF já é 1h, reaproveita.
    const fetchSessions = async (): Promise<Candle[] | undefined> => {
      if (timeframe === SESSION_TF) return candles;
      try {
        return await getCandles(symbol, assetType, SESSION_TF, SESSION_LIMIT, {
          providers, cache, cacheTtlSeconds: 1800, minCandles: MIN_CANDLES, dropForming,
        });
      } catch {
        return undefined;
      }
    };
    const [tfInputs, seas, heat] = await Promise.all([
      Promise.all([fetchTf(higher), fetchTf(highest)]),
      fetchSeasonality(),
      fetchSessions(),
    ]);
    if (tfInputs.some((x) => x !== null)) higherTimeframes = tfInputs;
    seasonalityCandles = seas;
    heatmapCandles = heat;
  }

  return runFullAnalysis(
    { symbol, assetType, timeframe, candles },
    { generatedAt: Date.now(), type, higherTimeframes, seasonalityCandles, heatmapCandles },
  );
}
