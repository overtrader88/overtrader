/**
 * Live Trading — sessões com metering no servidor.
 *   GET                 → { sessions: [{symbol,...}], plan }
 *   POST   { symbol }   → ativa (cobra 2 + abre sessão)
 *   DELETE { symbol }   → desativa (acerta horas + encerra)
 * Requer login. Ativação é exclusiva PRO/PRO+.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { activateLive, deactivateLive, listActiveLive } from "@/lib/live/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const sessions = await listActiveLive(user.id);
  return NextResponse.json({ sessions, plan: user.plan });
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  let symbol: string | undefined;
  try { symbol = ((await req.json()) as { symbol?: string }).symbol?.toUpperCase(); } catch { /* */ }
  if (!symbol) return NextResponse.json({ error: "symbol ausente" }, { status: 400 });

  const res = await activateLive(user.id, user.plan, symbol);
  if (res.ok) return NextResponse.json({ ok: true, remaining: res.remaining });

  const status = res.reason === "plan" ? 403 : res.reason === "no_credits" ? 402 : res.reason === "already_active" ? 409 : res.reason === "market_closed" ? 409 : 400;
  const msg: Record<string, string> = {
    plan: "O Live Trading é exclusivo para assinantes PRO/PRO+.",
    no_credits: "Créditos insuficientes (a live custa 2 créditos/hora).",
    already_active: "Esta live já está ativa.",
    market_closed: "Mercado fechado para este ativo.",
    unknown_symbol: "Ativo desconhecido.",
    error: "Não foi possível ativar agora.",
  };
  return NextResponse.json({ error: msg[res.reason], reason: res.reason }, { status });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  let symbol: string | undefined;
  try { symbol = ((await req.json()) as { symbol?: string }).symbol?.toUpperCase(); } catch { /* */ }
  if (!symbol) return NextResponse.json({ error: "symbol ausente" }, { status: 400 });
  await deactivateLive(user.id, symbol);
  return NextResponse.json({ ok: true });
}
