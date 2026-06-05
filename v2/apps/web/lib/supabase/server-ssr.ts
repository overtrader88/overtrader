/**
 * Client Supabase do SERVIDOR ligado aos COOKIES da request (anon key + sessão
 * do usuário). Respeita RLS — é o client correto para ler/escrever dados do
 * próprio usuário em RSC, route handlers e server actions.
 *
 * Distinto do `supabaseService()` (service-role, ignora RLS, p/ cache/admin).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServerSSR() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            /* chamado de um RSC (read-only) — o middleware cuida do refresh */
          }
        },
      },
    },
  );
}
