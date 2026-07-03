/**
 * Simulador "Máquina do Tempo" — serviço da BORDA (server-only).
 *
 * O usuário escolhe uma DATA passada; buscamos os candles de hoje pra trás
 * (getCandles só retorna "últimos N") e TRUNCAMOS todas as séries no fim
 * daquele dia (UTC) — a análise roda EXATAMENTE como rodaria naquele dia,
 * sem lookahead. A regra de corte é auditável por design:
 *
 *   · só entra candle comprovadamente FECHADO até o corte (o candle i entra
 *     apenas se o candle i+1 abriu até o corte) — vale pro TF da análise,
 *     TFs superiores, série de sazonalidade e heatmap;
 *   · "futuro" = candles que ABREM após o corte (mesma convenção do cron
 *     resolve-signals) — o candle vivo no momento do corte não entra em
 *     nenhum dos lados.
 *
 * O desfecho usa o MESMO resolveLifecycle do track record real, com a mesma
 * janela de 60 candles. `timeline[k-1]` é o estado do plano após revelar k
 * candles — o cliente "avança o tempo" sem recomputar nada.
 */
import type { AssetType, Candle, Timeframe } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import {
  getHigherTimeframes, resolveLifecycle,
  type AnalysisInput, type LifecycleState, type SignalPlan,
} from "@tradeai/engine";
import { getCandles, realProviders, type GetCandlesDeps } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { runFullAnalysis, type FullAnalysis } from "@/lib/analysis/full";
import {
  CANDLE_LIMIT, MIN_CANDLES, HIGHER_TF_LIMIT,
  SEASONALITY_TF, SEASONALITY_LIMIT, SESSION_TF, SESSION_LIMIT,
} from "@/lib/analysis/service";

/** Janela máxima de resolução (candles após o corte) — igual ao cron resolve-signals. */
export const SIM_MAX_DURATION = 60;
/** Cauda de candles passados enviada ao gráfico (a análise vê a série toda). */
export const SIM_PAST_CHART = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SimulationParams {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  /** Data simulada, "AAAA-MM-DD". O corte é o FIM desse dia (UTC). */
  date: string;
}

/** Recorte da análise com o que a UI do simulador exibe (payload enxuto). */
export interface SimAnalysisView {
  signal: FullAnalysis["analysis"]["signal"]["signal"];
  strength: number;
  confluence: number;
  votes: { buy: number; neutral: number; sell: number };
  summary: string;
  regime?: string;
  adx?: number;
  period: string | null;
  sealStatus: "green" | "yellow" | "red" | "grey";
  sealReason: string | null;
  decisiveTrades: number;
  rr1: number;
  distSL: number;
  /** Probabilidades first-passage do lado recomendado (quando houver cenários). */
  tp1Prob: number | null;
  stopProb: number | null;
}

export interface SimulationResult {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  simDate: string;
  /** Fim do dia simulado (exclusivo), em ms UTC — o "agora" da simulação. */
  cutoffMs: number;
  analysis: SimAnalysisView;
  /** null quando o motor ficou neutro naquele dia (sem plano operacional). */
  plan: SignalPlan | null;
  /** Quantos candles fechados a análise realmente viu. */
  pastTotal: number;
  pastCandles: Candle[];
  /** Candles APÓS o corte (máx. 60) — o "futuro" que o usuário revela. */
  futureCandles: Candle[];
  /** timeline[k-1] = estado do plano após k candles revelados. null se neutro. */
  timeline: LifecycleState[] | null;
  /** Estado final (com todos os candles futuros disponíveis). null se neutro. */
  lifecycle: LifecycleState | null;
}

/**
 * Candles comprovadamente FECHADOS até o corte: o candle i entra apenas se o
 * candle i+1 abriu até `cutoffMs` (fechamento atestado pela própria série,
 * independente de provedor/calendário). O último candle da série nunca entra.
 * É esta função que garante o "sem lookahead" — testada em isolamento.
 */
