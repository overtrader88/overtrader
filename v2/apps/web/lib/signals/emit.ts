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
import { generateLlmDecision, generateLlmDecisionDS, generateLlmDecisionCot, generateLlmDecisionSurv, generateLlmDecisionDsSurv, generateLlmDecisionVsf, generateLlmDecisionDsVsf, generateLlmDecisionVsfSurv, generateLlmDecisionDsVsfSurv, generateEvoDecision, generateLlmShadowSamples, breedEvoCore, validateEvoCore, EVO_SEED_CORES, LLM_ATR_SCALE, type LlmDecision, type ShadowSample } from "@/lib/analysis/narrative";
import { replayBank, fitnessBounds, EVO_MIN_TRADES, type BankState } from "./survival";

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

/**
 * ERA DOS MOTORES LLM `~c1` (Pacote C, 06/07/2026) — sufixo carimbado no
 * engineVersion de TODOS os motores LLM simultaneamente, marcando a mudança
 * conjunta de fatos+prompt (achados 13-17): convicção = P(TP1 antes do SL),
 * plano_execucao/compressão/contexto_tempo nos fatos, dist_atr nos níveis VSF
 * e nivel_referencia ancorando o stop. Amostras pré/pós `~c1` NUNCA se
 * misturam na mesma estatística. Motores determinísticos ficam INTOCADOS
 * (o stop ×1.4 vive em LLM_ATR_SCALE, exportado por narrative.ts — fonte
 * única com os fatos do prompt).
 */
const LLM_ERA = "~c1";

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
/** `nolvl` = nenhum nível protegido (ou sem preço/ATR); `gc` = havia níveis, mas o
 *  guarda-corpo rejeitou todos. `anchored` = stop ancorado no nivel_referencia
 *  VALIDADO que a própria LLM escolheu (era ~c1 = ~lvl3). */
type VsfPlanResult = { plan: VsfPlan; reject: null; anchored: boolean } | { plan: null; reject: "nolvl" | "gc" };

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
 *
 * Era ~c1 (achado 17b): a LLM devolve `nivel_referencia` (o nível que justifica
 * a tese) e o stop é ancorado NELE — com VALIDAÇÃO DURA, nunca confiança:
 * número finito, casando com um nível protegido efetivamente enviado (tolerância
 * 0.05×ATR), do lado protetor do entry E dentro do guarda-corpo [0.6, 2.5] ATR.
 * Qualquer violação → comportamento anterior (nível VÁLIDO mais próximo, ~lvl2);
 * o campo novo jamais derruba um sinal. Plano ancorado carimba ~lvl3.
 */
export function buildVsfPlan(dto: FullAnalysis, side: "buy" | "sell", refLevel?: number | null): VsfPlanResult {
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
  // Âncora no nivel_referencia da LLM (validação dura): só se casar com um nível
  // VÁLIDO (protegido + guarda-corpo) enviado nos fatos, tolerância 0.05×ATR.
  const tol = atrVal * 0.05;
  const anchor = refLevel != null && Number.isFinite(refLevel)
    ? valid.filter((l) => Math.abs(l - refLevel) <= tol).sort((a, b) => Math.abs(a - refLevel) - Math.abs(b - refLevel))[0]
    : undefined;
  // Sem âncora válida → nível VÁLIDO mais PRÓXIMO do preço (maior suporte abaixo / menor resistência acima)
  const chosen = anchor ?? (side === "buy" ? Math.max(...valid) : Math.min(...valid));
  const stopLoss = stopOf(chosen);
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
    anchored: anchor !== undefined,
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
  // Tags de plano: ~lvl3 = stop ancorado no nivel_referencia VALIDADO da LLM
  // (era ~c1, achado 17b); ~lvl2 = stop no nível válido mais próximo (era -j2,
  // filtro corrigido do achado 8); fallback ATR instrumentado por motivo —
  // ~a14fb-nolvl (sem nível protegido) vs ~a14fb-gc (guarda-corpo rejeitou
  // todos). A comparação ~lvl3 vs ~lvl2 mede se a âncora da LLM fecha o vão
  // entre a tese e o plano executado.
  const vsf = useLevelPlan ? buildVsfPlan(dto, dec.side, dec.refLevel) : null;
  let plan = vsf?.plan ?? null;
  const planTag = vsf?.plan ? (vsf.anchored ? "~lvl3" : "~lvl2") : vsf ? `~a14fb-${vsf.reject}` : "~a14";
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
  return emitLlmWith(() => generateLlmDecision(dto, assetType, extras), "llm", `${ENGINE_VERSION}+llm${LLM_ERA}`, dto, symbol, assetType, timeframe, false,
    () => generateLlmShadowSamples("gpt", dto, assetType, extras));
}

