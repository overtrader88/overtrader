/**
 * Emissão de sinal para o track record forward (Fase C4). Carimba um sinal SÓ
 * quando ele é de QUALIDADE — direção acionável + selo verde/amarelo. O RPC
 * `record_signal` deduplica (1 sinal aberto por símbolo+TF). Best-effort: nunca
 * lança (não pode derrubar a análise nem o cron).
 */
import { signalSide } from "@tradeai/shared";
import { ENGINE_VERSION, DEFAULT_ENGINE_CONFIG } from "@tradeai/engine";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import type { FullAnalysis } from "@/lib/analysis/full";
import { computeClassReading, buildClassPlan, type ClassExtras } from "@/lib/analysis/engines";
import { conditionalDirection, invertDirection } from "@/lib/analysis/position-stress";
import { generateLlmDecision, generateLlmDecisionDS, generateLlmDecisionSurv, generateLlmDecisionDsSurv, generateLlmDecisionVsf, generateLlmDecisionDsVsf, generateLlmDecisionVsfSurv, generateLlmDecisionDsVsfSurv, generateEvoDecision, breedEvoCore, EVO_SEED_CORES, type LlmDecision } from "@/lib/analysis/narrative";
import { replayBank, type BankState } from "./survival";

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

/** Stop dos motores LLM: ATR ×1.4 — o forward mostrou (padrão vs padrão-B e o
 *  Contrário TAMBÉM negativo) que o stop ×1.0 fica dentro do ruído e stopa os
 *  dois lados. Mudança versionada no engineVersion (~a14). */
const LLM_ATR_SCALE = 1.4;

/** Estado da banca de sobrevivência do motor (replay dos resolvidos). `null` = sem histórico/DB.
 *  `sinceIso` restringe aos sinais emitidos após a data — usado pela EVOLUÇÃO (a banca
 *  de um núcleo conta só a partir do nascimento dele). */
export async function fetchBank(engine: string, sinceIso?: string): Promise<BankState | null> {
  const sb = supabaseService();
  if (!sb) return null;
  try {
    let q = sb
      .from("signals")
      .select("pnl_r, direction")
      .eq("engine", engine)
      .not("outcome", "is", null)
      .not("resolved_at", "is", null);
    if (sinceIso) q = q.gte("emitted_at", sinceIso);
    const { data, error } = await q.order("resolved_at", { ascending: true }).limit(500);
    if (error || !data?.length) return null;
    return replayBank(data.map((r) => ({ pnlR: Number(r.pnl_r ?? 0), direction: String(r.direction ?? "") })));
  } catch {
    return null;
  }
}

/**
 * Plano por NÍVEL (família VSF): o stop vai atrás do nível que JUSTIFICA o trade
 * (compra → abaixo do suporte: order block bullish / liquidez / VAL; venda →
 * espelhado), com folga de 0.25×ATR. Alvos preservam a estrutura de RR da casa
 * (mesmos ratios tp/sl do computeRiskFrom). Guarda-corpo: stop entre 0.6 e 2.5
 * ATR do preço; fora disso devolve null e o chamador cai no plano ATR (~a14fb).
 */
function buildVsfPlan(dto: FullAnalysis, side: "buy" | "sell"): { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number } | null {
  const entry = dto.analysis?.risk?.entry;
  if (!entry || !(entry > 0)) return null;
  const atrVal = dto.atr && dto.atr > 0 ? dto.atr : dto.analysis.meta?.atrRatio ? dto.analysis.meta.atrRatio * entry : 0;
  if (!(atrVal > 0)) return null;
  const smc = dto.smc;
  const vp = dto.volumeProfile;
  const levels: number[] = [];
  if (side === "buy") {
    for (const o of smc?.orderBlocks ?? []) if (o.type === "bullish" && o.zoneBottom < entry) levels.push(o.zoneBottom);
    for (const z of smc?.liquidityZones ?? []) if (z.type === "sell_stops_below" && z.level < entry) levels.push(z.level);
    if (vp && vp.val < entry) levels.push(vp.val);
  } else {
    for (const o of smc?.orderBlocks ?? []) if (o.type === "bearish" && o.zoneTop > entry) levels.push(o.zoneTop);
    for (const z of smc?.liquidityZones ?? []) if (z.type === "buy_stops_above" && z.level > entry) levels.push(z.level);
    if (vp && vp.vah > entry) levels.push(vp.vah);
  }
  if (levels.length === 0) return null;
  const buffer = atrVal * 0.25;
  // nível protegido mais PRÓXIMO do preço (maior suporte abaixo / menor resistência acima)
  const stopLoss = side === "buy" ? Math.max(...levels) - buffer : Math.min(...levels) + buffer;
  const dist = Math.abs(entry - stopLoss);
  if (dist < atrVal * 0.6 || dist > atrVal * 2.5) return null;
  const { slMult, tp1Mult, tp2Mult, tp3Mult } = DEFAULT_ENGINE_CONFIG.risk;
  const k = dist / slMult; // mantém os RRs da casa com o stop ancorado no nível
  const dir = side === "buy" ? 1 : -1;
  return {
    entry, stopLoss,
    takeProfit1: entry + dir * k * tp1Mult,
    takeProfit2: entry + dir * k * tp2Mult,
    takeProfit3: entry + dir * k * tp3Mult,
  };
}

