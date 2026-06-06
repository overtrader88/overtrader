/**
 * POST /api/admin/set-credits — admin define o saldo de créditos de um usuário.
 * Gate: usuário logado E e-mail em ADMIN_EMAILS. Body: { userId, credits } onde
 * `credits` é o saldo ABSOLUTO desejado (inteiro ≥ 0).
 *
 * Faz UPSERT direto do saldo-alvo (sempre ≥ 0) e grava a movimentação (delta)
 * em credit_transactions + a ação em audit_log.
 *
 * ⚠️ NÃO usar o RPC `credit_user` aqui: ele faz `insert ... values (user_id,
 * p_amount) on conflict do update`, e o Postgres avalia o CHECK (balance >= 0)
 * na TUPLA do insert proposto (= p_amount). Com delta NEGATIVO (admin reduzindo
 * créditos) isso viola o check e falha, mesmo a linha já existindo. O upsert do
 * valor absoluto não tem esse problema.
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CREDITS = 100_000; // teto de sanidade p/ evitar erro de digitação

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) {
    console.error("[set-credits] negado — me:", me ? me.email : "null (sessão não resolvida)");
    return NextResponse.json({ error: `Acesso negado (sessão: ${me ? me.email : "não autenticada"}).` }, { status: 403 });
  }

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
    console.error("[set-credits] params inválidos:", { userId, credits });
    return NextResponse.json({ error: `Parâmetros inválidos (userId=${userId}, credits=${credits}).` }, { status: 400 });
  }

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  // Saldo atual (0 se ainda não houver linha) — só p/ calcular o delta da trilha.
  const { data: row, error: readErr } = await sb.from("user_credits").select("balance").eq("user_id", userId).maybeSingle();
  if (readErr) {
    console.error("[set-credits] erro lendo saldo:", readErr);
    return NextResponse.json({ error: `Falha ao ler saldo: ${readErr.message}` }, { status: 500 });
  }
  const current = (row?.balance as number | undefined) ?? 0;
  const delta = credits - current;

  if (delta !== 0) {
    // UPSERT do valor absoluto (≥ 0) — evita o bug do CHECK no insert do credit_user.
    const { error } = await sb
      .from("user_credits")
      .upsert({ user_id: userId, balance: credits, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) {
      console.error("[set-credits] upsert falhou:", error);
      return NextResponse.json({ error: `Falha ao atualizar: ${error.message}` }, { status: 500 });
    }

    // Trilha no ledger (não bloqueia o resultado se falhar).
    const { error: txErr } = await sb.from("credit_transactions").insert({
      user_id: userId,
      amount: delta,
      source: "admin_adjust",
      metadata: { actor: me!.email, from: current, to: credits },
    });
    if (txErr) console.error("[set-credits] credit_transactions falhou (não bloqueia):", txErr);
  }

  const { error: auditErr } = await sb.from("audit_log").insert({
    actor: me!.email,
    action: "admin_set_credits",
    target: userId,
    metadata: { from: current, to: credits, delta },
  });
  if (auditErr) console.error("[set-credits] audit_log falhou (não bloqueia):", auditErr);

  return NextResponse.json({ ok: true, userId, credits });
}
