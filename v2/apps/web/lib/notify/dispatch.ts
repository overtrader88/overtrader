/**
 * Fan-out de notificações por canal (Fase C2). Junta os provedores (Telegram /
 * e-mail) com as preferências do usuário e o canal oficial. Best-effort e
 * gracioso: cada canal não configurado simplesmente não dispara.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyTelegram, type NotifyResult } from "./telegram";
import { notifyEmail } from "./email";
import { formatSignalTelegram, formatSignalEmailSubject, formatSignalEmailHtml, formatAlertTelegram, type BroadcastSignal } from "./format";

/** Publica um sinal OFICIAL no canal Telegram público (env `TELEGRAM_SIGNALS_CHAT_ID`). */
export async function broadcastSignal(signal: BroadcastSignal): Promise<NotifyResult> {
  return notifyTelegram(process.env.TELEGRAM_SIGNALS_CHAT_ID, formatSignalTelegram(signal));
}

export interface AlertPayload {
  symbol: string;
  timeframe: string;
  signal: string;
  strength: number;
}

/** Entrega um alerta de watchlist nos canais do usuário (Telegram se vinculado, e-mail se opt-in). */
export async function dispatchUserAlert(
  sb: SupabaseClient,
  userId: string,
  alert: AlertPayload,
): Promise<{ telegram: NotifyResult; email: NotifyResult }> {
  let telegram: NotifyResult = "unconfigured";
  let email: NotifyResult = "unconfigured";

  try {
    const { data: link } = await sb.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle();
    if (link?.chat_id) telegram = await notifyTelegram(link.chat_id as string, formatAlertTelegram(alert));
  } catch { /* gracioso */ }

  try {
    const { data: prof } = await sb.from("profiles").select("email, notify_email").eq("id", userId).maybeSingle();
    if (prof?.notify_email && prof.email) {
      const sig = `${alert.symbol} ${alert.timeframe.toUpperCase()} — ${alert.signal}`;
      email = await notifyEmail(prof.email as string, `Overtrader · alerta ${sig}`, `<p>${sig} (força ${alert.strength})</p><p style="font-size:12px;color:#666">Análise, não recomendação. Risco de perda.</p>`);
    }
  } catch { /* gracioso */ }

  return { telegram, email };
}

export { formatSignalEmailSubject, formatSignalEmailHtml };