/**
 * MOTOR LLM (experimental, forward): a DECISÃO (direção + convicção) é da LLM, a
 * partir dos dados brutos (independente do Motor 1). Plano determinístico:
 * ATR ×1.4 (~a14) ou, na família VSF, stop por nível (~lvl; fallback ~a14fb).
 * Carimba quando: lado acionável + convicção ≥ 60. Sem backtest (seal 'yellow').
 * Gate idêntico entre provedores → experimento controlado da DECISÃO.
 * A convicção e o racional são persistidos no sinal (colunas da migration 0014;
 * best-effort — sem elas o update falha silencioso e nada quebra).
 */
async function emitLlmWith(
  decide: () => Promise<LlmDecision | null>, engine: string, engineVersion: string,
  dto: FullAnalysis, symbol: string, assetType: AssetType, timeframe: Timeframe,
  useLevelPlan = false,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const dec = await decide();
  if (!dec) return { reason: "error", id: null }; // IA indisponível/falha (ou key ausente)
  if (dec.side === "neutral") return { reason: "neutral", id: null };
  if (dec.conviction < 60) return { reason: "low-conviction", id: null };
  let plan = useLevelPlan ? buildVsfPlan(dto, dec.side) : null;
  const planTag = plan ? "~lvl" : useLevelPlan ? "~a14fb" : "~a14";
  if (!plan) plan = buildClassPlan(dto, dec.side, LLM_ATR_SCALE);
  if (!plan) return { reason: "no-geometry", id: null };
  const direction: SignalDirection = dec.side === "buy"
    ? (dec.conviction >= 80 ? "STRONG_BUY" : "BUY")
    : (dec.conviction >= 80 ? "STRONG_SELL" : "SELL");
  const res = await recordVariant({
    symbol, assetType, timeframe, direction, side: dec.side, seal: "yellow", plan,
    regime: dto.analysis.meta?.regime ?? null, engine, engineVersion: `${engineVersion}${planTag}`,
  });
  if (res.reason === "emitted" && res.id) {
    try {
      await supabaseService()?.from("signals").update({ conviction: dec.conviction, rationale: dec.rationale || null }).eq("id", res.id);
    } catch { /* colunas ainda não migradas — segue sem persistir */ }
  }
  return res;
}

/** MOTOR LLM·GPT — decisão da OpenAI (gpt-4.1). */
export function emitLlmSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecision(dto, assetType, extras), "llm", `${ENGINE_VERSION}+llm`, dto, symbol, assetType, timeframe);
}

/** MOTOR LLM·DS — decisão da DeepSeek (V4-Pro). No-op gracioso sem DEEPSEEK_API_KEY. */
export function emitLlmDsSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionDS(dto, assetType, extras), "llm_ds", `${ENGINE_VERSION}+llm-ds`, dto, symbol, assetType, timeframe);
}

/** MOTOR SOBREVIVÊNCIA·GPT — mentalidade de capital finito + FEEDBACK da banca real. */
export async function emitLlmSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_surv");
  return emitLlmWith(() => generateLlmDecisionSurv(dto, assetType, extras, bank), "llm_surv", `${ENGINE_VERSION}+surv`, dto, symbol, assetType, timeframe);
}

