/**
 * Emissão de sinal para o track record forward (Fase C4). Carimba um sinal SÓ
 * quando ele é de QUALIDADE — direção acionável + selo verde/amarelo. O RPC
 * `record_signal` deduplica (1 sinal aberto por símbolo+TF). Best-effort: nunca
 * lança (não pode derrubar a análise nem o cron).
 */
import { signalSide, isActionable } from "@tradeai/shared";
import { ENGINE_VERSION, DEFAULT_ENGINE_CONFIG } from "@tradeai/engine";
import type { AssetType, Timeframe, SignalDirection } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import type { FullAnalysis } from "@/lib/analysis/full";
import { computeClassReading, buildClassPlan, type ClassExtras } from "@/lib/analysis/engines";
import { conditionalDirection, invertDirection } from "@/lib/analysis/position-stress";
import { generateLlmDecision, generateLlmDecisionDS, generateLlmDecisionSurv, generateLlmDecisionDsSurv, generateLlmDecisionVsf, generateLlmDecisionDsVsf, generateLlmDecisionVsfSurv, generateLlmDecisionDsVsfSurv, generateEvoDecision, generateLlmShadowSamples, breedEvoCore, EVO_SEED_CORES, type LlmDecision, type ShadowSample } from "@/lib/analysis/narrative";
import { replayBank, type BankState } from "./survival";

/** `weak` (era -j2): sinal rebaixado pelos gates críticos (WEAK_*) — o próprio
 *  motor declarou o plano insuficiente; não entra mais no track record. */
export type EmitReason = "emitted" | "neutral" | "weak" | "low-seal" | "open-exists" | "no-db" | "error";
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
  // Gates críticos com dente (era -j2): WEAK_* (rebaixado pelos gates A/D) tem
  // lado mas NÃO é acionável — não entra no track record com o plano que o
  // próprio motor reprovou. O tally do cron mede quanto é filtrado.
  if (!isActionable(dto.analysis.signal.signal)) return { reason: "weak", id: null };
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
 * DESAFIO HUMANOS vs MÁQUINAS: carimba um sinal de competidor HUMANO no MESMO
 * track record forward dos motores. A decisão e o plano (entrada/stop/tp1-3)
 * são MANUAIS (informados pelo admin no form); a resolução é do mesmo cron
 * resolve-signals — mesmas regras, mesmo juiz. `engine = "humano_<slug>"`,
 * selo 'yellow' (sem backtest — como toda variante sem histórico próprio).
 */
export function emitHumanSignal(p: {
  slug: string; symbol: string; assetType: AssetType; timeframe: Timeframe;
  side: "buy" | "sell"; strong?: boolean;
  plan: { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number };
}): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const direction: SignalDirection = p.side === "buy"
    ? (p.strong ? "STRONG_BUY" : "BUY")
    : (p.strong ? "STRONG_SELL" : "SELL");
  return recordVariant({
    symbol: p.symbol, assetType: p.assetType, timeframe: p.timeframe,
    direction, side: p.side, seal: "yellow", plan: p.plan,
    regime: null, engine: `humano_${p.slug}`, engineVersion: "humano-v1",
  });
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
  // Mesmo gate do Motor 1 (era -j2): WEAK_* não emite — pareamento A/B preservado.
  if (!isActionable(dto.analysis.signal.signal)) return { reason: "weak", id: null };
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

type VsfPlan = { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number };
/** `nolvl` = nenhum nível protegido (ou sem preço/ATR); `gc` = havia níveis, mas o guarda-corpo rejeitou todos. */
type VsfPlanResult = { plan: VsfPlan; reject: null } | { plan: null; reject: "nolvl" | "gc" };

/**
 * Plano por NÍVEL (família VSF, era -j2 = ~lvl2): o stop vai atrás de um nível
 * que protege o trade (compra → suporte abaixo: order block bullish / liquidez /
 * VAL; venda → espelhado), com folga de 0.25×ATR. Alvos preservam a estrutura de
 * RR da casa (mesmos ratios tp/sl do computeRiskFrom).
 * ORDEM corrigida (achado 8 da revisão): primeiro FILTRA os níveis cujo stop
 * (nível ± buffer) cai no guarda-corpo [0.6, 2.5] ATR do entry, e SÓ ENTÃO
 * escolhe o mais próximo entre os VÁLIDOS — antes, o guarda-corpo era aplicado
 * apenas ao nível mais próximo e descartava o plano inteiro mesmo havendo nível
 * válido mais fundo (por isso ~lvl disparou em só 3/22). Sem plano, devolve o
 * motivo (`nolvl` vs `gc`) para o fallback ATR ser instrumentado por tag.
 */
