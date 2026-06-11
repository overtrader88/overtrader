/**
 * Comparação de performance entre os MOTORES (padrão × por classe) para o painel
 * admin. Lê os sinais (ambos os motores), agrega o REALIZADO (win rate, PF, R, com
 * a mesma matemática do track record público) e calcula o NÃO-REALIZADO das
 * posições abertas — marcando a mercado o preço atual para saber se cada operação
 * fecharia hoje em lucro ou prejuízo. Tudo server-side, best-effort.
 */
import { aggregateTrackRecord, type SignalOutcome } from "@tradeai/engine";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import type { EngineComparison, EngineStat, ClassEngines, OpenPosition, GroupStat, BreakdownRow, EquityPoint, ClosedOpRow, DailyRow, DailyCell } from "@/components/admin-shared";

interface Row {
  engine: string | null;
  symbol: string;
  asset_type: string;
  timeframe: string;
  side: string;
  direction: string;
  entry: number;
  stop_loss: number;
  outcome: SignalOutcome | null;
  pnl_r: number | null;
  emitted_at: string;
  resolved_at: string | null;
}

const ASSET_PT: Record<string, string> = {
  crypto: "Cripto", forex: "Forex", commodities: "Commodities", indices: "Índices", stocks: "Ações",
};
const isWin = (o: SignalOutcome) => o === "TP1" || o === "TP2" || o === "TP3";

/** Estatística de um grupo de sinais resolvidos. */
function groupStat(resolved: { outcome: SignalOutcome; pnlR: number }[]): GroupStat {
  let wins = 0, sl = 0, totalR = 0;
  for (const r of resolved) {
    totalR += r.pnlR;
    if (isWin(r.outcome)) wins++;
    else if (r.outcome === "SL") sl++;
  }
  const decisive = wins + sl;
  return { n: resolved.length, winRatePct: decisive > 0 ? (wins / decisive) * 100 : 0, totalR, wins, decisive };
}

/** Recorte por chave (classe ou TF) × TODOS os motores, ordenado por amostra total. */
function breakdownBy(rows: Row[], keyOf: (r: Row) => string, labelOf: (k: string) => string): BreakdownRow[] {
  const byKey = new Map<string, Map<string, { outcome: SignalOutcome; pnlR: number }[]>>();
  for (const r of rows) {
    if (r.outcome == null || r.pnl_r == null) continue;
    const k = keyOf(r);
    const eng = r.engine ?? "padrao";
    let em = byKey.get(k);
    if (!em) { em = new Map(); byKey.set(k, em); }
    const arr = em.get(eng) ?? em.set(eng, []).get(eng)!;
    arr.push({ outcome: r.outcome, pnlR: Number(r.pnl_r) });
  }
  return [...byKey.entries()]
    .map(([k, em]) => {
      const stats: Record<string, GroupStat> = {};
      for (const [eng, recs] of em) stats[eng] = groupStat(recs);
      return { key: k, label: labelOf(k), stats };
    })
    .sort((a, b) => Object.values(b.stats).reduce((s, g) => s + g.n, 0) - Object.values(a.stats).reduce((s, g) => s + g.n, 0));
}

const ENGINE_LABELS: Record<string, string> = {
  padrao: "Motor padrão", classe: "Motor por classe",
  padrao_b: "Padrão-B (ATR largo)", classe_b: "Classe-B (convicção alta)",
  llm: "Motor LLM (decisão da IA)",
  condicional: "Condicional (lógica por regime)", contrario: "Contrário (controle — inverso do padrão)",
  consenso: "Consenso (padrão ∩ classe)",
};
const ENGINE_IDS = ["padrao", "padrao_b", "classe", "classe_b", "llm", "condicional", "contrario", "consenso"] as const;
const DAY = 86_400_000;

/** Marca a mercado: R não-realizado de uma posição aberta dado o preço atual. */
function unrealizedR(side: string, entry: number, stop: number, price: number): number | null {
  const dist = Math.abs(entry - stop);
  if (!(dist > 0)) return null;
  return side === "sell" ? (entry - price) / dist : (price - entry) / dist;
}