/** MOTOR SOBREVIVÊNCIA·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export async function emitLlmDsSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_ds_surv");
  return emitLlmWith(() => generateLlmDecisionDsSurv(dto, assetType, extras, bank), "llm_ds_surv", `${ENGINE_VERSION}+ds-surv`, dto, symbol, assetType, timeframe);
}

/** MOTOR VSF·GPT — volume + S/R + Fibonacci; stop ancorado no nível (~lvl). */
export function emitLlmVsfSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionVsf(dto, assetType, extras), "llm_vsf", `${ENGINE_VERSION}+vsf`, dto, symbol, assetType, timeframe, true);
}

/** MOTOR VSF·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export function emitLlmDsVsfSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionDsVsf(dto, assetType, extras), "llm_ds_vsf", `${ENGINE_VERSION}+ds-vsf`, dto, symbol, assetType, timeframe, true);
}

/** MOTOR VSF+SOBREVIVÊNCIA·GPT — níveis + capital finito + feedback da banca. */
export async function emitLlmVsfSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_vsf_surv");
  return emitLlmWith(() => generateLlmDecisionVsfSurv(dto, assetType, extras, bank), "llm_vsf_surv", `${ENGINE_VERSION}+vsf-surv`, dto, symbol, assetType, timeframe, true);
}

/** Slot da EVOLUÇÃO (linha da tabela evo_engines). */
export interface EvoSlot { slot: string; provider: "gpt" | "ds"; core: string; generation: number; born_at: string }

/**
 * Ciclo de vida darwiniano — roda 1× por execução do cron, ANTES das emissões:
 * 1) semeia a geração 1 se a tabela estiver vazia;
 * 2) para cada slot, calcula a banca do núcleo VIGENTE (sinais desde born_at);
 * 3) banca quebrou (deaths>0) → CRUZA o núcleo morto com o do outro slot e
 *    renasce como geração+1 (mutação). Falha no cruzamento → renasce igual.
 * Best-effort: sem tabela (antes da migration 0015) devolve [] e nada quebra.
 */
export async function prepareEvoSlots(): Promise<EvoSlot[]> {
  const sb = supabaseService();
  if (!sb) return [];
  try {
    const first = await sb.from("evo_engines").select("slot, provider, core, generation, deaths, born_at");
    if (first.error) return []; // tabela ausente (migration pendente)
    let data = first.data;
    if (!data || data.length === 0) {
      const ins = await sb.from("evo_engines").insert([
        { slot: "evo_gpt", provider: "gpt", core: EVO_SEED_CORES.gpt, generation: 1, parents: "semente g1" },
        { slot: "evo_ds", provider: "ds", core: EVO_SEED_CORES.ds, generation: 1, parents: "semente g1" },
      ]).select("slot, provider, core, generation, deaths, born_at");
      data = ins.data ?? [];
    }
    const rows = (data ?? []) as (EvoSlot & { deaths: number })[];
    for (const s of rows) {
      const bank = await fetchBank(s.slot, s.born_at);
      if (!bank || bank.deaths === 0) continue; // núcleo vivo
      const other = rows.find((o) => o.slot !== s.slot);
      const deathCtx = `Pior queda ${bank.maxDrawdownPct}% do pico; últimos trades: ${bank.lastResults.join("") || "—"}; ${bank.lifeTrades} trades na vida final.`;
      const child = await breedEvoCore(s.core, other?.core ?? s.core, s.provider, deathCtx);
      const core = child && child.length > 40 ? child.slice(0, 2000) : s.core; // cruzamento falhou → renasce igual
      const nowIso = new Date().toISOString();
      await sb.from("evo_engines").update({
        core, generation: s.generation + 1, deaths: s.deaths + 1,
        parents: `g${s.generation} × ${other?.slot ?? "clone"}`, born_at: nowIso, updated_at: nowIso,
      }).eq("slot", s.slot);
      s.core = core; s.generation += 1; s.born_at = nowIso;
    }
    return rows.map(({ slot, provider, core, generation, born_at }) => ({ slot, provider, core, generation, born_at }));
  } catch {
    return [];
  }
}

/** MOTOR EVOLUTIVO — decide com o núcleo VIGENTE do slot (nascido no cruzamento).
 *  A banca do núcleo (desde born_at) vai no prompt; a morte é tratada no cron. */
export async function emitEvoSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe, slot: EvoSlot,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank(slot.slot, slot.born_at);
  return emitLlmWith(
    () => generateEvoDecision(slot.core, slot.provider, dto, assetType, extras, bank),
    slot.slot, `${ENGINE_VERSION}+evo-g${slot.generation}`, dto, symbol, assetType, timeframe,
  );
}

