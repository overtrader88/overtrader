/**
 * Inscrição Web Push do usuário.
 *   POST   { subscription, userAgent? } → guarda (upsert por endpoint)
 *   DELETE { endpoint }                 → remove a inscrição
 * Requer autenticação (RLS via SSR client). Anônimo → 401.
 */
import { NextResponse } from "next/server";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  userAgent?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let body: SubBody;
  try { body = (await req.json()) as SubBody; } catch { return NextResponse.json({ error: "json inválido" }, { status: 400 }); }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "inscrição incompleta" }, { status: 400 });
  }

  const sb = await supabaseServerSSR();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: body.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  let endpoint: string | undefined;
  try { endpoint = ((await req.json()) as { endpoint?: string }).endpoint; } catch { /* ignore */ }
  if (!endpoint) return NextResponse.json({ error: "endpoint ausente" }, { status: 400 });
  const sb = await supabaseServerSSR();
  await sb.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
