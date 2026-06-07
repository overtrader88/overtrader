/**
 * Envio de Web Push (server-only). Configura VAPID a partir do env e dispara a
 * notificação para TODAS as inscrições do usuário. Best-effort: inscrições
 * mortas (404/410) são removidas; ausência de chaves VAPID = no-op gracioso.
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushResult = "sent" | "unconfigured" | "no_subscriptions" | "error";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured: boolean | null = null;
function ensureVapid(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@overtrader.com.br";
  if (!pub || !priv) { configured = false; return false; }
  try { webpush.setVapidDetails(subject, pub, priv); configured = true; }
  catch { configured = false; }
  return configured;
}

interface Row { id: string; endpoint: string; p256dh: string; auth: string; }

export async function sendPushToUser(sb: SupabaseClient, userId: string, payload: PushPayload): Promise<PushResult> {
  if (!ensureVapid()) return "unconfigured";
  const { data } = await sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", userId);
  const subs = (data ?? []) as Row[];
  if (!subs.length) return "no_subscriptions";

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let ok = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      ok++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
    }
  }));
  if (dead.length) { try { await sb.from("push_subscriptions").delete().in("id", dead); } catch { /* gracioso */ } }
  return ok > 0 ? "sent" : "error";
}
