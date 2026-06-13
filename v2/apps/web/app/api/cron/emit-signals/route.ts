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
import { emitSignal, emitClassSignal, emitSignalB, emitClassSignalB, emitLlmSignal, emitLlmDsSignal, emitConditionalSignal, emitContrarianSignal, emitConsensusSignal, type EmitReason, type ClassEmitReason } from "@/lib/signals/emit";
import { loadServerExtras } from "@/lib/analysis/class-extras";
import { TRACKED_MARKETS } from "@/lib/signals/tracked";
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

  const tally: Record<EmitReason, number> = { emitted: 0, neutral: 0, "low-seal": 0, "open-exists": 0, "no-db": 0, error: 0 };
  const classTally: Record<ClassEmitReason, number> = {
    emitted: 0, neutral: 0, "low-seal": 0, "open-exists": 0, "no-db": 0, error: 0, "low-conviction": 0, "no-geometry": 0,
  };
  let broadcast = 0;
  let classEmitted = 0;
  let padraoBEmitted = 0;
  let classeBEmitted = 0;
  let llmEmitted = 0;
  let llmDsEmitted = 0;
  let condEmitted = 0;
  let invEmitted = 0;
  let consEmitted = 0;
  for (const m of TRACKED_MARKETS) {
    try {
      const dto = await analyzeSymbol(m.symbol, m.assetType, m.timeframe, "complete");
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
        const llm = await emitLlmSignal(dto, extras, m.symbol, m.assetType, m.timeframe);
        if (llm.reason === "emitted") llmEmitted++;
        const llmDs = await emitLlmDsSignal(dto, extras, m.symbol, m.assetType, m.timeframe);
        if (llmDs.reason === "emitted") llmDsEmitted++;
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
  return NextResponse.json({ markets: TRACKED_MARKETS.length, broadcast, classEmitted, padraoBEmitted, classeBEmitted, llmEmitted, llmDsEmitted, condEmitted, invEmitted, consEmitted, motor1: tally, motor2: classTally });
}

export const GET = handle;
export const POST = handle;
