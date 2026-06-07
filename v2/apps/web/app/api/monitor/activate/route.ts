/**
 * POST /api/monitor/activate — ativa o Monitor ao vivo (PRO/PRO+, 20 créditos / 5 dias).
 * Requer login. Retorna o resultado (ok + validade, ou motivo da recusa).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { activateMonitor } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const res = await activateMonitor(user.id, user.plan);
  if (res.ok) return NextResponse.json({ ok: true, expiresAt: res.expiresAt, remaining: res.remaining });

  const status = res.reason === "plan" ? 403 : res.reason === "no_credits" ? 402 : res.reason === "already_active" ? 409 : 500;
  const msg = {
    plan: "O Monitor é exclusivo para assinantes PRO/PRO+.",
    no_credits: "Créditos insuficientes (a ativação custa 20 créditos).",
    already_active: "Seu monitor já está ativo.",
    error: "Não foi possível ativar agora.",
  }[res.reason];
  return NextResponse.json({ error: msg, reason: res.reason, expiresAt: res.expiresAt }, { status });
}
