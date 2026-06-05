/**
 * Alertas do usuário (tabela `alerts`, RLS via SSR client).
 *   GET   → lista (até 50) + contagem de não lidos
 *   PATCH → marca todos como lidos
 * Anônimo: GET vazio; PATCH 401.
 */
import { NextResponse } from "next/server";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [], unread: 0 });
  const sb = await supabaseServerSSR();
  const { data } = await sb
    .from("alerts")
    .select("id,symbol,timeframe,signal,message,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []) as { read_at: string | null }[];
  const unread = items.filter((a) => !a.read_at).length;
  return NextResponse.json({ items, unread });
}

export async function PATCH(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const sb = await supabaseServerSSR();
  await sb.from("alerts").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  return NextResponse.json({ ok: true });
}
