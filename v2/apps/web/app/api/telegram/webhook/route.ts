/**
 * Webhook do bot Telegram (Fase C5). Recebe updates e trata os comandos:
 *  - /start <token> → vincula este chat à conta dona do token (recebe alertas por DM)
 *  - /stop          → desvincula
 * Protegido pelo header secreto do Telegram (`X-Telegram-Bot-Api-Secret-Token`).
 * Sempre responde 200 (senão o Telegram re-tenta).
 */
import { NextResponse } from "next/server";
import { parseCommand } from "@/lib/telegram/commands";
import { linkChat, unlinkChat } from "@/lib/telegram/link";
import { sendTelegram } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function reply(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) await sendTelegram(token, chatId, text);
}

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { message?: { chat?: { id?: number | string }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
  const parsed = parseCommand(msg?.text);
  if (!chatId || !parsed) return NextResponse.json({ ok: true });

  if (parsed.cmd === "start") {
    if (!parsed.arg) {
      await reply(chatId, "👋 Bem-vindo ao Overtrader. Para receber seus alertas aqui, gere o link de conexão no app (Alertas → Conectar Telegram).");
    } else {
      const userId = await linkChat(parsed.arg, chatId);
      await reply(
        chatId,
        userId
          ? "✅ Telegram conectado! Você passará a receber aqui os alertas da sua watchlist.\n\n<i>Análise, não recomendação de investimento. Risco de perda.</i>"
          : "❌ Código inválido ou expirado. Gere um novo no app (Alertas → Conectar Telegram).",
      );
    }
  } else if (parsed.cmd === "stop") {
    const removed = await unlinkChat(chatId);
    await reply(chatId, removed ? "🔕 Desconectado. Você não receberá mais alertas por aqui." : "Você não estava conectado.");
  } else {
    await reply(chatId, "Comandos: <b>/start &lt;código&gt;</b> para conectar · <b>/stop</b> para desconectar.");
  }

  return NextResponse.json({ ok: true });
}
