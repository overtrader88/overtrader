/**
 * POST /api/admin/human-signal — DESAFIO HUMANOS vs MÁQUINAS: registra o sinal
 * de um competidor HUMANO no mesmo track record forward dos motores, via RPC
 * `record_signal` com engine="humano_<slug>". Plano manual (entrada/stop/tp1-3)
 * validado (geometria por lado). O cron resolve-signals resolve o desfecho como
 * faz com qualquer motor. Gate: ADMIN_EMAILS (mesmo do llm-probe).
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";
import { emitHumanSignal } from "@/lib/signals/emit";
import { humanSignalSchema, validateHumanPlan } from "@/lib/signals/human";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = humanSignalSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `Parâmetros inválidos: ${issue ? `${issue.path.join(".")} — ${issue.message}` : "body malformado"}.` }, { status: 400 });
  }
  const p = parsed.data;
  const planError = validateHumanPlan(p);
  if (planError) return NextResponse.json({ error: planError }, { status: 400 });

  const res = await emitHumanSignal({
    slug: p.slug, symbol: p.symbol.toUpperCase(), assetType: p.assetType, timeframe: p.timeframe,
    side: p.side, strong: p.strong,
    plan: { entry: p.entry, stopLoss: p.stop, takeProfit1: p.tp1, takeProfit2: p.tp2, takeProfit3: p.tp3 },
  });
  if (res.reason === "no-db") return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });
  if (res.reason === "open-exists") {
    return NextResponse.json({ error: "Já existe um sinal ABERTO deste competidor neste símbolo+timeframe (1 posição viva por mercado/motor)." }, { status: 409 });
  }
  if (res.reason !== "emitted" || !res.id) return NextResponse.json({ error: "Falha ao registrar o sinal." }, { status: 500 });

  // Trilha de auditoria (não bloqueia o resultado se falhar).
  const sb = supabaseService();
  const { error: auditErr } = (await sb?.from("audit_log").insert({
    actor: me!.email,
    action: "human_signal",
    target: `humano_${p.slug}`,
    metadata: { signalId: res.id, symbol: p.symbol.toUpperCase(), timeframe: p.timeframe, side: p.side, entry: p.entry, stop: p.stop, tp1: p.tp1, tp2: p.tp2, tp3: p.tp3 },
  })) ?? {};
  if (auditErr) console.error("[human-signal] audit_log falhou (não bloqueia):", auditErr);

  return NextResponse.json({ ok: true, id: res.id, engine: `humano_${p.slug}` });
}
