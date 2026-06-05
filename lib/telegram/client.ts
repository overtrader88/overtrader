/**
 * Cliente do Telegram Bot API (via fetch nativo, sem deps).
 * Apenas as funcoes que usamos: sendMessage, setWebhook.
 *
 * Doc: https://core.telegram.org/bots/api
 */

const TELEGRAM_API = "https://api.telegram.org";

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN nao configurado. Crie um bot via @BotFather e adicione ao .env.local."
    );
  }
  return t;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

interface SendMessageOptions {
  /** Habilita formatacao Markdown V2 ou HTML */
  parseMode?: "MarkdownV2" | "HTML";
  /** Desabilita preview de URLs no chat */
  disableWebPreview?: boolean;
  /** Botoes inline (opcional) */
  inlineKeyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options.parseMode) body.parse_mode = options.parseMode;
    if (options.disableWebPreview) body.disable_web_page_preview = true;
    if (options.inlineKeyboard) {
      body.reply_markup = { inline_keyboard: options.inlineKeyboard };
    }

    const res = await fetch(`${TELEGRAM_API}/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${errBody.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

/**
 * Helper: escapa caracteres especiais do MarkdownV2.
 * Caracteres reservados: _*[]()~`>#+-=|{}.!
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

/**
 * Configura webhook (chama uma vez em deploy).
 */
export async function setTelegramWebhook(
  webhookUrl: string,
  secretToken?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = { url: webhookUrl };
    if (secretToken) body.secret_token = secretToken;

    const res = await fetch(`${TELEGRAM_API}/bot${token()}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
