/**
 * STRESS TEST DA POSIÇÃO (/posicao) — lógica PURA, sem I/O. O usuário informa uma
 * posição EXISTENTE (ativo, lado, preço de entrada); cada motor da casa lê o
 * mercado AGORA e a leitura direcional é traduzida pra pergunta que importa:
 * o motor AUMENTARIA, SEGURARIA ou SAIRIA dessa posição?
 *
 * Regra de tradução (documentada na página):
 *  - motor no lado OPOSTO ao da posição → SAIRIA (a tese foi contrariada);
 *  - motor NEUTRO ou no MESMO lado sem força → SEGURARIA (sem contra-sinal);
 *  - motor no MESMO lado com força (STRONG_* / convicção ≥80) → AUMENTARIA.
 *
 * A leitura de cada motor é a MESMA dos emissores do track record (emit.ts);
 * os gates de emissão (selo, convicção mínima) valem só pra CARIMBAR sinal —
 * aqui o que interessa é a opinião do motor sobre a posição já aberta.
 */
import { signalSide } from "@tradeai/shared";
import type { SignalDirection } from "@tradeai/shared";
import { computeConditionalSignal, DEFAULT_ENGINE_CONFIG, NAMES } from "@tradeai/engine";
import type { FullAnalysis } from "./full";
import type { ClassReading } from "./engines";
import type { LlmDecision } from "./narrative";

export type PositionSide = "long" | "short";
export type PositionVerdict = "aumentaria" | "seguraria" | "sairia";

export function isPositionSide(v: unknown): v is PositionSide {
  return v === "long" || v === "short";
}

const INVERT: Record<SignalDirection, SignalDirection> = {
  STRONG_BUY: "STRONG_SELL", BUY: "SELL", WEAK_BUY: "WEAK_SELL", NEUTRAL: "NEUTRAL",
  WEAK_SELL: "WEAK_BUY", SELL: "BUY", STRONG_SELL: "STRONG_BUY",
};

/** Direção espelhada — usada pelo MOTOR CONTRÁRIO (braço-placebo do A/B). */
export function invertDirection(d: SignalDirection): SignalDirection {
  return INVERT[d];
}

/** Traduz a leitura direcional de um motor no veredito sobre a posição existente. */
export function verdictFor(direction: SignalDirection, pos: PositionSide): PositionVerdict {
  const side = signalSide(direction);
  const posDir = pos === "long" ? "buy" : "sell";
  if (side === "neutral") return "seguraria";
  if (side !== posDir) return "sairia";
  return direction.startsWith("STRONG_") ? "aumentaria" : "seguraria";
}

/** Decisão LLM → direção granular (mesmo corte do emissor: ≥80 = STRONG_*). */
export function llmDirection(dec: LlmDecision): SignalDirection {
  if (dec.side === "neutral") return "NEUTRAL";
  const strong = dec.conviction >= 80;
  return dec.side === "buy" ? (strong ? "STRONG_BUY" : "BUY") : (strong ? "STRONG_SELL" : "SELL");
}

// ===================== decisões determinísticas derivadas do dto =====================

type ConditionalValues = Parameters<typeof computeConditionalSignal>[0];
type ConditionalRegime = Parameters<typeof computeConditionalSignal>[1];

/** Reconstrói os VALORES de indicadores a partir do dto (a UI guarda os valores
 *  em `analysis.indicators[].value` sob os NAMES canônicos do motor). */
function valuesFromDto(dto: FullAnalysis): ConditionalValues | null {
  const by = new Map<string, unknown>((dto.analysis?.indicators ?? []).map((i) => [i.name, i.value as unknown]));
  const num = (n: string): number => { const v = by.get(n); return typeof v === "number" ? v : NaN; };
  const obj = <T,>(n: string): T | null => { const v = by.get(n); return v != null && typeof v === "object" ? (v as T) : null; };
  const lastClose = dto.analysis?.risk?.entry;
  const macd = obj<{ macdLine: number; signal: number; histogram: number }>(NAMES.macd);
  const stoch = obj<{ k: number; d: number }>(NAMES.stoch);
  const adx14 = obj<{ adx: number; plusDI: number; minusDI: number }>(NAMES.adx);
  const boll = obj<{ upper: number; middle: number; lower: number; bandwidth?: number }>(NAMES.bollinger);
  const obv = obj<{ current: number; slope: number }>(NAMES.obv);
  if (!lastClose || !(lastClose > 0) || !macd || !stoch || !adx14 || !boll) return null;
  return {
    lastClose,
    ema20: num(NAMES.ema20), ema50: num(NAMES.ema50), ema200: num(NAMES.ema200),
    sma50: num(NAMES.sma50), vwma20: num(NAMES.vwma20),
    rsi14: num(NAMES.rsi), macd, stoch,
    cci20: num(NAMES.cci), williamsR14: num(NAMES.williamsR),
    awesome: num(NAMES.awesome), mfi14: num(NAMES.mfi), roc14: num(NAMES.roc),
    adx14, supertrend: { value: NaN, trend: "up" as const }, trix14: num(NAMES.trix),
    bollinger: { upper: boll.upper, middle: boll.middle, lower: boll.lower, bandwidth: boll.bandwidth ?? 0 },
    atr14: num(NAMES.atr), obv: obv ?? { current: 0, slope: 0 }, cmf20: num(NAMES.cmf),
  };
}