/** MOTOR VSF+SOBREVIVÊNCIA·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export async function emitLlmDsVsfSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_ds_vsf_surv");
  return emitLlmWith(() => generateLlmDecisionDsVsfSurv(dto, assetType, extras, bank), "llm_ds_vsf_surv", `${ENGINE_VERSION}+ds-vsf-surv`, dto, symbol, assetType, timeframe, true);
}

/* =====================================================================
 * NOVOS MOTORES EXPERIMENTAIS (forward) — todos determinísticos, derivados
 * do dto que o cron já computa (zero I/O novo). Cada um responde UMA
 * pergunta falsificável; o track record por motor é o juiz.
 * ===================================================================== */

/**
 * MOTOR CONDICIONAL (experimental, forward): a tese do `conditional.ts` —
 * trend-following SÓ em tendência, fade de extremos SÓ em lateral, neutro em
 * transição/explosão — que está DESLIGADA no motor de produção. Gate seletivo:
 * ≥4 dos 5 checks do regime concordando. Plano ATR padrão (geometria constante
 * entre os motores = experimento controlado da DECISÃO). A decisão em si vive
 * em `position-stress.ts` (compartilhada com o stress test da posição).
 */
export async function emitConditionalSignal(
  dto: FullAnalysis, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const dir = conditionalDirection(dto);
  if (!dir) return { reason: "no-geometry", id: null };
  const side = signalSide(dir);
  if (side === "neutral") return { reason: "neutral", id: null };
  const plan = buildClassPlan(dto, side);
  if (!plan) return { reason: "no-geometry", id: null };
  return recordVariant({
    symbol, assetType, timeframe, direction: dir, side, seal: "yellow", plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "condicional", engineVersion: `${ENGINE_VERSION}+cond`,
  });
}

/**
 * MOTOR CONTRÁRIO (controle experimental): emite EXATAMENTE quando o Motor 1
 * emite (mesmo gate: acionável + selo verde/amarelo), no lado OPOSTO, com o
 * mesmo plano ATR espelhado. É o braço-placebo do A/B: se ele vencer o padrão
 * de forma consistente, a decisão direcional atual é pior que o acaso —
 * kill-criterion objetivo da configuração. Selo próprio 'yellow' (o backtest
 * do Motor 1 não valida o inverso).
 */
export async function emitContrarianSignal(
  dto: FullAnalysis, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const side = signalSide(dto.analysis.signal.signal);
  if (side === "neutral") return { reason: "neutral", id: null };
  const seal = dto.quality?.status;
  if (seal !== "green" && seal !== "yellow") return { reason: "low-seal", id: null };
  const invSide = side === "buy" ? "sell" as const : "buy" as const;
  const plan = buildClassPlan(dto, invSide);
  if (!plan) return { reason: "no-geometry", id: null };
  return recordVariant({
    symbol, assetType, timeframe, direction: invertDirection(dto.analysis.signal.signal), side: invSide, seal: "yellow", plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "contrario", engineVersion: `${ENGINE_VERSION}+inv`,
  });
}

/**
 * MOTOR CONSENSO (experimental, forward): só emite quando os DOIS motores
 * independentes concordam — Motor 1 acionável+selado E leitura por classe no
 * MESMO lado com convicção ≥15. Testa se a interseção filtra melhor que cada
 * um sozinho (menos sinais, maior qualidade?). Direção/selo do Motor 1 (o
 * consenso é um SUBCONJUNTO dos sinais dele — o backtest segue válido).
 */
export async function emitConsensusSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const side = signalSide(dto.analysis.signal.signal);
  if (side === "neutral") return { reason: "neutral", id: null };
  const seal = dto.quality?.status;
  if (seal !== "green" && seal !== "yellow") return { reason: "low-seal", id: null };
  const reading = computeClassReading(dto, assetType, extras);
  if (reading.side !== side || Math.abs(reading.score - 50) < 15) return { reason: "low-conviction", id: null };
  const plan = buildClassPlan(dto, side);
  if (!plan) return { reason: "no-geometry", id: null };
  return recordVariant({
    symbol, assetType, timeframe, direction: dto.analysis.signal.signal, side, seal, plan,
    regime: dto.analysis.meta?.regime ?? null, engine: "consenso", engineVersion: `${ENGINE_VERSION}+consenso`,
  });
}
