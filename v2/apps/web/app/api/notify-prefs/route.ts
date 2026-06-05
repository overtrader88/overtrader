/**
 * Preferências de notificação do usuário logado (Fase C2 / e-mail).
 *  GET  → { notifyEmail }
 *  POST { enabled: boolean } → atualiza profiles.notify_email (RLS: dono atualiza)
 * O envio em si só ocorre se RESEND_API_KEY/EMAIL_FROM estiverem configurados
 * (no-op gracioso). Aqui só persiste o opt-in.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { getCurrentUser } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifyEmail: false }, { status: 401 });
  const sb = await supabaseServerSSR();
  const { data } = await sb.from("profiles").select("notify_email").eq("id", user.id).maybeSingle();
  return NextResponse.json({ notifyEmail: !!data?.notify_email, email: user.email });
}

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "notify-prefs", 20);
  if (limited) return limited;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login." }, { status: 401 });

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Campo 'enabled' deve ser booleano." }, { status: 400 });
  }

  const sb = await supabaseServerSSR();
  const { error } = await sb.from("profiles").update({ notify_email: body.enabled }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Falha ao salvar preferência." }, { status: 500 });

  return NextResponse.json({ notifyEmail: body.enabled });
}
