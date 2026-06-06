/**
 * POST /api/admin/set-credits — admin define o saldo de créditos de um usuário.
 * Gate: usuário logado E e-mail em ADMIN_EMAILS. Body: { userId, credits } onde
 * `credits` é o saldo ABSOLUTO desejado (inteiro ≥ 0).
 *
 * Em vez de sobrescrever o saldo (o que perderia a trilha), lê o saldo atual,
 * calcula o delta e chama o RPC atômico `credit_user` — que atualiza
 * user_credits e grava a movimentação em credit_transactions. Também registra
 * a ação em audit_log.
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CREDITS = 100_000; // teto de sanidade p/ evitar erro de digitação

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: { userId?: string; credits?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { userId, credits } = body;
  if (
    typeof userId !== "string" || !userId ||
    typeof credits !== "number" || !Number.isInteger(credits) ||
    credits < 0 || credits > MAX_CREDITS
  ) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  // Saldo atual (0 se ainda não houver linha).
  const { data: row } = await sb.from("user_credits").select("balance").eq("user_id", userId).maybeSingle();
  const current = (row?.balance as number | undefined) ?? 0;
  const delta = credits - current;

  if (delta !== 0) {
    const { error } = await sb.rpc("credit_user", {
      p_user_id: userId,
      p_amount: delta,
      p_source: "admin_adjust",
      p_metadata: { actor: me!.email, from: current, to: credits },
    });
    if (error) return NextResponse.json({ error: "Falha ao atualizar." }, { status: 500 });
  }

  await sb.from("audit_log").insert({
    actor: me!.email,
    action: "admin_set_credits",
    target: userId,
    metadata: { from: current, to: credits, delta },
  });

  return NextResponse.json({ ok: true, userId, credits });
}