/** Agrega os EngineStat (por motor) de um conjunto de linhas + posições abertas (já marcadas a mercado). Reusado no agregado global e por classe de ativo. */
function buildEngineStats(rows: Row[], open: OpenPosition[]): EngineStat[] {
  const byEngine = new Map<string, Row[]>();
  for (const r of rows) {
    const e = r.engine ?? "padrao";
    (byEngine.get(e) ?? byEngine.set(e, []).get(e)!).push(r);
  }
  return ENGINE_IDS.map((e) => {
    const list = byEngine.get(e) ?? [];
    const resolved = list.filter((r) => r.outcome != null && r.pnl_r != null);
    const stats = aggregateTrackRecord(resolved.map((r) => ({ outcome: r.outcome as SignalOutcome, pnlR: Number(r.pnl_r) })));
    const wins = stats.outcomes.TP1 + stats.outcomes.TP2 + stats.outcomes.TP3;
    // Assimetria realizada: ganho médio (TP1/2/3) × perda média (SL) × payoff.
    const winRs = resolved.filter((r) => isWin(r.outcome as SignalOutcome)).map((r) => Number(r.pnl_r));
    const lossRs = resolved.filter((r) => r.outcome === "SL").map((r) => Number(r.pnl_r));
    const avgWinR = winRs.length ? winRs.reduce((s, v) => s + v, 0) / winRs.length : 0;
    const avgLossR = lossRs.length ? lossRs.reduce((s, v) => s + v, 0) / lossRs.length : 0;
    const payoff = avgLossR !== 0 ? avgWinR / Math.abs(avgLossR) : 0;
    const openList = open.filter((o) => o.engine === e);
    const emittedAts = list.map((r) => r.emitted_at).sort();
    const first = emittedAts[0] ?? null;
    const last = emittedAts[emittedAts.length - 1] ?? null;
    const spanDays = first && last ? Math.max(1, (new Date(last).getTime() - new Date(first).getTime()) / DAY) : 1;
    return {
      engine: e, label: ENGINE_LABELS[e] ?? e,
      resolved: stats.n, decisive: stats.decisive, wins, losses: stats.outcomes.SL, expired: stats.outcomes.EXPIRED,
      winRatePct: stats.winRate.value * 100, profitFactor: stats.profitFactor.value, avgR: stats.avgR.value, totalR: stats.totalR,
      avgWinR, avgLossR, payoff,
      open: list.filter((r) => r.outcome == null).length, emittedTotal: list.length,
      firstEmittedAt: first, lastEmittedAt: last, perDay: list.length / spanDays,
      openInProfit: openList.filter((o) => o.status === "profit").length,
      openInLoss: openList.filter((o) => o.status === "loss").length,
      openNeutral: openList.filter((o) => o.status === "flat" || o.status === "unknown").length,
      openUnrealizedR: openList.reduce((s, o) => s + (o.unrealizedR ?? 0), 0),
    };
  });
}

