/**
 * Pareamento Telegram do usuário logado (Fase C5).
 *  GET  → status do vínculo ({ linked })
 *  POST → gera um pair_token e devolve o deep link `t.me/<bot>?start=<token>`
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createPairToken, getLinkStatus } from "@/lib/telegram/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ linked: false }, { status: 401 });
  return NextResponse.json(await getLinkStatus(user.id));
}

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "telegram-link", 10);
  if (limited) return limited;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const res = await createPairToken(user.id);
  if (!res) return NextResponse.json({ error: "Telegram não configurado." }, { status: 503 });
  return NextResponse.json(res);
}
