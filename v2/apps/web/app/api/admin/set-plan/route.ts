/**
 * POST /api/admin/set-plan — admin concede/altera o plano de um usuário.
 * Gate: usuário logado E e-mail em ADMIN_EMAILS. Usa service-role pra atualizar
 * profiles.plan. Body: { userId: string, plan: "free"|"pro"|"pro_plus" }.
 * Grava trilha em audit_log.
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLANS = ["free", "pro", "pro_plus"];

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: { userId?: string; plan?: string; reason?: string; expiresAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { userId, plan, reason } = body;
  if (typeof userId !== "string" || !userId || typeof plan !== "string" || !PLANS.includes(plan)) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  // Data de cortesia opcional (YYYY-MM-DD ou ISO). Só faz sentido em plano pago.
  let expiresAt: string | null = null;
  if (body.expiresAt && plan !== "free") {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Data de expiração inválida." }, { status: 400 });
    expiresAt = d.toISOString();
  }

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  const { error } = await sb.from("profiles").update({ plan }).eq("id", userId);
  if (error) return NextResponse.json({ error: `Falha ao atualizar: ${error.message}` }, { status: 500 });

  // Cortesia com prazo → cria/atualiza uma subscription MANUAL (sem hubla_event_id),
  // pra o plano concedido aparecer na aba Vencimentos. Remove cortesias anteriores
  // do usuário (subs sem evento Hubla) antes de inserir a nova.
  if (expiresAt) {
    await sb.from("subscriptions").delete().eq("user_id", userId).is("hubla_event_id", null);
    const { error: subErr } = await sb.from("subscriptions").insert({
      user_id: userId, plan, period: "monthly", status: "active", current_period_end: expiresAt,
    });
    if (subErr) return NextResponse.json({ error: `Plano alterado, mas falhou a cortesia: ${subErr.message}` }, { status: 500 });
  }

  await sb.from("audit_log").insert({
    actor: me!.email,
    action: "admin_set_plan",
    target: userId,
    metadata: { plan, reason: reason ?? null, expiresAt },
  });

  return NextResponse.json({ ok: true, userId, plan, expiresAt });
}
