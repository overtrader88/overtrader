/**
 * Client Supabase com SERVICE ROLE (ignora RLS) — uso SERVER-ONLY.
 *
 * Lê env diretamente (NÃO o getEnv global) para não acoplar as rotas de mercado
 * a segredos de outras áreas (OPENAI/CRON). A chave é `SUPABASE_SERVICE_ROLE_KEY`
 * (não-`NEXT_PUBLIC_`) → o Next nunca a inclui no bundle do cliente.
 *
 * Retorna `null` quando as vars não estão presentes — os callers fazem fallback
 * (ex.: cache em memória), então o app funciona mesmo sem Supabase configurado.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function supabaseService(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
