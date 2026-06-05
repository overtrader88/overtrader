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
import { emitSignal, type EmitReason } from "@/lib/signals/emit";
import { TRACKED_MARKETS } from "@/lib/signals/tracked";
import { broadcastSignal } from "@/lib/notify/dispatch";
import { generateNarrative } from "@/lib/analysis/narrative";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tally: Record<EmitReason, number> = { emitted: 0, neutral: 0, "low-seal": 0, "open-exists": 0, "no-db": 0, error: 0 };
  let broadcast = 0;
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
    } catch {
      tally.error++;
    }
  }
  return NextResponse.json({ markets: TRACKED_MARKETS.length, broadcast, ...tally });
}

export const GET = handle;
export const POST = handle;
