/**
 * Persistência e leitura do HISTÓRICO de análises (tabela `analyses`, RLS por
 * usuário via client SSR). Persistir é best-effort e DEDUPLICADO (não grava a
 * mesma análise em janela curta) — viewing é grátis, sem cobrança de crédito.
 */
import type { SignalDirection } from "@tradeai/shared";
import { supabaseServerSSR } from "./supabase/server-ssr";
import { getCurrentUser } from "./supabase/auth";
import type { FullAnalysis } from "./analysis/full";

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

export interface AnalysisRow {
  id: string;
  symbol: string;
  assetType: string;
  timeframe: string;
  signal: SignalDirection;
  strength: number;
  seal: string | null;
  pf: number | null;
  rr: number | null;
  period: string | null;
  createdAt: string;
}

type Sb = Awaited<ReturnType<typeof supabaseServerSSR>>;

/** Persiste a análise visualizada (best-effort, deduplicado por usuário+ativo+TF). */
export async function recordAnalysisView(dto: FullAnalysis): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const sb = await supabaseServerSSR();
  const m = dto.analysis.meta;
  try {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: dup } = await sb
      .from("analyses")
      .select("id")
      .eq("user_id", user.id)
      .eq("symbol", m.asset)
      .eq("timeframe", m.timeframe)
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (dup) return;
    await sb.from("analyses").insert({
      user_id: user.id,
      symbol: m.asset,
      asset_type: m.assetType,
      timeframe: m.timeframe,
      signal: dto.analysis.signal.signal,
      strength: dto.analysis.signal.strength,
      result: dto,
    });
  } catch {
    /* best-effort — nunca quebra a página */
  }
}

/** Carrega o SNAPSHOT salvo de uma análise (grátis — sem recomputar/cobrar). */
export async function getAnalysisById(id: string): Promise<{ dto: FullAnalysis; symbol: string; assetType: string; timeframe: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const sb = await supabaseServerSSR();
  const { data } = await sb
    .from("analyses")
    .select("symbol,asset_type,timeframe,result")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  if (!row?.result) return null;
  return {
    dto: row.result as FullAnalysis,
    symbol: String(row.symbol),
    assetType: String(row.asset_type),
    timeframe: String(row.timeframe),
  };
}

function mapRow(r: Record<string, unknown>): AnalysisRow {
  return {
    id: String(r.id),
    symbol: String(r.symbol),
    assetType: String(r.asset_type),
    timeframe: String(r.timeframe),
    signal: r.signal as SignalDirection,
    strength: Number(r.strength),
    seal: (r.seal as string | null | undefined) ?? null,
    pf: r.pf != null ? Number(r.pf) : null,
    rr: r.rr != null ? Number(r.rr) : null,
    period: (r.period as string | null | undefined) ?? null,
    createdAt: String(r.created_at),
  };
}

const RICH =
  "id,symbol,asset_type,timeframe,signal,strength,created_at,seal:result->quality->>status,pf:result->backtest->profitFactor->>value,rr:result->analysis->risk->>rr1,period:result->>period";
const SCALAR = "id,symbol,asset_type,timeframe,signal,strength,created_at";

async function fetchRows(sb: Sb, userId: string, select: string, from: number, to: number, q?: string, cls?: string) {
  let query = sb
    .from("analyses")
    .select(select, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("symbol", `%${q}%`);
  if (cls) query = query.eq("asset_type", cls);
  return query;
}

export interface ListResult {
  items: AnalysisRow[];
  total: number;
}

export async function listAnalyses(opts: { page?: number; limit?: number; q?: string; cls?: string } = {}): Promise<ListResult> {
  const user = await getCurrentUser();
  if (!user) return { items: [], total: 0 };
  const sb = await supabaseServerSSR();
  const limit = Math.min(50, Math.max(1, opts.limit ?? 12));
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const q = opts.q?.trim().toUpperCase() || undefined;
  const cls = opts.cls?.trim() || undefined;

  // Tenta o select rico (com selo/PF/período via JSON path); cai p/ scalar se a
  // versão do PostgREST não aceitar a sintaxe — histórico nunca fica vazio à toa.
  let res = await fetchRows(sb, user.id, RICH, from, to, q, cls);
  if (res.error) res = await fetchRows(sb, user.id, SCALAR, from, to, q, cls);
  if (res.error || !res.data) return { items: [], total: 0 };

  return {
    items: (res.data as unknown as Record<string, unknown>[]).map(mapRow),
    total: res.count ?? res.data.length,
  };
}

export async function recentAnalyses(limit = 6): Promise<AnalysisRow[]> {
  const { items } = await listAnalyses({ limit });
  return items;
}

/**
 * id da análise SALVA mais recente de um (ativo, timeframe) do usuário — usado
 * para "ver de graça" a partir de um contexto que JÁ foi pago (monitor ativo /
 * alerta da watchlist), sem gerar/cobrar de novo. Retorna null se não houver.
 */
export async function latestAnalysisId(symbol: string, timeframe: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const sb = await supabaseServerSSR();
  const { data } = await sb
    .from("analyses")
    .select("id")
    .eq("user_id", user.id)
    .eq("symbol", symbol)
    .eq("timeframe", timeframe)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