export async function getEngineComparison(): Promise<EngineComparison | null> {
  const sb = supabaseService();
  if (!sb) return null;

  const { data, error } = await sb
    .from("signals")
    .select("engine, symbol, asset_type, timeframe, side, direction, entry, stop_loss, outcome, pnl_r, emitted_at, resolved_at")
    .order("emitted_at", { ascending: false })
    .limit(5000);
  if (error) return null;
  const rows = (data ?? []) as Row[];

  // Preço atual das posições abertas (marca a mercado). Cap p/ não estourar a página.
  const openRows = rows.filter((r) => r.outcome == null).slice(0, 40);
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  const priceOf = new Map<string, number | null>();
  await Promise.all(
    [...new Map(openRows.map((r) => [`${r.symbol}|${r.asset_type}|${r.timeframe}`, r])).values()].map(async (r) => {
      const key = `${r.symbol}|${r.asset_type}|${r.timeframe}`;
      try {
        const candles = await getCandles(r.symbol, r.asset_type as AssetType, r.timeframe as Timeframe, 3, {
          providers, cache, cacheTtlSeconds: 300, minCandles: 1,
        });
        priceOf.set(key, candles.length ? candles[candles.length - 1]!.close : null);
      } catch {
        priceOf.set(key, null);
      }
    }),
  );

  const open: OpenPosition[] = openRows.map((r) => {
    const price = priceOf.get(`${r.symbol}|${r.asset_type}|${r.timeframe}`) ?? null;
    const ur = price != null ? unrealizedR(r.side, r.entry, r.stop_loss, price) : null;
    const status: OpenPosition["status"] = ur == null ? "unknown" : ur > 0.03 ? "profit" : ur < -0.03 ? "loss" : "flat";
    return {
      engine: r.engine ?? "padrao", assetType: r.asset_type, symbol: r.symbol, timeframe: r.timeframe, side: r.side, direction: r.direction,
      entry: r.entry, emittedAt: r.emitted_at, currentPrice: price, unrealizedR: ur, status,
    };
  });

  const engines: EngineStat[] = buildEngineStats(rows, open);

  // Mesmas métricas, mas POR CLASSE DE ATIVO (p/ o filtro do ranking — fechado e
  // aberto por classe). Ordena por amostra total da classe (desc).
  const classes = [...new Set(rows.map((r) => r.asset_type))];
  const byClassEngine: ClassEngines[] = classes
    .map((cls) => ({
      class: cls,
      label: ASSET_PT[cls] ?? cls,
      engines: buildEngineStats(rows.filter((r) => r.asset_type === cls), open.filter((o) => o.assetType === cls)),
    }))
    .sort((a, b) => rows.filter((r) => r.asset_type === b.class).length - rows.filter((r) => r.asset_type === a.class).length);

  // Recortes por classe de ativo, por timeframe, por ativo e por ativo+timeframe.
  const byClass = breakdownBy(rows, (r) => r.asset_type, (k) => ASSET_PT[k] ?? k);
  const byTimeframe = breakdownBy(rows, (r) => r.timeframe, (k) => k.toUpperCase());
  const byAsset = breakdownBy(rows, (r) => r.symbol, (k) => k);
  const bySymbolTf = breakdownBy(rows, (r) => `${r.symbol}__${r.timeframe}`, (k) => { const [s, t] = k.split("__"); return `${s} · ${(t ?? "").toUpperCase()}`; });

  // Curva de R acumulado por motor (os 5): timeline de resolvidos (asc) com running
  // total por motor; cada ponto carrega o snapshot de TODOS os motores.
  const resolvedSorted = rows
    .filter((r) => r.outcome != null && r.pnl_r != null && r.resolved_at)
    .sort((a, b) => new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime());
  const cum: Record<string, number> = {};
  for (const e of ENGINE_IDS) cum[e] = 0;
  const equity: EquityPoint[] = resolvedSorted.map((r) => {
    const e = r.engine ?? "padrao";
    cum[e] = (cum[e] ?? 0) + Number(r.pnl_r);
    const values: Record<string, number> = {};
    for (const id of ENGINE_IDS) values[id] = Math.round((cum[id] ?? 0) * 100) / 100;
    return { t: r.resolved_at!, values };
  });

  // Operações FECHADAS (resolvidas) recentes, todos os motores.
  const closed: ClosedOpRow[] = rows
    .filter((r) => r.outcome != null && r.resolved_at)
    .sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime())
    .slice(0, 60)
    .map((r) => ({
      engine: r.engine ?? "padrao", symbol: r.symbol, timeframe: r.timeframe, side: r.side,
      direction: r.direction, outcome: r.outcome as string, pnlR: r.pnl_r != null ? Number(r.pnl_r) : 0, resolvedAt: r.resolved_at,
    }));

  // Resultado DIÁRIO das finalizadas (por dia × motor), mais recentes primeiro.
  const dmap = new Map<string, Record<string, DailyCell>>();
  for (const r of rows) {
    if (r.outcome == null || !r.resolved_at) continue;
    const day = r.resolved_at.slice(0, 10);
    const eng = r.engine ?? "padrao";
    let pe = dmap.get(day);
    if (!pe) { pe = {}; dmap.set(day, pe); }
    const c = pe[eng] ?? (pe[eng] = { wins: 0, stops: 0, expired: 0, totalR: 0, n: 0 });
    c.n++; c.totalR += Number(r.pnl_r ?? 0);
    if (isWin(r.outcome)) c.wins++; else if (r.outcome === "SL") c.stops++; else c.expired++;
  }
  const daily: DailyRow[] = [...dmap.entries()]
    .map(([date, perEngine]) => ({ date, perEngine }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  return { engines, byClassEngine, open, byClass, byTimeframe, byAsset, bySymbolTf, equity, closed, daily };
}
