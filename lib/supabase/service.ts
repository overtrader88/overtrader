/**
 * Service-role Supabase client.
 *
 * USAR APENAS em rotas server-side privilegiadas (webhooks, admin tasks).
 * Bypass RLS — qualquer codigo que rode com isso tem acesso total.
 *
 * NUNCA importar em components client ou expor a chave pro frontend.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Service client: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar no .env.local"
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
