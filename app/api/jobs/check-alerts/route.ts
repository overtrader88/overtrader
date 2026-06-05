/**
 * POST /api/jobs/check-alerts
 *
 * Job periodico que percorre toda a watchlist do sistema, roda analise
 * leve em cada par (asset, timeframe), e cria alert se o sinal atual
 * cumpre o threshold do usuario E mudou desde o ultimo alert.
 *
 * Como rodar:
 *   - Vercel Cron (cron.json no projeto)
 *   - Supabase pg_cron chamando este endpoint
 *   - Manualmente via curl com header X-Cron-Secret
 *
 * Seguranca:
 *   - Aceita header X-Cron-Secret com valor CRON_SECRET do .env
 *   - Sem secret, retorna 401
 *
 * Performance:
 *   - Processa ate MAX_BATCH watchlist items por execucao
 *   - Atualiza last_checked_at pra distribuir carga ao longo do tempo
 *   - Bate cache da Binance/TwelveData (revalidate: 60)
 */
import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { getCandles, getAsset } from "@/lib/market";
import { runAnalysis } from "@/lib/analysis/engine";
import { signalSide } from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";

const MAX_BATCH = 50;

/**
 * Hierarquia de forca dos sinais BUY (numeros maiores = mais forte)
 * Usado pra comparar com min_signal_strength da watchlist
 */
const BUY_STRENGTH: Record<string, number> = {
  WEAK_BUY: 1,
  BUY: 2,
  STRONG_BUY: 3,
};

const SELL_STRENGTH: Record<string, number> = {
  WEAK_SELL: 1,
  SELL: 2,
  STRONG_SELL: 3,
};

interface WatchlistRow {
  id: string;
  user_id: string;
  asset: string;
  asset_type: "crypto" | "forex" | "stocks" | "indices" | "commodities";
  timeframe: "15m" | "1h" | "4h" | "1d" | "1w" | "1M";
  min_signal_strength: "WEAK_BUY" | "BUY" | "STRONG_BUY";
  last_alerted_signal: string | null;
}

function meetsThreshold(
  currentSignal: SignalDirection,
  minThreshold: "WEAK_BUY" | "BUY" | "STRONG_BUY"
): boolean {
  const minLevel = BUY_STRENGTH[minThreshold] ?? 3;

  // BUY side
  if (BUY_STRENGTH[currentSignal]) {
    return BUY_STRENGTH[currentSignal] >= minLevel;
  }
  // SELL side — usa mesmo nivel espelhado (STRONG_BUY threshold => alerta STRONG_SELL)
  if (SELL_STRENGTH[currentSignal]) {
    return SELL_STRENGTH[currentSignal] >= minLevel;
  }
  return false;
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret) {
    console.error("[check-alerts] CRON_SECRET nao configurado");
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado" },
      { status: 500 }
    );
  }
  if (provided !== secret) {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 401 }
    );
  }

  const t0 = Date.now();
  const supabase = createServiceClient();

  // Pega os watchlist items menos checados recentemente
  const { data: watchItems, error: fetchErr } = await supabase
    .from("watchlist")
    .select(
      "id, user_id, asset, asset_type, timeframe, min_signal_strength, last_alerted_signal"
    )
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(MAX_BATCH);

  if (fetchErr) {
    return NextResponse.json(
      { error: "Erro ao buscar watchlist", detail: fetchErr.message },
      { status: 500 }
    );
  }

  if (!watchItems || watchItems.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      alertsCreated: 0,
      durationMs: Date.now() - t0,
    });
  }

  let alertsCreated = 0;
  const errors: string[] = [];

  for (const item of watchItems as WatchlistRow[]) {
    try {
      const meta = getAsset(item.asset);
      if (!meta) {
        errors.push(`Asset ${item.asset} nao encontrado`);
        continue;
      }

      const candles = await getCandles(item.asset, item.timeframe, 250);
      if (candles.length < 60) {
        errors.push(`${item.asset} ${item.timeframe}: poucos candles`);
        continue;
      }

      const result = runAnalysis({
        symbol: item.asset,
        assetType: meta.type,
        timeframe: item.timeframe,
        candles,
      });

      const currentSignal = result.signal.signal;
      const hasDirection = signalSide(currentSignal) !== "neutral";

      // Atualiza last_checked_at sempre (mesmo sem alert)
      await supabase
        .from("watchlist")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", item.id);

      // Verifica se deve disparar alert
      if (!hasDirection) continue;
      if (!meetsThreshold(currentSignal, item.min_signal_strength)) continue;
      // Anti-spam: nao re-alerta se sinal e o mesmo
      if (item.last_alerted_signal === currentSignal) continue;

      // Cria alert
      const { error: insErr } = await supabase.from("alerts").insert({
        user_id: item.user_id,
        asset: item.asset,
        timeframe: item.timeframe,
        signal: currentSignal,
        strength: result.signal.strength,
        confluence: result.signal.confluence,
        entry: result.risk.entry,
        stop_loss: result.risk.stopLoss,
        take_profit1: result.risk.takeProfit1,
        message: result.explanation.summary,
      });

      if (insErr) {
        errors.push(`Insert alert falhou: ${insErr.message}`);
        continue;
      }

      // Atualiza last_alerted_signal pra evitar repetir
      await supabase
        .from("watchlist")
        .update({ last_alerted_signal: currentSignal })
        .eq("id", item.id);

      alertsCreated++;
    } catch (err) {
      errors.push(
        `${item.asset} ${item.timeframe}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    processed: watchItems.length,
    alertsCreated,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    durationMs: Date.now() - t0,
  });
}

// Aceita GET tb pra teste manual e health check
export async function GET(req: Request) {
  return POST(req);
}
