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
import { generateLlmDecision } from "@/lib/analysis/narrative";

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
 * Emissão do MOTOR 2 ("por classe") — TOTALMENTE INDEPENDENTE do Motor 1. A
 * decisão (lado, convicção) e o plano (ATR) são do próprio Motor 2; nada vem da
 * direção, do plano ou do selo do Motor 1. Carimba quando: lado acionável +
 * convicção ≥ 15pts + há ATR p/ montar o plano. Motor 2 não tem backtest próprio,
 * então `seal='yellow'` (ressalva, não verde) e bt_* nulos — o track record
 * forward por motor é que mede a calibração.
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

  // Motor 2 não usa o selo do Motor 1 — decide pela própria convicção. Selo
  // próprio = 'yellow' (sem backtest dedicado; honesto, não-verde).
  const seal = "yellow";

  const plan = buildClassPlan(dto, reading.side);
  if (!plan) return { reason: "no-geometry", id: null }; // sem ATR/preço p/ montar o plano
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

/** Carimba um sinal de VARIANTE experimental (engine custom, sem backtest próprio). */
async function recordVariant(p: {
  symbol: string; assetType: AssetType; timeframe: Timeframe;
  direction: SignalDirection; side: "buy" | "sell"; seal: string;
  plan: { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number };
  regime: string | null; engine: string; engineVersion: string;
}): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const sb = supabaseService();
  if (!sb) return { reason: "no-db", id: null };
  try {
    const { data, error } = await sb.rpc("record_signal", {
      p_symbol: p.symbol, p_asset_type: p.assetType, p_timeframe: p.timeframe,
      p_direction: p.direction, p_seal: p.seal, p_side: p.side,
      p_entry: p.plan.entry, p_stop: p.plan.stopLoss, p_tp1: p.plan.takeProfit1, p_tp2: p.plan.takeProfit2, p_tp3: p.plan.takeProfit3,
      p_regime: p.regime, p_engine_version: p.engineVersion, p_bt_pf: null, p_bt_wr: null, p_bt_n: null, p_engine: p.engine,
    });
    if (error) return { reason: "error", id: null };
    return data == null ? { reason: "open-exists", id: null } : { reason: "emitted", id: String(data) };
  } catch {
    return { reason: "error", id: null };
  }
}

/**
 * VARIANTE Padrão-B (experimental, forward A/B): mesma DIREÇÃO do Motor 1, mas
 * plano com stop/alvos mais largos (ATR ×1.4) — testa gestão de risco. Mesmo gate
 * do Motor 1 (selo verde/amarelo + direção acionável). Sem backtest do plano novo.
 */
export async function emitSignalB(
  dto: FullAnalysis, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const side = signalSide(dto.analysis.signal.signal);
  if (side === "neutral") return { reason: "neutral", id: null };
  const seal = dto.quality?.status;
  if (seal !== "green" && seal !== "yellow") return { reason: "low-seal", id: null };
  const plan = buildClassPlan(dto, side, 1.4);
  if (!plan) return { reason: "no-geometry", id: null };
  return recordVariant({
    symbol, assetType, timeframe, direction: dto.analysis.signal.signal, side, seal, plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "padrao_b", engineVersion: `${ENGINE_VERSION}+B`,
  });
}

/**
 * VARIANTE Classe-B (experimental, forward A/B): leitura por classe com gate de
 * convicção mais ALTO (≥20pts) + plano ATR ×1.4 — testa seletividade + espaço pro
 * trade. Independente do Motor 1; selo próprio 'yellow' (sem backtest).
 */
export async function emitClassSignalB(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const reading = computeClassReading(dto, assetType, extras);
  if (reading.side === "neutral") return { reason: "neutral", id: null };
  if (Math.abs(reading.score - 50) < 20) return { reason: "low-conviction", id: null };
  const plan = buildClassPlan(dto, reading.side, 1.4);
  if (!plan) return { reason: "no-geometry", id: null };
  const direction: SignalDirection = reading.side === "buy"
    ? (reading.score >= 70 ? "STRONG_BUY" : "BUY")
    : (reading.score <= 30 ? "STRONG_SELL" : "SELL");
  return recordVariant({
    symbol, assetType, timeframe, direction, side: reading.side, seal: "yellow", plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "classe_b", engineVersion: `${ENGINE_VERSION}+classe-B`,
  });
}

/**
 * MOTOR LLM (experimental, forward): a DECISÃO (direção + convicção) é da LLM, a
 * partir dos dados brutos (independente do Motor 1). Plano por ATR (determinístico).
 * Carimba quando: lado acionável + convicção ≥ 60. Sem backtest (seal 'yellow').
 */
export async function emitLlmSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const dec = await generateLlmDecision(dto, assetType, extras);
  if (!dec) return { reason: "error", id: null }; // IA indisponível/falha
  if (dec.side === "neutral") return { reason: "neutral", id: null };
  if (dec.conviction < 60) return { reason: "low-conviction", id: null };
  const plan = buildClassPlan(dto, dec.side);
  if (!plan) return { reason: "no-geometry", id: null };
  const direction: SignalDirection = dec.side === "buy"
    ? (dec.conviction >= 80 ? "STRONG_BUY" : "BUY")
    : (dec.conviction >= 80 ? "STRONG_SELL" : "SELL");
  return recordVariant({
    symbol, assetType, timeframe, direction, side: dec.side, seal: "yellow", plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "llm", engineVersion: `${ENGINE_VERSION}+llm`,
  });
}
