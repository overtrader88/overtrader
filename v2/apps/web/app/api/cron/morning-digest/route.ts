/**
 * Cron: resumo "enquanto você dormia" (Feature B). Roda 1x/dia (~08:00 BRT =
 * 11:00 UTC). Monta os sinais públicos da madrugada que AINDA dão entrada e
 * envia pelo Telegram a cada usuário vinculado (telegram_links = opt-in).
 *
 *   GET/POST /api/cron/morning-digest?secret=...&since=12[&dry=1]
 *
 * `dry=1` → devolve o que SERIA enviado (mensagem + nº de destinatários) sem
 * disparar nada. Protegido por CRON_SECRET.
 */
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { buildMorningDigest, formatDigestTelegram } from "@/lib/signals/morning-digest";
import { notifyTelegram } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const url = new URL(req.url);
  const sinceHours = Math.min(48, Math.max(1, Number(url.searchParams.get("since") ?? "12") || 12));
  const dry = url.searchParams.get("dry") === "1";

  const items = await buildMorningDigest(sb, sinceHours);
  const message = formatDigestTelegram(items);

  // Sem nada acionável → não envia (não enche o usuário de resumo vazio).
  if (!message) return NextResponse.json({ items: 0, sent: 0, skipped: "empty" });

  // Destinatários = usuários com Telegram vinculado (vínculo = opt-in).
  const { data: links } = await sb.from("telegram_links").select("chat_id").not("chat_id", "is", null);
  const chatIds = [...new Set(((links ?? []) as { chat_id: string | null }[]).map((l) => l.chat_id).filter((c): c is string => !!c))];

  if (dry) {
    return NextResponse.json({ dry: true, items: items.length, recipients: chatIds.length, preview: message });
  }

  let sent = 0, failed = 0;
  for (const chatId of chatIds) {
    const r = await notifyTelegram(chatId, message);
    if (r === "sent") sent++; else failed++;
  }
  return NextResponse.json({ items: items.length, recipients: chatIds.length, sent, failed });
}

export const GET = handle;
export const POST = handle;