/** MOTOR LLM·DS — decisão da DeepSeek (V4-Pro). No-op gracioso sem DEEPSEEK_API_KEY. Sombra k=3 só em sinal emitido. */
export function emitLlmDsSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionDS(dto, assetType, extras), "llm_ds", `${ENGINE_VERSION}+llm-ds${LLM_ERA}`, dto, symbol, assetType, timeframe, false,
    () => generateLlmShadowSamples("ds", dto, assetType, extras));
}

/** MOTOR LLM·CoT (achado 13, era ~c1): analise-first — a IA delibera ANTES de
 *  cravar lado/convicção; a análise persiste como rationale (autópsia rica).
 *  Mesmo provider, gates, geometria e dedup do `llm`, que segue como CONTROLE.
 *  Critério pré-registrado: avaliar só com ≥100 resolvidos por braço, por
 *  expectancy em R e calibração de convicção (não WR isolado); sem separação
 *  do controle → matar a variante (padrão do repo). Sem sombra k=3 (custo). */
export function emitLlmCotSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionCot(dto, assetType, extras), "llm_cot", `${ENGINE_VERSION}+llm-cot${LLM_ERA}`, dto, symbol, assetType, timeframe, false);
}

/** MOTOR SOBREVIVÊNCIA·GPT — mentalidade de capital finito + FEEDBACK da banca real. */
export async function emitLlmSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_surv");
  return emitLlmWith(() => generateLlmDecisionSurv(dto, assetType, extras, bank), "llm_surv", `${ENGINE_VERSION}+surv${LLM_ERA}`, dto, symbol, assetType, timeframe);
}

/** MOTOR SOBREVIVÊNCIA·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export async function emitLlmDsSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_ds_surv");
  return emitLlmWith(() => generateLlmDecisionDsSurv(dto, assetType, extras, bank), "llm_ds_surv", `${ENGINE_VERSION}+ds-surv${LLM_ERA}`, dto, symbol, assetType, timeframe);
}

/** MOTOR VSF·GPT — volume + S/R + Fibonacci; stop ancorado no nível (~lvl2). */
export function emitLlmVsfSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionVsf(dto, assetType, extras), "llm_vsf", `${ENGINE_VERSION}+vsf${LLM_ERA}`, dto, symbol, assetType, timeframe, true);
}

/** MOTOR VSF·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export function emitLlmDsVsfSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  return emitLlmWith(() => generateLlmDecisionDsVsf(dto, assetType, extras), "llm_ds_vsf", `${ENGINE_VERSION}+ds-vsf${LLM_ERA}`, dto, symbol, assetType, timeframe, true);
}

/** MOTOR VSF+SOBREVIVÊNCIA·GPT — níveis + capital finito + feedback da banca. */
export async function emitLlmVsfSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_vsf_surv");
  return emitLlmWith(() => generateLlmDecisionVsfSurv(dto, assetType, extras, bank), "llm_vsf_surv", `${ENGINE_VERSION}+vsf-surv${LLM_ERA}`, dto, symbol, assetType, timeframe, true);
}

/** Slot da EVOLUÇÃO (linha da tabela evo_engines). */
export interface EvoSlot { slot: string; provider: "gpt" | "ds"; core: string; generation: number; born_at: string }

// ===================== DARWIN 2.0 (achados 25-30 da revisão de 05/07) =====================

/** Letargia (achado 28a): núcleo com > LETHARGY_DAYS dias de vida e MENOS de
 *  LETHARGY_MIN_EMITTED sinais direcionais EMITIDOS morre por inatividade —
 *  emissão mede covardia diretamente (não depende da fila de resolução). */
const EVO_LETHARGY_DAYS = 14;
const EVO_LETHARGY_MIN_EMITTED = 3;
/** Elitismo passivo (achado 29): só registra recorde com amostra mínima. */
const EVO_BEST_MIN_TRADES = 15;

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/** Nº de sinais direcionais EMITIDOS pelo motor desde `sinceIso` (a tabela signals
 *  só guarda sinais direcionais — neutro nunca é carimbado). `null` em falha:
 *  falha de contagem NUNCA mata um núcleo. */
async function countEmittedSince(sb: NonNullable<ReturnType<typeof supabaseService>>, engine: string, sinceIso: string): Promise<number | null> {
  try {
    const { count, error } = await sb
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("engine", engine)
      .gte("emitted_at", sinceIso);
    if (error || count == null) return null;
    return count;
  } catch {
    return null;
  }
}

