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

  let body: { userId?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { userId, plan } = body;
  if (typeof userId !== "string" || !userId || typeof plan !== "string" || !PLANS.includes(plan)) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  const { error } = await sb.from("profiles").update({ plan }).eq("id", userId);
  if (error) return NextResponse.json({ error: "Falha ao atualizar." }, { status: 500 });

  await sb.from("audit_log").insert({
    actor: me!.email,
    action: "admin_set_plan",
    target: userId,
    metadata: { plan },
  });

  return NextResponse.json({ ok: true, userId, plan });
}
