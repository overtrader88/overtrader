/**
 * Cron: resolve o desfecho REAL dos sinais abertos. Para cada sinal aberto, busca
 * os candles POSTERIORES à emissão e roda `resolveOutcome` (motor, puro). Grava o
 * outcome quando resolve; senão só marca `checked_at`. Protegido por CRON_SECRET.
 *
 *   GET/POST /api/cron/resolve-signals?secret=...&limit=50
 */
import { NextResponse } from "next/server";
import { resolveLifecycle, type SignalPlan } from "@tradeai/engine";
import { TIMEFRAME_MS, isTimeframe } from "@tradeai/shared";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { supabaseService } from "@/lib/supabase/server";
import { getCandles, realProviders } from "@/lib/market/providers";
import { getMarketCache } from "@/lib/market/cache-supabase";
import { sendScoreboardToAdmin, type ClosedOp } from "@/lib/signals/scoreboard";
import { generateAutopsy } from "@/lib/analysis/narrative";

/** Teto de autópsias por rodada (cada uma é 1 chamada LLM ~1-2s; maxDuration=120). */
const MAX_AUTOPSIES = 8;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Janela máxima (candles após a emissão) antes de marcar EXPIRED — POR TIMEFRAME
 * (era -j2, achado 22): 60 candles fixos eram ~10 dias no 4h mas ~2-3 MESES no
 * 1d, sequestrando o slot do dedup (1 aberto por mercado+motor) por trimestre.
 * O mapa mantém a vida em tempo-calendário (~10 dias). Vale também pros sinais
 * JÁ ABERTOS (regra operacional, não fitted): 1d com >25 candles decorridos será
 * marcado EXPIRED na próxima rodada, marcado a mercado no close do candle 25 —
 * efeito one-shot registrado no changelog/commit.
 */
const MAX_DURATION_BY_TF: Partial<Record<Timeframe, number>> = { "1h": 120, "4h": 60, "1d": 25, "1w": 12 };
const DEFAULT_MAX_DURATION = 60;
const FETCH_LIMIT = 400;

interface SignalRow {
  id: string; symbol: string; asset_type: string; timeframe: string; side: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number; emitted_at: string;
  engine?: string | null; regime?: string | null; conviction?: number | null; rationale?: string | null;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? "50") || 50));
  const { data, error } = await sb
    .from("signals")
    .select("id, symbol, asset_type, timeframe, side, entry, stop_loss, tp1, tp2, tp3, emitted_at, engine, regime, conviction, rationale")
    .is("outcome", null)
    .order("emitted_at", { ascending: true })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const cache = getMarketCache();
  const now = new Date().toISOString();
  let resolved = 0;
  let open = 0;
  let skipped = 0;
  let autopsies = 0;
  const closedDecisive: ClosedOp[] = []; // fechadas por lucro/prejuízo nesta rodada

  for (const s of (data ?? []) as SignalRow[]) {
    try {
      const candles = await getCandles(s.symbol, s.asset_type as AssetType, s.timeframe as Timeframe, FETCH_LIMIT, {
        providers, cache, cacheTtlSeconds: 300, minCandles: 30,
      });
      const emittedMs = Date.parse(s.emitted_at);
      // Inclui o candle DA EMISSÃO (era -j2, achado 20): `c.time` é o OPEN time e
      // o cron emite segundos após a virada, então `> emittedMs` apagava as
      // primeiras 4h (24h no 1d) do trade — stop varrido ou TP tocado nesse
      // candle nunca contava. `> emittedMs - tfMs` inclui o candle cujo intervalo
      // contém a emissão, com regras SIMÉTRICAS (stop E alvo contam). Resíduo
      // conservador: o trecho open→emissão do próprio candle entra no julgamento.
      const tfMs = isTimeframe(s.timeframe) ? TIMEFRAME_MS[s.timeframe] : 0;
      const future = candles.filter((c) => c.time > emittedMs - tfMs);
      const plan: SignalPlan = {
        side: s.side === "sell" ? "sell" : "buy",
        entry: s.entry, stopLoss: s.stop_loss, takeProfit1: s.tp1, takeProfit2: s.tp2, takeProfit3: s.tp3,
      };
      const maxDuration = (isTimeframe(s.timeframe) ? MAX_DURATION_BY_TF[s.timeframe] : undefined) ?? DEFAULT_MAX_DURATION;
      const res = resolveLifecycle(plan, future, maxDuration);
      // Progresso do ciclo de vida (gravado mesmo em abertos, p/ a vitrine ao vivo).
      const lifecycle = {
        tp1_hit: res.tp1Hit, tp2_hit: res.tp2Hit, tp3_hit: res.tp3Hit,
        stop_stage: res.stopStage, current_stop: res.currentStop, checked_at: now,
      };
      if (res.status === "resolved") {
        await sb.from("signals").update({
          ...lifecycle,
          outcome: res.outcome, exit_price: res.exitPrice, pnl_r: res.pnlR,
          duration_candles: res.durationCandles, resolved_at: now,
        }).eq("id", s.id);
        resolved++;
        // Fechou por lucro/prejuízo (TP/SL, não expiração) → entra no placar do admin.
        if (res.outcome === "TP1" || res.outcome === "TP2" || res.outcome === "TP3" || res.outcome === "SL") {
          closedDecisive.push({
            engine: s.engine ?? "padrao", symbol: s.symbol, timeframe: s.timeframe,
            side: s.side, outcome: res.outcome, pnlR: res.pnlR ?? 0,
          });
        }
        // AUTÓPSIA: sinal morto no stop ganha post-mortem da IA (update separado e
        // best-effort — sem a coluna `autopsy` da 0015, falha silencioso).
        if (res.outcome === "SL" && autopsies < MAX_AUTOPSIES) {
          try {
            const autopsy = await generateAutopsy({
              symbol: s.symbol, timeframe: s.timeframe, side: s.side, engine: s.engine ?? "padrao",
              entry: s.entry, stopLoss: s.stop_loss, exitPrice: res.exitPrice ?? null,
              durationCandles: res.durationCandles ?? null,
              conviction: s.conviction ?? null, rationale: s.rationale ?? null, regime: s.regime ?? null,
            });
            if (autopsy) {
              await sb.from("signals").update({ autopsy }).eq("id", s.id);
              autopsies++;
            }
          } catch { /* autópsia nunca derruba a resolução */ }
        }
      } else {
        await sb.from("signals").update(lifecycle).eq("id", s.id);
        open++;
      }
    } catch {
      skipped++;
    }
  }
  // Placar dos motores no Telegram do admin — só quando algo fechou por lucro/prejuízo.
  let scoreboard: string = "skip";
  if (closedDecisive.length > 0) {
    scoreboard = await sendScoreboardToAdmin(closedDecisive[closedDecisive.length - 1]!);
  }

  return NextResponse.json({ total: data?.length ?? 0, resolved, open, skipped, autopsies, closedDecisive: closedDecisive.length, scoreboard });
}

export const GET = handle;
export const POST = handle;
