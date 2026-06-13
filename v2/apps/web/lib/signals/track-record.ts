/**
 * Leitura + agregação do track record forward (Fase C4). Lê os sinais RESOLVIDOS
 * da tabela `signals` e agrega com IC e n (motor). Tudo server-side; a página é
 * pública (o moat é aberto). Degrada gracioso se o Supabase não estiver
 * configurado ou ainda não houver sinais.
 */
import { aggregateTrackRecord, type SignalOutcome, type TrackRecordStats } from "@tradeai/engine";
import { supabaseService } from "@/lib/supabase/server";

export interface TrackRecordRow {
  symbol: string;
  timeframe: string;
  direction: string;
  seal: string;
  engine: string;
  outcome: SignalOutcome;
  pnlR: number;
  regime: string | null;
  emittedAt: string;
  resolvedAt: string | null;
}

export interface RegimeStats {
  regime: string;
  stats: TrackRecordStats;
}

export interface LiveSignal {
  symbol: string;
  timeframe: string;
  direction: string;
  seal: string;
  engine: string;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  stopStage: string;
  emittedAt: string;
}

export type EngineFilter = "padrao" | "padrao_b" | "classe" | "classe_b" | "llm" | "llm_ds" | "condicional" | "contrario" | "consenso";
/** Todos os motores — usado na visão consolidada ("Todos"). */
const ALL_ENGINES = ["padrao", "padrao_b", "classe", "classe_b", "llm", "llm_ds", "condicional", "contrario", "consenso"];

export interface TrackRecordData {
  configured: boolean;
  overall: TrackRecordStats;
  byRegime: RegimeStats[];
  recent: TrackRecordRow[];
  live: LiveSignal[];
  openCount: number;
}

const EMPTY: TrackRecordStats = {
  n: 0, decisive: 0,
  outcomes: { TP1: 0, TP2: 0, TP3: 0, SL: 0, EXPIRED: 0 },
  winRate: { value: 0, ci95: [0, 0], n: 0 },
  profitFactor: { value: 0, ci95: [0, 0], n: 0 },
  avgR: { value: 0, ci95: [0, 0], n: 0 },
  totalR: 0,
};

interface DbRow {
  symbol: string; timeframe: string; direction: string; seal: string; engine: string | null;
  outcome: SignalOutcome; pnl_r: number | null; regime: string | null;
  emitted_at: string; resolved_at: string | null;
}

export async function getTrackRecord(engine?: EngineFilter): Promise<TrackRecordData> {
  const sb = supabaseService();
  const empty = { configured: false, overall: EMPTY, byRegime: [], recent: [], live: [], openCount: 0 };
  // Filtro por motor pode falhar antes da migration (coluna `engine` ausente) →
  // mostra "em construção" (configured:true) em vez de "indisponível".
  const emptyConfigured = { ...empty, configured: true };
  if (!sb) return empty;

  let q = sb
    .from("signals")
    .select("symbol, timeframe, direction, seal, engine, outcome, pnl_r, regime, emitted_at, resolved_at")
    .not("outcome", "is", null)
    .order("resolved_at", { ascending: false });
  // "Todos" (sem filtro) = visão CONSOLIDADA dos 5 motores. Selecionar um motor
  // mostra só ele (variantes experimentais são rotuladas na página).
  if (engine) q = q.eq("engine", engine);
  else q = q.in("engine", ALL_ENGINES);
  const { data, error } = await q;
  if (error) return engine ? emptyConfigured : empty;

  const rows = (data ?? []) as DbRow[];
  const withR = rows.filter((r) => r.pnl_r != null);
  const recs = withR.map((r) => ({ outcome: r.outcome, pnlR: Number(r.pnl_r) }));
  const overall = recs.length ? aggregateTrackRecord(recs) : EMPTY;

  const byRegimeMap = new Map<string, { outcome: SignalOutcome; pnlR: number }[]>();
  for (const r of withR) {
    const k = r.regime ?? "—";
    const arr = byRegimeMap.get(k) ?? [];
    arr.push({ outcome: r.outcome, pnlR: Number(r.pnl_r) });
    byRegimeMap.set(k, arr);
  }
  const byRegime = [...byRegimeMap.entries()]
    .map(([regime, rs]) => ({ regime, stats: aggregateTrackRecord(rs) }))
    .sort((a, b) => b.stats.n - a.stats.n);

  const recent: TrackRecordRow[] = rows.slice(0, 40).map((r) => ({
    symbol: r.symbol, timeframe: r.timeframe, direction: r.direction, seal: r.seal, engine: r.engine ?? "padrao",
    outcome: r.outcome, pnlR: r.pnl_r == null ? 0 : Number(r.pnl_r), regime: r.regime,
    emittedAt: r.emitted_at, resolvedAt: r.resolved_at,
  }));

  let openQ = sb
    .from("signals")
    .select("symbol, timeframe, direction, seal, engine, tp1_hit, tp2_hit, tp3_hit, stop_stage, emitted_at", { count: "exact" })
    .is("outcome", null)
    .order("emitted_at", { ascending: false })
    .limit(20);
  if (engine) openQ = openQ.eq("engine", engine);
  else openQ = openQ.in("engine", ALL_ENGINES);
  const { data: openData, count } = await openQ;

  const live: LiveSignal[] = (openData ?? []).map((r) => {
    const o = r as unknown as { symbol: string; timeframe: string; direction: string; seal: string; engine: string | null; tp1_hit: boolean; tp2_hit: boolean; tp3_hit: boolean; stop_stage: string; emitted_at: string };
    return {
      symbol: o.symbol, timeframe: o.timeframe, direction: o.direction, seal: o.seal, engine: o.engine ?? "padrao",
      tp1Hit: !!o.tp1_hit, tp2Hit: !!o.tp2_hit, tp3Hit: !!o.tp3_hit, stopStage: o.stop_stage ?? "initial", emittedAt: o.emitted_at,
    };
  });

  return { configured: true, overall, byRegime, recent, live, openCount: count ?? 0 };
}
