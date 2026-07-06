/**
 * Cron: emissão do track record OFICIAL. Para cada mercado curado, roda a análise
 * completa e carimba o sinal se for de qualidade (selo verde/amarelo + acionável).
 * O RPC deduplica (1 aberto por mercado). Protegido por CRON_SECRET.
 *
 *   GET/POST /api/cron/emit-signals?secret=...
 */
import { NextResponse } from "next/server";
import { signalSide } from "@tradeai/shared";
import { analyzeSymbol } from "@/lib/analysis/service";
import { emitSignal, emitClassSignal, emitSignalB, emitClassSignalB, emitLlmSignal, emitLlmDsSignal, emitLlmCotSignal, emitLlmSurvSignal, emitLlmDsSurvSignal, emitLlmVsfSignal, emitLlmDsVsfSignal, emitLlmVsfSurvSignal, emitLlmDsVsfSurvSignal, emitConditionalSignal, emitContrarianSignal, emitConsensusSignal, emitEvoSignal, prepareEvoSlots, type EmitReason, type ClassEmitReason } from "@/lib/signals/emit";
import { loadServerExtras } from "@/lib/analysis/class-extras";
import { TRACKED_MARKETS } from "@/lib/signals/tracked";
import { marketState } from "@/lib/market/hours";
import { isStaleForEmission } from "@/lib/market/freshness";
import { broadcastSignal } from "@/lib/notify/dispatch";
import { generateNarrative } from "@/lib/analysis/narrative";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // +1 chamada LLM por mercado (Motor LLM)

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tally: Record<EmitReason, number> = { emitted: 0, neutral: 0, weak: 0, "low-seal": 0, "open-exists": 0, "no-db": 0, error: 0 };
  const classTally: Record<ClassEmitReason, number> = {
    emitted: 0, neutral: 0, weak: 0, "low-seal": 0, "open-exists": 0, "no-db": 0, error: 0, "low-conviction": 0, "no-geometry": 0,
  };
  // Mercados PULADOS antes de qualquer análise/emissão (era -j2, achado 19):
  // fechado no fim de semana ou último candle fechado velho demais (dado morto).
  const skippedMarkets = { "market-closed": 0, "stale-data": 0 };
  let broadcast = 0;
  let classEmitted = 0;
  let padraoBEmitted = 0;
  let classeBEmitted = 0;
  let llmEmitted = 0;
  let llmDsEmitted = 0;
  let llmCotEmitted = 0;
  let llmSurvEmitted = 0;
  let llmDsSurvEmitted = 0;
  let llmVsfEmitted = 0;
  let llmDsVsfEmitted = 0;
  let llmVsfSurvEmitted = 0;
  let llmDsVsfSurvEmitted = 0;
  let evoEmitted = 0;
  let condEmitted = 0;
  // EVOLUÇÃO: semeia/renasce os núcleos ANTES das emissões (morte → cruzamento → g+1).
  const evoSlots = await prepareEvoSlots();
  let invEmitted = 0;
  let consEmitted = 0;
  for (const m of TRACKED_MARKETS) {
    try {
      // Gate 1 (era -j2): mercado FECHADO (fim de semana em forex/índices/metais)
      // → não emite a preço morto. 100% upstream, uniforme pros 17 motores.
      if (!marketState(m.assetType, new Date()).open) {
        skippedMarkets["market-closed"]++;
        continue;
      }
      // dropForming: a análise da emissão só vê candles FECHADOS (mesma
      // distribuição do backtest que dá o selo). UI/resolve seguem intactos.
      const dto = await analyzeSymbol(m.symbol, m.assetType, m.timeframe, "complete", { dropForming: true });
      // Gate 2 (era -j2): frescor pelo CLOSE esperado do último candle fechado —
      // mata os ticks intraday fantasma do SPX 4h e protege de provider degradado.
      if (dto.lastCandleTime != null && isStaleForEmission(dto.lastCandleTime, m.timeframe, m.assetType, Date.now())) {
        skippedMarkets["stale-data"]++;
        continue;
      }
      const { reason, id } = await emitSignal(dto, m.symbol, m.assetType, m.timeframe);
      tally[reason]++;
      // Sinal novo carimbado → gera+guarda a narrativa (1×) e publica no canal (C2).
      if (reason === "emitted") {
        if (id) {
          const narrative = await generateNarrative(dto);
          if (narrative) await supabaseService()?.from("signals").update({ narrative }).eq("id", id);
        }
        const r = dto.analysis.risk;
        const sent = await broadcastSignal({
          symbol: m.symbol, timeframe: m.timeframe, direction: dto.analysis.signal.signal,
          side: signalSide(dto.analysis.signal.signal) === "sell" ? "sell" : "buy",
          entry: r.entry, stopLoss: r.stopLoss, tp1: r.takeProfit1, tp2: r.takeProfit2, tp3: r.takeProfit3,
          seal: dto.quality?.status ?? "yellow", rr1: r.rr1,
        });
        if (sent === "sent") broadcast++;
      }

      // MOTOR 2 ("por classe"): segunda leitura, carimbada em paralelo (engine='classe').
      // Best-effort — falha ou RPC sem p_engine (antes da migration) não derruba o Motor 1.
      try {
        const extras = await loadServerExtras(m.symbol, m.assetType);
        const cls = await emitClassSignal(dto, extras, m.symbol, m.assetType, m.timeframe);
        classTally[cls.reason]++;
        if (cls.reason === "emitted") classEmitted++;
        // Variantes experimentais A/B (forward) — Padrão-B e Classe-B. Best-effort.
        const b1 = await emitSignalB(dto, m.symbol, m.assetType, m.timeframe);
        if (b1.reason === "emitted") padraoBEmitted++;
        const b2 = await emitClassSignalB(dto, extras, m.symbol, m.assetType, m.timeframe);
        if (b2.reason === "emitted") classeBEmitted++;
        // Os 9 motores LLM em PARALELO (decisões independentes entre si): com 12
        // mercados, sequencial estourava o maxDuration=300s da função na Vercel.
        const [llm, llmDs, llmCot, llmSurv, llmDsSurv, llmVsf, llmDsVsf, llmVsfSurv, llmDsVsfSurv] = await Promise.all([
          emitLlmSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmDsSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmCotSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmSurvSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmDsSurvSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmVsfSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmDsVsfSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmVsfSurvSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
          emitLlmDsVsfSurvSignal(dto, extras, m.symbol, m.assetType, m.timeframe),
        ]);
        if (llm.reason === "emitted") llmEmitted++;
        if (llmDs.reason === "emitted") llmDsEmitted++;
        if (llmCot.reason === "emitted") llmCotEmitted++;
        if (llmSurv.reason === "emitted") llmSurvEmitted++;
        if (llmDsSurv.reason === "emitted") llmDsSurvEmitted++;
        if (llmVsf.reason === "emitted") llmVsfEmitted++;
        if (llmDsVsf.reason === "emitted") llmDsVsfEmitted++;
        if (llmVsfSurv.reason === "emitted") llmVsfSurvEmitted++;
        if (llmDsVsfSurv.reason === "emitted") llmDsVsfSurvEmitted++;
        // Motores EVOLUTIVOS (núcleos vigentes) — em paralelo entre si.
        const evoResults = await Promise.all(evoSlots.map((slot) => emitEvoSignal(dto, extras, m.symbol, m.assetType, m.timeframe, slot)));
        for (const r of evoResults) if (r.reason === "emitted") evoEmitted++;
        // Motores experimentais determinísticos (condicional / contrário / consenso).
        const cond = await emitConditionalSignal(dto, m.symbol, m.assetType, m.timeframe);
        if (cond.reason === "emitted") condEmitted++;
        const inv = await emitContrarianSignal(dto, m.symbol, m.assetType, m.timeframe);
        if (inv.reason === "emitted") invEmitted++;
        const cons = await emitConsensusSignal(dto, extras, m.symbol, m.assetType, m.timeframe);
        if (cons.reason === "emitted") consEmitted++;
      } catch {
        classTally.error++; // erro no Motor 2/variantes nunca compromete o Motor 1.
      }
    } catch {
      tally.error++;
    }
  }
  return NextResponse.json({ markets: TRACKED_MARKETS.length, skippedMarkets, broadcast, classEmitted, padraoBEmitted, classeBEmitted, llmEmitted, llmDsEmitted, llmCotEmitted, llmSurvEmitted, llmDsSurvEmitted, llmVsfEmitted, llmDsVsfEmitted, llmVsfSurvEmitted, llmDsVsfSurvEmitted, evoEmitted, evoGen: evoSlots.map((s) => `${s.slot}:g${s.generation}`), condEmitted, invEmitted, consEmitted, motor1: tally, motor2: classTally });
}

export const GET = handle;
export const POST = handle;