/**
 * Decisão do MOTOR CONDICIONAL a partir do dto (sem emitir): trend-following SÓ
 * em tendência, fade de extremos SÓ em lateral, neutro em transição/explosão.
 * Gate seletivo ≥4 dos 5 checks — idêntico ao emissor. `null` = dto sem os
 * valores de indicador necessários.
 */
export function conditionalDirection(dto: FullAnalysis): SignalDirection | null {
  const v = valuesFromDto(dto);
  if (!v) return null;
  const regime = (dto.analysis.meta?.regime ?? "transitional") as ConditionalRegime;
  const cfg = { ...DEFAULT_ENGINE_CONFIG, signal: { ...DEFAULT_ENGINE_CONFIG.signal, filters: { macroAlign: false, volumeConfirm: false, minAgree: 4 } } };
  return computeConditionalSignal(v, regime, cfg).signal;
}

/**
 * Decisão do MOTOR CONSENSO: só tem direção quando os DOIS motores independentes
 * concordam — Motor 1 acionável E leitura por classe no MESMO lado com convicção
 * ≥15pts. (O gate de selo do emissor vale só pro carimbo no track record.)
 */
export function consensusDirection(dto: FullAnalysis, reading: ClassReading): SignalDirection {
  const side = signalSide(dto.analysis.signal.signal);
  if (side === "neutral") return "NEUTRAL";
  if (reading.side !== side || Math.abs(reading.score - 50) < 15) return "NEUTRAL";
  return dto.analysis.signal.signal;
}

// ===================== risco da posição (R não-realizado + stop da casa) =====================

export interface PositionRisk {
  /** preço atual do mercado (= `dto.analysis.risk.entry`). */
  current: number;
  /** R não-realizado: a favor (+) / contra (−), em múltiplos do stop da casa. `null` sem distSL. */
  unrealizedR: number | null;
  /** variação % da posição: a favor (+) / contra (−) do lado informado. */
  unrealizedPct: number;
  /** nível onde a tese morre — stop da casa (distSL por ATR) orientado ao LADO da posição. */
  houseStop: number | null;
  /** distância % do preço atual até o stop da casa. */
  stopDistPct: number | null;
}

/** Situa a posição informada contra o mercado AGORA. `null` = dto sem preço ou entrada inválida. */
export function computePositionRisk(dto: FullAnalysis, pos: PositionSide, entryPrice: number): PositionRisk | null {
  const current = dto.analysis?.risk?.entry;
  if (!current || !(current > 0) || !(entryPrice > 0)) return null;
  const dir = pos === "long" ? 1 : -1;
  const distSL = dto.analysis.risk.distSL;
  const unrealizedPct = ((current - entryPrice) / entryPrice) * 100 * dir;
  if (!(distSL > 0)) return { current, unrealizedR: null, unrealizedPct, houseStop: null, stopDistPct: null };
  return {
    current,
    unrealizedR: ((current - entryPrice) / distSL) * dir,
    unrealizedPct,
    houseStop: current - dir * distSL,
    stopDistPct: (distSL / current) * 100,
  };
}

// ===================== mesa de motores (opiniões + placar) =====================

export type EngineKind = "deterministico" | "llm";

export interface EngineOpinion {
  id: string;
  label: string;
  kind: EngineKind;
  /** `null` = motor sem leitura (dados insuficientes / IA indisponível). */
  direction: SignalDirection | null;
  verdict: PositionVerdict | null;
  conviction: number | null;
  rationale: string | null;
}

export function buildOpinion(id: string, label: string, kind: EngineKind, direction: SignalDirection | null, pos: PositionSide): EngineOpinion {
  return { id, label, kind, direction, verdict: direction ? verdictFor(direction, pos) : null, conviction: null, rationale: null };
}

export function llmOpinion(id: string, label: string, dec: LlmDecision | null, pos: PositionSide): EngineOpinion {
  if (!dec) return { id, label, kind: "llm", direction: null, verdict: null, conviction: null, rationale: null };
  const direction = llmDirection(dec);
  return { id, label, kind: "llm", direction, verdict: verdictFor(direction, pos), conviction: dec.conviction, rationale: dec.rationale || null };
}

export interface StressTally {
  aumentaria: number;
  seguraria: number;
  sairia: number;
  /** motores com leitura (denominador do placar). */
  read: number;
  /** motores indisponíveis nesta rodada (IA off / dados insuficientes). */
  unavailable: number;
}

export function tallyVerdicts(opinions: EngineOpinion[]): StressTally {
  const t: StressTally = { aumentaria: 0, seguraria: 0, sairia: 0, read: 0, unavailable: 0 };
  for (const o of opinions) {
    if (!o.verdict) { t.unavailable += 1; continue; }
    t[o.verdict] += 1;
    t.read += 1;
  }
  return t;
}
