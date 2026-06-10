/**
 * Resumo "enquanto você dormia" (Feature B). Junta os sinais de QUALIDADE públicos
 * (padrão/classe) emitidos na janela recente que AINDA estão válidos para entrada —
 * marcados a mercado com `resolveLifecycle` (mesma gestão do track record/monitor).
 *
 * Honesto: só entra no resumo o que ainda dá pra agir (entrada na zona, antes do
 * TP1). O que já disparou/stopou fica de fora — não adianta mandar pro usuário
 * algo que ele "perdeu". PURO o suficiente: a borda (cron) injeta o supabase.
 */
import { resolveLifecycle, type SignalPlan } from "@tradeai/engine";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";

const LC_MAX_DURATION = 60;
const LC_FETCH_LIMIT = 400;
/** Acima disso o preço já andou demais rumo ao TP1 — não é mais "ainda dá pra entrar". */
const MAX_PROGRESS = 0.6;

const DIR_PT: Record<string, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA",
  WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};

export interface DigestItem {
  symbol: string;
  timeframe: string;
  direction: string;
  side: string;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  emittedAt: string;
  /** zone = na zona · better = preço a favor · late = já andou (mas ainda pré-TP1). */
  entryState: "zone" | "better" | "late";
  progressPct: number;
}

interface Row {
  symbol: string; asset_type: string; timeframe: string; direction: string; side: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number; emitted_at: string;
}

const fmtNum = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });

/**
 * Monta o resumo: sinais públicos abertos emitidos nas últimas `sinceHours` horas
 * que continuam pré-TP1 e com entrada ainda alcançável.
 */
export async function buildMorningDigest(sb: SupabaseClient, sinceHours = 12): Promise<DigestItem[]> {
  const sinceIso = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { data, error } = await sb
    .from("signals")
    .select("symbol, asset_type, timeframe, direction, side, entry, stop_loss, tp1, tp2, tp3, emitted_at")
    .is("outcome", null)
    .in("engine", ["padrao", "classe"]) // só motores de produção no resumo do usuário
    .gte("emitted_at", sinceIso)
    .order("emitted_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];

  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();

  const items = await Promise.all((data as Row[]).map(async (r): Promise<DigestItem | null> => {
    try {
      const candles = await getCandles(r.symbol, r.asset_type as AssetType, r.timeframe as Timeframe, LC_FETCH_LIMIT, {
        providers, cache, cacheTtlSeconds: 300, minCandles: 30,
      });
      const future = candles.filter((c) => c.time > Date.parse(r.emitted_at));
      const side = r.side === "sell" ? "sell" : "buy";
      const plan: SignalPlan = { side, entry: r.entry, stopLoss: r.stop_loss, takeProfit1: r.tp1, takeProfit2: r.tp2, takeProfit3: r.tp3 };
      const lc = resolveLifecycle(plan, future, LC_MAX_DURATION);
      // Já encerrou ou já passou do TP1 → não entra no resumo (não dá mais pra agir no plano).
      if (lc.status === "resolved" || lc.tp1Hit) return null;
      const price = candles.length ? candles[candles.length - 1]!.close : r.entry;
      const dist = r.tp1 - r.entry;
      const progress = dist !== 0 ? (price - r.entry) / dist : 0;
      if (progress > MAX_PROGRESS) return null; // andou demais rumo ao TP1
      const better = side === "buy" ? price < r.entry : price > r.entry;
      const entryState: DigestItem["entryState"] = progress <= 0.25 ? (better ? "better" : "zone") : "late";
      return {
        symbol: r.symbol, timeframe: r.timeframe, direction: r.direction, side,
        entry: r.entry, stop: r.stop_loss, tp1: r.tp1, tp2: r.tp2, tp3: r.tp3,
        emittedAt: r.emitted_at, entryState, progressPct: Math.max(0, Math.round(progress * 100)),
      };
    } catch {
      return null;
    }
  }));

  return items.filter((x): x is DigestItem => x !== null);
}

const STATE_TAG: Record<DigestItem["entryState"], string> = {
  better: "✅ entrada a favor",
  zone: "✅ entrada na zona",
  late: "⚠️ entrada tardia",
};

/** Mensagem HTML do resumo para o Telegram. Vazio → null (não enviar). */
export function formatDigestTelegram(items: DigestItem[], appUrl = "https://overtrader.com.br"): string | null {
  if (items.length === 0) return null;
  const lines = items.slice(0, 10).map((it) => {
    const dir = DIR_PT[it.direction] ?? it.direction;
    return [
      `<b>${it.symbol}</b> · ${it.timeframe.toUpperCase()} — ${dir}`,
      `   entrada ${fmtNum(it.entry)} · stop ${fmtNum(it.stop)} · alvos ${fmtNum(it.tp1)}/${fmtNum(it.tp2)}/${fmtNum(it.tp3)}`,
      `   ${STATE_TAG[it.entryState]}${it.entryState === "late" ? ` (já andou ~${it.progressPct}% até o TP1)` : ""}`,
    ].join("\n");
  });
  return [
    `☀️ <b>Bom dia!</b> Enquanto você dormia, ${items.length} setup(s) de qualidade surgiram e <b>ainda dá pra entrar</b>:`,
    "",
    lines.join("\n\n"),
    "",
    `Veja ao vivo: ${appUrl}/monitor`,
    `<i>Análise, não recomendação. Toda operação tem risco de perda.</i>`,
  ].join("\n");
}