/**
 * Agregado da morte EM CÓDIGO (achado 27): clusters símbolo×timeframe×regime×lado
 * com ≥3 SLs na vida do núcleo (contagem determinística das linhas de signals —
 * não extraída do texto das autópsias) + até 3 autópsias recentes truncadas
 * (~200 chars), rotuladas como HIPÓTESES do legista. Teto total ~1500 chars
 * (o núcleo-filho é limitado a 350 tokens — prompt inchado só custa).
 * `null` em falha/sem dados: o chamador cai no deathCtx básico.
 */
async function evoAutopsyContext(sb: NonNullable<ReturnType<typeof supabaseService>>, engine: string, sinceIso: string): Promise<string | null> {
  const { data, error } = await sb
    .from("signals")
    .select("symbol, timeframe, regime, side, autopsy, duration_candles")
    .eq("engine", engine)
    .gte("emitted_at", sinceIso)
    .eq("outcome", "SL")
    .order("emitted_at", { ascending: false })
    .limit(40);
  if (error || !data?.length) return null;
  const rows = data as { symbol: string; timeframe: string; regime: string | null; side: string; autopsy: string | null; duration_candles: number | null }[];
  const byKey = new Map<string, { n: number; durSum: number; durN: number }>();
  for (const r of rows) {
    const key = `${r.symbol} ${r.timeframe} · ${r.regime ?? "regime?"} · ${r.side === "sell" ? "venda" : "compra"}`;
    const c = byKey.get(key) ?? { n: 0, durSum: 0, durN: 0 };
    c.n++;
    if (r.duration_candles != null) { c.durSum += Number(r.duration_candles); c.durN++; }
    byKey.set(key, c);
  }
  const clusters = [...byKey.entries()]
    .filter(([, v]) => v.n >= 3)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 4)
    .map(([k, v]) => `${v.n}× SL em ${k}${v.durN > 0 ? ` (duração média ${Math.round(v.durSum / v.durN)} candles)` : ""}`);
  const lessons = rows.filter((r) => r.autopsy).slice(0, 3).map((r) => `- ${String(r.autopsy).slice(0, 200)}`);
  const parts: string[] = [];
  parts.push(clusters.length > 0
    ? `PADRÕES DA MORTE (contados em código sobre os SLs da vida; padrões com MENOS de 3 ocorrências são ruído — ignore): ${clusters.join("; ")}.`
    : "Nenhum cluster com ≥3 SLs (símbolo×timeframe×regime×lado) — os stops foram dispersos; trate padrões pontuais como ruído.");
  if (lessons.length > 0) parts.push(`AUTÓPSIAS RECENTES (hipóteses do legista, NÃO fatos):\n${lessons.join("\n")}`);
  return parts.join("\n").slice(0, 1500);
}

/** Fixture FIXO do smoke test do núcleo-filho (achado 30, camada b): um dto
 *  determinístico mínimo — o filho precisa produzir um JSON parseável com lado
 *  válido sobre ele (generateEvoDecision devolve null em qualquer falha).
 *  Sem retry: falha de provider e genoma ruim caem ambos no fallback pro pai. */
const EVO_SMOKE_DTO = {
  generatedAt: 0,
  type: "complete",
  period: null,
  analysis: {
    signal: { signal: "BUY", strength: 60, confluence: 7, votes: { buy: 8, sell: 2, neutral: 10 } },
    risk: { entry: 100, stopLoss: 97.6, takeProfit1: 103.6, takeProfit2: 106, takeProfit3: 109, distSL: 2.4, rr1: 1.5 },
    explanation: { summary: "" },
    indicators: [
      { name: "RSI 14", category: "Momentum", vote: "NEUTRAL", value: 55 },
      { name: "EMA 20", category: "Tendência", vote: "BUY", value: 99.2 },
      { name: "ADX 14", category: "Tendência", vote: "BUY", value: 28 },
    ],
    meta: { asset: "BTCUSDT", assetType: "crypto", timeframe: "4h", regime: "trending", adxValue: 28, atrRatio: 0.02 },
  },
  atr: 2,
  volumeProfile: { poc: 100.5, vah: 103, val: 99 },
  smc: {
    bias: "bullish", marketStructure: "bullish_bos",
    orderBlocks: [{ type: "bullish", zoneTop: 97, zoneBottom: 96 }],
    liquidityZones: [{ type: "sell_stops_below", level: 99.7, swept: false }],
    fvgs: [],
  },
} as unknown as FullAnalysis;

type EvoDeathKind = "ruina" | "expectancia" | "letargia";

