/**
 * Emissão de sinal para o track record forward (Fase C4). Carimba um sinal SÓ
 * quando ele é de QUALIDADE — direção acionável + selo verde/amarelo. O RPC
 * `record_signal` deduplica (1 sinal aberto por símbolo+TF). Best-effort: nunca
 * lança (não pode derrubar a análise nem o cron).
 */
import { signalSide } from "@tradeai/shared";
import { ENGINE_VERSION } from "@tradeai/engine";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import type { FullAnalysis } from "@/lib/analysis/full";
import { computeClassReading, buildClassPlan, type ClassExtras } from "@/lib/analysis/engines";

export type EmitReason = "emitted" | "neutral" | "low-seal" | "open-exists" | "no-db" | "error";
export type ClassEmitReason = EmitReason | "low-conviction" | "no-geometry";

export interface EmitResult {
  reason: EmitReason;
  /** id do sinal carimbado (só quando `reason === "emitted"`). */
  id: string | null;
}

export async function emitSignal(
  dto: FullAnalysis,
  symbol: string,
  assetType: AssetType,
  timeframe: Timeframe,
): Promise<EmitResult> {
  const side = signalSide(dto.analysis.signal.signal);
  if (side === "neutral") return { reason: "neutral", id: null };
  const seal = dto.quality?.status;
  // Só carimba sinais que o backtest SUSTENTA (verde) ou sustenta com ressalva (amarelo).
  if (seal !== "green" && seal !== "yellow") return { reason: "low-seal", id: null };

  const sb = supabaseService();
  if (!sb) return { reason: "no-db", id: null };

  const r = dto.analysis.risk;
  const bt = dto.backtest;
  try {
    const { data, error } = await sb.rpc("record_signal", {
      p_symbol: symbol,
      p_asset_type: assetType,
      p_timeframe: timeframe,
      p_direction: dto.analysis.signal.signal,
      p_seal: seal,
      p_side: side,
      p_entry: r.entry,
      p_stop: r.stopLoss,
      p_tp1: r.takeProfit1,
      p_tp2: r.takeProfit2,
      p_tp3: r.takeProfit3,
      p_regime: dto.analysis.meta?.regime ?? null,
      p_engine_version: ENGINE_VERSION,
      p_bt_pf: bt?.profitFactor.value ?? null,
      p_bt_wr: bt?.winRate.value ?? null,
      p_bt_n: bt?.decisiveTrades ?? null,
    });
    if (error) return { reason: "error", id: null };
    return data == null ? { reason: "open-exists", id: null } : { reason: "emitted", id: String(data) };
  } catch {
    return { reason: "error", id: null };
  }
}

/**
 * Emissão do MOTOR 2 ("por classe"). A leitura por classe dá lado + convicção; o
 * plano operacional (entrada/stop/TPs) reusa a geometria ATR do motor principal
 * ESPELHADA para o lado do Motor 2 (as distâncias são simétricas por construção).
 * Carimba só quando: lado acionável + convicção ≥ 15pts + selo técnico verde/
 * amarelo (mesma régua de qualidade) + há geometria de risco (Motor 1 direcional).
 * Motor 2 não tem backtest próprio → bt_* ficam nulos (o forward é que vai medir).
 */
export async function emitClassSignal(
  dto: FullAnalysis,
  extras: ClassExtras,
  symbol: string,
  assetType: AssetType,
  timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const reading = computeClassReading(dto, assetType, extras);
  if (reading.side === "neutral") return { reason: "neutral", id: null };
  if (Math.abs(reading.score - 50) < 15) return { reason: "low-conviction", id: null };

  const seal = dto.quality?.status;
  if (seal !== "green" && seal !== "yellow") return { reason: "low-seal", id: null };

  const plan = buildClassPlan(dto, reading.side);
  if (!plan) return { reason: "no-geometry", id: null }; // sem entrada/ATR p/ montar o plano
  const { entry, stopLoss: stop, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3 } = plan;
  const direction: SignalDirection = reading.side === "buy"
    ? (reading.score >= 70 ? "STRONG_BUY" : "BUY")
    : (reading.score <= 30 ? "STRONG_SELL" : "SELL");

  const sb = supabaseService();
  if (!sb) return { reason: "no-db", id: null };
  try {
    const { data, error } = await sb.rpc("record_signal", {
      p_symbol: symbol,
      p_asset_type: assetType,
      p_timeframe: timeframe,
      p_direction: direction,
      p_seal: seal,
      p_side: reading.side,
      p_entry: entry,
      p_stop: stop,
      p_tp1: tp1,
      p_tp2: tp2,
      p_tp3: tp3,
      p_regime: dto.analysis.meta?.regime ?? null,
      p_engine_version: `${ENGINE_VERSION}+classe`,
      p_bt_pf: null,
      p_bt_wr: null,
      p_bt_n: null,
      p_engine: "classe",
    });
    if (error) return { reason: "error", id: null };
    return data == null ? { reason: "open-exists", id: null } : { reason: "emitted", id: String(data) };
  } catch {
    return { reason: "error", id: null };
  }
}