export function truncateClosed(candles: Candle[], cutoffMs: number): Candle[] {
  let n = 0;
  for (let i = 0; i + 1 < candles.length; i++) {
    if (candles[i + 1]!.time <= cutoffMs) n = i + 1;
    else break;
  }
  return candles.slice(0, n);
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

function toView(dto: FullAnalysis): SimAnalysisView {
  const sig = dto.analysis.signal;
  const risk = dto.analysis.risk;
  const q = dto.quality?.status;
  const sc = dto.scenarios;
  const rec = sc ? (sc.recommended === "buy" ? sc.buy : sc.sell) : null;
  return {
    signal: sig.signal,
    strength: sig.strength,
    confluence: sig.confluence,
    votes: sig.votes,
    summary: dto.analysis.explanation.summary,
    regime: dto.analysis.meta.regime,
    adx: dto.analysis.meta.adxValue,
    period: dto.period,
    sealStatus: q === "green" || q === "yellow" || q === "red" ? q : "grey",
    sealReason: dto.quality?.reason ?? null,
    decisiveTrades: dto.backtest?.decisiveTrades ?? 0,
    rr1: risk.rr1,
    distSL: risk.distSL,
    tp1Prob: rec ? rec.tp1.probability.value : null,
    stopProb: rec ? rec.stopProbability.value : null,
  };
}

/**
 * Roda a simulação com dependências INJETÁVEIS (testável sem rede). A borda
 * de produção usa `simulateSymbol` (providers reais + cache Supabase).
 */
export async function runSimulation(params: SimulationParams, deps: GetCandlesDeps): Promise<SimulationResult> {
  const { symbol, assetType, timeframe, date } = params;
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dayStart)) throw new Error("Data inválida — use o formato AAAA-MM-DD.");
  const cutoffMs = dayStart + DAY_MS;

  const candles = await getCandles(symbol, assetType, timeframe, CANDLE_LIMIT, deps);
  const past = truncateClosed(candles, cutoffMs);
  if (past.length < MIN_CANDLES) {
    const earliest = candles[MIN_CANDLES]?.time;
    throw new Error(
      earliest
        ? `Sem histórico suficiente antes de ${date} para ${symbol} ${timeframe}. Neste timeframe, a data mais antiga simulável é ${isoDay(earliest)}.`
        : `Sem histórico suficiente para simular ${symbol} ${timeframe}.`,
    );
  }
  const future = candles.filter((c) => c.time >= cutoffMs).slice(0, SIM_MAX_DURATION);
  if (future.length === 0) {
    throw new Error(`Ainda não existem candles fechados após ${date} em ${timeframe} — escolha uma data mais antiga.`);
  }

  // Camadas auxiliares (confluência multi-TF, sazonalidade, heatmap) — todas
  // TRUNCADAS no mesmo corte. Falha/amostra curta degrada gracioso (como na
  // análise real): a camada simplesmente não entra.
  const { higher, highest } = getHigherTimeframes(timeframe);
  const fetchTf = async (tf: Timeframe | null): Promise<AnalysisInput | null> => {
    if (!tf) return null;
    try {
      const raw = await getCandles(symbol, assetType, tf, HIGHER_TF_LIMIT, deps);
      const cut = truncateClosed(raw, cutoffMs);
      if (cut.length < MIN_CANDLES) return null;
      return { symbol, assetType, timeframe: tf, candles: cut };
    } catch {
      return null;
    }
  };
  const fetchAux = async (tf: Timeframe, limit: number): Promise<Candle[] | undefined> => {
    if (timeframe === tf) return undefined; // runFullAnalysis reusa os candles da análise
    try {
      const raw = await getCandles(symbol, assetType, tf, limit, deps);
      const cut = truncateClosed(raw, cutoffMs);
      return cut.length >= MIN_CANDLES ? cut : undefined;
    } catch {
      return undefined;
    }
  };
  const [tfInputs, seasonalityCandles, heatmapCandles] = await Promise.all([
    Promise.all([fetchTf(higher), fetchTf(highest)]),
    fetchAux(SEASONALITY_TF, SEASONALITY_LIMIT),
    fetchAux(SESSION_TF, SESSION_LIMIT),
  ]);

  // O "relógio" injetado é o corte — determinístico e auditável.
  const dto = runFullAnalysis(
    { symbol, assetType, timeframe, candles: past },
    {
      generatedAt: cutoffMs,
      type: "complete",
      higherTimeframes: tfInputs.some((x) => x !== null) ? tfInputs : undefined,
      seasonalityCandles,
      heatmapCandles,
    },
  );

  const side = signalSide(dto.analysis.signal.signal);
  let plan: SignalPlan | null = null;
  let timeline: LifecycleState[] | null = null;
  let lifecycle: LifecycleState | null = null;
  if (side !== "neutral") {
    const r = dto.analysis.risk;
    plan = { side, entry: r.entry, stopLoss: r.stopLoss, takeProfit1: r.takeProfit1, takeProfit2: r.takeProfit2, takeProfit3: r.takeProfit3 };
    const p = plan;
    timeline = future.map((_, k) => resolveLifecycle(p, future.slice(0, k + 1), SIM_MAX_DURATION));
    lifecycle = timeline[timeline.length - 1] ?? null;
  }

  return {
    symbol, assetType, timeframe,
    simDate: date,
    cutoffMs,
    analysis: toView(dto),
    plan,
    pastTotal: past.length,
    pastCandles: past.slice(-SIM_PAST_CHART),
    futureCandles: future,
    timeline,
    lifecycle,
  };
}

/** Borda de produção: providers reais + cache. TTL longo — dado histórico muda devagar. */
export async function simulateSymbol(symbol: string, assetType: AssetType, timeframe: Timeframe, date: string): Promise<SimulationResult> {
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  return runSimulation({ symbol, assetType, timeframe, date }, {
    providers, cache, cacheTtlSeconds: 3600, minCandles: MIN_CANDLES,
  });
}