/**
 * Ciclo de vida darwiniano (2.0) — roda 1× por execução do cron, ANTES das emissões:
 * 1) semeia a geração 1 se a tabela estiver vazia;
 * 2) SNAPSHOT imutável dos núcleos vigentes (achado 26, fix de bug): o parceiro
 *    de cruzamento é sempre o núcleo do INÍCIO do cron — se os dois slots morrem
 *    no mesmo cron, o segundo NÃO cruza com o filho recém-nascido do primeiro;
 * 3) para cada slot, calcula a banca do núcleo VIGENTE (sinais desde born_at) e
 *    grava a telemetria de fitness (colunas da migration 0018; best-effort);
 * 4) MORTE (achados 25+28) — só por evento, nunca por falta de prova de edge:
 *    a) LETARGIA: > 14 dias de vida E < 3 sinais direcionais EMITIDOS → o
 *       contexto manda AFROUXAR UM filtro (neutraliza o "em dúvida, neutro");
 *    b) RUÍNA com amostra: banca quebrou E n ≥ 20 trades resolvidos desde
 *       born_at (o comprimento do replay — banca quebrada com n < 20 fica
 *       "em observação", derivado na leitura, sem estado novo persistido);
 *    c) EXPECTÂNCIA: upper bound 90% (média + 1.28σ/√n) < 0 com n ≥ 20.
 * 5) morte → autópsias agregadas EM CÓDIGO no deathContext (achado 27) →
 *    cruzamento → validação em 2 camadas do filho (achado 30: gate duro
 *    determinístico + smoke test; rejeição observável no `parents`) →
 *    histórico da linhagem (INSERT em evo_engines_history ANTES do UPDATE,
 *    achado 29) + recorde best_core/best_expectancy (elitismo PASSIVO — a
 *    ressurreição fica desligada por design até haver amostra).
 * Best-effort: sem tabela (antes da migration 0015) devolve [] e nada quebra;
 * sem as colunas/tabela da 0018, os passos novos falham silenciosos e o ciclo
 * clássico segue.
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
    // SNAPSHOT imutável (achado 26): 'other' vem daqui, nunca do row mutado no loop.
    const originals = rows.map((r) => ({ slot: r.slot, core: r.core }));
    const nowMs = Date.now();
    for (const s of rows) {
      const bank = await fetchBank(s.slot, s.born_at);
      const n = bank?.resolved ?? 0;
      const bounds = bank ? fitnessBounds(bank) : null;
      // Telemetria de fitness a cada cron (achado 25; colunas da migration 0018 —
      // sem elas o update falha silencioso e nada quebra).
      try {
        await sb.from("evo_engines").update({
          life_resolved: n,
          life_mean_r: bank ? round4(bank.meanR) : null,
          life_std_r: bank ? round4(bank.stdR) : null,
          fitness_lb_r: bounds ? round4(bounds.lb) : null,
          fitness_ub_r: bounds ? round4(bounds.ub) : null,
          fitness_at: new Date().toISOString(),
        }).eq("slot", s.slot);
      } catch { /* pré-migration 0018 */ }

      // ---- Decisão de MORTE (regra única, parâmetros fixados a priori) ----
      let kind: EvoDeathKind | null = null;
      let baseCtx = "";
      const ageDays = (nowMs - Date.parse(s.born_at)) / 86_400_000;
      if (Number.isFinite(ageDays) && ageDays > EVO_LETHARGY_DAYS) {
        // ANTES do check de banca: o caso exato de letargia (0 trades) tem bank=null.
        const emitted = await countEmittedSince(sb, s.slot, s.born_at);
        if (emitted != null && emitted < EVO_LETHARGY_MIN_EMITTED) {
          kind = "letargia";
          baseCtx = [
            `MORTE POR LETARGIA: este núcleo morreu por NÃO operar — emitiu apenas ${emitted} sinal(is) direcional(is) em ${Math.floor(ageDays)} dias de vida.`,
            "IGNORE nesta mutação a regra 'em dúvida, mande ser neutro': AFROUXE UM filtro específico que causou a inatividade (identifique qual exigência é restritiva demais) e NÃO adicione nenhum filtro novo.",
          ].join("\n");
        }
      }
      if (!kind && bank && n >= EVO_MIN_TRADES) {
        if (bank.deaths > 0) {
          kind = "ruina";
          baseCtx = `Banca quebrou. Pior queda ${bank.maxDrawdownPct}% do pico; últimos trades: ${bank.lastResults.join("") || "—"}; ${bank.lifeTrades} trades na vida final; ${n} trades resolvidos no total do núcleo (expectância média ${round4(bank.meanR)}R).`;
        } else if (bounds && bounds.ub < 0) {
          kind = "expectancia";
          baseCtx = `Expectância NEGATIVA com evidência estatística: média ${round4(bank.meanR)}R por trade em ${n} resolvidos (banda 90%: ${round4(bounds.lb)}R a ${round4(bounds.ub)}R — o teto da banda é negativo). A banca não quebrou, mas a estratégia perde no agregado.`;
        }
      }
      // Vivo — banca quebrada com n<20 fica "em observação" (derivado do próprio
      // (n, fitness) na leitura; nenhum estado novo persistido).
      if (!kind) continue;

      const other = originals.find((o) => o.slot !== s.slot);
      // Autópsias agregadas (achado 27) — best-effort: falhou → deathCtx básico
      // (o breeding acontece como antes em vez de o slot pular a geração).
      let deathCtx = baseCtx;
      if (kind !== "letargia") {
        try {
          const agg = await evoAutopsyContext(sb, s.slot, s.born_at);
          if (agg) deathCtx = `${baseCtx}\n${agg}`;
        } catch { /* segue com o contexto básico */ }
      }

      const child = await breedEvoCore(s.core, other?.core ?? s.core, s.provider, deathCtx);
      // Validação em 2 camadas (achado 30). Rejeição → renasce com o PAI, com o
      // motivo observável no `parents` (senão a evolução clona o pai em silêncio).
      let core = s.core;
      let rejected: string | null = null;
      if (child != null) {
        const v = validateEvoCore(child);
        if (!v.ok) {
          rejected = `formato:${v.reason}`;
        } else {
          const smoke = await generateEvoDecision(v.core, s.provider, EVO_SMOKE_DTO, "crypto", {}, null);
          if (!smoke) rejected = "smoke";
          else core = v.core;
        }
      }

      const nowIso = new Date().toISOString();
      // ARQUIVO da linhagem (achado 29): INSERT do núcleo que MORREU antes do
      // UPDATE, ignorando erro (o UPDATE nunca fica condicionado ao histórico).
      try {
        await sb.from("evo_engines_history").insert({
          slot: s.slot, generation: s.generation, core: s.core,
          born_at: s.born_at, died_at: nowIso,
          life_trades: n,
          expectancy_r: bank ? round4(bank.meanR) : null,
          max_dd_pct: bank?.maxDrawdownPct ?? null,
          death_context: `[${kind}] ${deathCtx}`.slice(0, 4000),
        });
      } catch { /* pré-migration 0018 */ }
      // ELITISMO PASSIVO (achado 29): registra o recorde da linhagem com amostra
      // mínima; a ressurreição automática fica DESLIGADA por design.
      if (bank && n >= EVO_BEST_MIN_TRADES) {
        try {
          const cur = await sb.from("evo_engines").select("best_expectancy").eq("slot", s.slot).maybeSingle();
          if (!cur.error) {
            const best = (cur.data as { best_expectancy: number | null } | null)?.best_expectancy;
            if (best == null || bank.meanR > Number(best)) {
              await sb.from("evo_engines").update({
                best_core: s.core, best_expectancy: round4(bank.meanR), best_generation: s.generation,
              }).eq("slot", s.slot);
            }
          }
        } catch { /* pré-migration 0018 */ }
      }
      await sb.from("evo_engines").update({
        core, generation: s.generation + 1, deaths: s.deaths + 1,
        parents: `g${s.generation} × ${other?.slot ?? "clone"} [${kind}]${rejected ? ` [filho rejeitado: ${rejected}]` : ""}`,
        born_at: nowIso, updated_at: nowIso,
      }).eq("slot", s.slot);
      s.core = core; s.generation += 1; s.born_at = nowIso; s.deaths += 1;
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
    slot.slot, `${ENGINE_VERSION}+evo-g${slot.generation}${LLM_ERA}`, dto, symbol, assetType, timeframe,
  );
}

/** MOTOR VSF+SOBREVIVÊNCIA·DS — idem, decisão da DeepSeek. No-op gracioso sem DEEPSEEK_API_KEY. */
export async function emitLlmDsVsfSurvSignal(
  dto: FullAnalysis, extras: ClassExtras, symbol: string, assetType: AssetType, timeframe: Timeframe,
): Promise<{ reason: ClassEmitReason; id: string | null }> {
  const bank = await fetchBank("llm_ds_vsf_surv");
  return emitLlmWith(() => generateLlmDecisionDsVsfSurv(dto, assetType, extras, bank), "llm_ds_vsf_surv", `${ENGINE_VERSION}+ds-vsf-surv${LLM_ERA}`, dto, symbol, assetType, timeframe, true);
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
