/**
 * Cliente Supabase para uso em Server Components, Route Handlers e Server Actions.
 * Mantém os cookies sincronizados entre cliente e servidor.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Caso seja chamado de um Server Component (sem permissão de set),
            // o middleware fará a sincronização. É seguro ignorar.
          }
        },
      },
    }
  );
}

/**
 * Cliente com service role - usar APENAS em Route Handlers / Server Actions
 * onde é necessário bypassar RLS (ex.: webhooks, jobs administrativos).
 * NUNCA expor no client.
 */
export function createServiceRoleClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurado.");
  }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: chamadas administrativas não escrevem cookies
        },
      },
    }
  );
}
