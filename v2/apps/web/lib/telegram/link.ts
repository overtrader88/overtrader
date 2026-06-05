/**
 * Vínculo de conta ↔ Telegram (Fase C5). O usuário (logado) gera um pair_token e
 * abre o bot com `/start <token>`; o webhook casa o token e grava o chat_id.
 * Escrita via service-role (a tabela `telegram_links` só dá SELECT ao dono).
 */
import { randomBytes } from "node:crypto";
import { supabaseService } from "@/lib/supabase/server";

/** Cria/renova o token de pareamento do usuário. Retorna token + deep link, ou null. */
export async function createPairToken(userId: string): Promise<{ token: string; url: string } | null> {
  const sb = supabaseService();
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!sb) return null;
  const token = randomBytes(9).toString("base64url"); // ~12 chars URL-safe
  const { error } = await sb
    .from("telegram_links")
    .upsert({ user_id: userId, pair_token: token, chat_id: null, linked_at: null }, { onConflict: "user_id" });
  if (error) return null;
  const url = username ? `https://t.me/${username}?start=${token}` : `https://t.me/?start=${token}`;
  return { token, url };
}

/** Casa um pair_token com o chat_id (chamado pelo webhook). Retorna o user vinculado ou null. */
export async function linkChat(token: string, chatId: string): Promise<string | null> {
  const sb = supabaseService();
  if (!sb || !token) return null;
  const { data, error } = await sb
    .from("telegram_links")
    .update({ chat_id: chatId, linked_at: new Date().toISOString() })
    .eq("pair_token", token)
    .select("user_id")
    .maybeSingle();
  if (error || !data) return null;
  return (data as { user_id: string }).user_id;
}

/** Desvincula (limpa o chat_id) — opt-out via `/stop`. Retorna true se removeu algo. */
export async function unlinkChat(chatId: string): Promise<boolean> {
  const sb = supabaseService();
  if (!sb) return false;
  const { data } = await sb
    .from("telegram_links")
    .update({ chat_id: null, linked_at: null })
    .eq("chat_id", chatId)
    .select("user_id");
  return Array.isArray(data) && data.length > 0;
}

/** Status do vínculo do usuário (para a UI). */
export async function getLinkStatus(userId: string): Promise<{ linked: boolean }> {
  const sb = supabaseService();
  if (!sb) return { linked: false };
  const { data } = await sb.from("telegram_links").select("chat_id").eq("user_id", userId).maybeSingle();
  return { linked: !!(data as { chat_id: string | null } | null)?.chat_id };
}