function buildVsfPlan(dto: FullAnalysis, side: "buy" | "sell"): VsfPlanResult {
  const entry = dto.analysis?.risk?.entry;
  if (!entry || !(entry > 0)) return { plan: null, reject: "nolvl" };
  const atrVal = dto.atr && dto.atr > 0 ? dto.atr : dto.analysis.meta?.atrRatio ? dto.analysis.meta.atrRatio * entry : 0;
  if (!(atrVal > 0)) return { plan: null, reject: "nolvl" };
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
  if (levels.length === 0) return { plan: null, reject: "nolvl" };
  const buffer = atrVal * 0.25;
  // distância computada EXATAMENTE como o stop final será computado (nível ± buffer)
  const stopOf = (l: number): number => (side === "buy" ? l - buffer : l + buffer);
  const valid = levels.filter((l) => {
    const d = Math.abs(entry - stopOf(l));
    return d >= atrVal * 0.6 && d <= atrVal * 2.5;
  });
  if (valid.length === 0) return { plan: null, reject: "gc" };
  // nível VÁLIDO mais PRÓXIMO do preço (maior suporte abaixo / menor resistência acima)
  const stopLoss = side === "buy" ? Math.max(...valid) - buffer : Math.min(...valid) + buffer;
  const dist = Math.abs(entry - stopLoss);
  const { slMult, tp1Mult, tp2Mult, tp3Mult } = DEFAULT_ENGINE_CONFIG.risk;
  const k = dist / slMult; // mantém os RRs da casa com o stop ancorado no nível
  const dir = side === "buy" ? 1 : -1;
  return {
    plan: {
      entry, stopLoss,
      takeProfit1: entry + dir * k * tp1Mult,
      takeProfit2: entry + dir * k * tp2Mult,
      takeProfit3: entry + dir * k * tp3Mult,
    },
    reject: null,
  };
}

/**
 * MOTOR LLM (experimental, forward): a DECISÃO (direção + convicção) é da LLM, a
 * partir dos dados brutos (independente do Motor 1). Plano determinístico:
 * ATR ×1.4 (~a14) ou, na família VSF, stop por nível (~lvl2; fallback
 * ~a14fb-nolvl/~a14fb-gc conforme o motivo).
 * Carimba quando: lado acionável + convicção ≥ 60. Sem backtest (seal 'yellow').
 * Gate idêntico entre provedores → experimento controlado da DECISÃO.
 * A convicção e o racional são persistidos no sinal (colunas da migration 0014;
 * best-effort — sem elas o update falha silencioso e nada quebra).
 */
async function emitLlmWith(
  decide: () => Promise<LlmDecision | null>, engine: string, engineVersion: string,
  dto: FullAnalysis, symbol: string, assetType: AssetType, timeframe: Timeframe,
  useLevelPlan = false,
  shadow?: () => Promise<ShadowSample[] | null>,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const dec = await decide();
  if (!dec) return { reason: "error", id: null }; // IA indisponível/falha (ou key ausente)
  if (dec.side === "neutral") return { reason: "neutral", id: null };
  if (dec.conviction < 60) return { reason: "low-conviction", id: null };
  // Tags de plano (era -j2): ~lvl2 = stop por nível com o filtro corrigido;
  // fallback ATR instrumentado por motivo — ~a14fb-nolvl (sem nível protegido)
  // vs ~a14fb-gc (guarda-corpo 0.6-2.5 ATR rejeitou todos). Predição pré-
  // registrada (achado 8): se a causa dominante era o guarda-corpo no candidato
  // errado, a taxa de ~lvl2 deve subir materialmente; a amostra ~lvl (n=3) morre.
  const vsf = useLevelPlan ? buildVsfPlan(dto, dec.side) : null;
  let plan = vsf?.plan ?? null;
  const planTag = plan ? "~lvl2" : vsf ? `~a14fb-${vsf.reject}` : "~a14";
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
    // MODO SOMBRA k=3 (achado 18a): só quando o sinal FOI emitido (custo mínimo),
    // NUNCA muda a emissão — grava concordância/dispersão como metadado (colunas
    // sc_* da migration 0017; sem elas o update falha silencioso e nada quebra).
    if (shadow) {
      try {
        const samples = await shadow();
        if (samples && samples.length > 0) {
          const agree = samples.filter((s) => s.side === dec.side).length;
          const sides = samples.map((s) => (s.side === "buy" ? "B" : s.side === "sell" ? "S" : "N")).join("");
          const convs = samples.map((s) => s.conviction).sort((a, b) => a - b);
          const spread = convs[convs.length - 1]! - convs[0]!;
          await supabaseService()?.from("signals").update({
            sc_k: samples.length, sc_agree: agree, sc_sides: sides, sc_conv_spread: spread,
          }).eq("id", res.id);
        }
      } catch { /* sombra é medição best-effort — nunca derruba a emissão */ }
    }
  }
  return res;
}

/** MOTOR LLM·GPT — decisão da OpenAI (gpt-4.1). Sombra k=3 só em sinal emitido. */
export function emitLlmSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecision(dto, assetType, extras), "llm", `${ENGINE_VERSION}+llm`, dto, symbol, assetType, timeframe, false,
    () => generateLlmShadowSamples("gpt", dto, assetType, extras));
}

/** MOTOR LLM·DS — decisão da DeepSeek (V4-Pro). No-op gracioso sem DEEPSEEK_API_KEY. Sombra k=3 só em sinal emitido. */
export function emitLlmDsSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionDS(dto, assetType, extras), "llm_ds", `${ENGINE_VERSION}+llm-ds`, dto, symbol, assetType, timeframe, false,
    () => generateLlmShadowSamples("ds", dto, assetType, extras));
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

/** MOTOR VSF·GPT — volume + S/R + Fibonacci; stop ancorado no nível (~lvl2). */
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
  // isActionable na direção ORIGINAL, antes da inversão (era -j2): o contrário é
  // controle pareado do padrão — filtra exatamente quando o padrão filtra.
  if (!isActionable(dto.analysis.signal.signal)) return { reason: "weak", id: null };
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
  // Herda a direção do Motor 1 → herda também o gate isActionable (era -j2).
  if (!isActionable(dto.analysis.signal.signal)) return { reason: "weak", id: null };
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
