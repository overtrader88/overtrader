/**
 * POST /api/admin/notify — admin dispara uma mensagem de reativação para um
 * usuário, por e-mail (Resend) ou Telegram. Gate: ADMIN_EMAILS.
 * Body: { userId: string, channel: "email" | "telegram", kind?: "reactivate" | "expiring" }.
 * Grava trilha em audit_log. Retorna o NotifyResult ("sent"/"unconfigured"/"error").
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";
import { notifyEmail } from "@/lib/notify/email";
import { notifyTelegram } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://overtrader.com.br";
const CHANNELS = ["email", "telegram"];

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  let body: { userId?: string; channel?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { userId, channel } = body;
  const kind = body.kind === "expiring" ? "expiring" : "reactivate";
  if (typeof userId !== "string" || !userId || typeof channel !== "string" || !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  const { data: prof } = await sb.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
  if (!prof) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  const p = prof as { email: string; full_name: string | null };
  const first = (p.full_name || p.email).split(/[\s@.]+/)[0] || "trader";

  const subject = kind === "expiring" ? "Seu plano Overtrader está perto de vencer" : "Sentimos sua falta no Overtrader 👋";
  const line = kind === "expiring"
    ? "Seu plano está chegando ao fim. Renove para não perder o acesso aos 143 ativos, IA e backtest."
    : "Faz um tempo que você não roda uma análise. Que tal abrir e conferir os sinais de hoje?";

  let result: string;
  if (channel === "email") {
    const html = `<p>Olá, ${first}!</p><p>${line}</p><p><a href="${SITE}/analise">Abrir o Overtrader</a></p><p style="color:#888;font-size:12px">Conteúdo educativo · não é recomendação de investimento.</p>`;
    result = await notifyEmail(p.email, subject, html);
  } else {
    const { data: tg } = await sb.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle();
    const chatId = (tg as { chat_id: string | null } | null)?.chat_id;
    if (!chatId) return NextResponse.json({ error: "Usuário sem Telegram vinculado." }, { status: 400 });
    result = await notifyTelegram(chatId, `Olá, ${first}! ${line}\n\n${SITE}/analise`);
  }

  await sb.from("audit_log").insert({
    actor: me!.email,
    action: "admin_notify",
    target: userId,
    metadata: { channel, kind, result },
  });

  if (result === "unconfigured") return NextResponse.json({ error: `Canal ${channel} não configurado (sem credenciais).` }, { status: 503 });
  if (result === "error") return NextResponse.json({ error: "Falha no envio." }, { status: 502 });
  return NextResponse.json({ ok: true, result });
}
