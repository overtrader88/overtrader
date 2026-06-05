/**
 * Canal Telegram (Fase C2). `sendTelegram` é a chamada crua à Bot API (fetch
 * injetável → testável sem rede). `notifyTelegram` lê o token do ambiente e
 * vira no-op gracioso quando não configurado — nada quebra sem credenciais.
 */
import { withTimeout } from "@/lib/http/with-timeout";

type FetchLike = (url: string, init?: unknown) => Promise<{ ok: boolean }>;

const TG_API = "https://api.telegram.org";

export type NotifyResult = "sent" | "unconfigured" | "error";

/** Envia uma mensagem via Bot API. Retorna true se a API aceitou. */
export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetchImpl(`${TG_API}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      }),
      8000,
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Envia usando o token do ambiente. `unconfigured` se faltar token/chat. */
export async function notifyTelegram(chatId: string | undefined | null, text: string): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return "unconfigured";
  return (await sendTelegram(token, chatId, text)) ? "sent" : "error";
}
