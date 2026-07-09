/**
 * Sessão do usuário atual (server-side) — junta auth + profile + saldo de
 * créditos num objeto pronto pra UI (AppBar). Retorna null se anônimo.
 */
import { supabaseServerSSR } from "./server-ssr";
import { supabaseService } from "./server";
import { isAdminEmail } from "../admin";

export { isAdminEmail };

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  credits: number;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sb = await supabaseServerSSR();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: profile, error: profileErr }, { data: credit }] = await Promise.all([
    sb.from("profiles").select("plan, email, full_name").eq("id", user.id).maybeSingle(),
    sb.from("user_credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  // SELF-HEAL: sessão de auth VÁLIDA porém SEM linha em `profiles` (conta órfã —
  // ex.: profile removido à mão no painel, enquanto auth.users + créditos sobrevivem).
  // Reprovisiona o profile (idempotente, via service role, que ignora RLS). NÃO
  // concede créditos aqui de propósito: apagar profile e relogar NÃO deve renovar o
  // trial (anti-farm). Sem isto, a sessão era tratada como "FREE fantasma" invisível
  // no /admin. Best-effort: se o service role não estiver configurado, degrada.
  let prof = profile;
  if (!prof && !profileErr) {
    const svc = supabaseService();
    if (svc) {
      const { data: healed } = await svc
        .from("profiles")
        .upsert(
          { id: user.id, email: user.email ?? "", full_name: (user.user_metadata?.full_name as string | undefined) ?? null },
          { onConflict: "id" },
        )
        .select("plan, email, full_name")
        .maybeSingle();
      if (healed) prof = healed;
    }
  }

  return {
    id: user.id,
    email: user.email ?? (prof?.email as string | undefined) ?? "",
    fullName: (prof?.full_name as string | null | undefined) ?? null,
    plan: (prof?.plan as string | undefined) ?? "free",
    credits: (credit?.balance as number | undefined) ?? 0,
  };
}

/** True se o usuário atual é admin. */
export function isAdmin(user: CurrentUser | null): boolean {
  return isAdminEmail(user?.email);
}

/** Rótulo do plano p/ a UI (free→FREE, pro→PRO, pro_plus→PRO+). */
export function planLabel(plan: string): string {
  if (plan === "pro_plus") return "PRO+";
  return plan.toUpperCase();
}

/** Iniciais p/ o avatar (ex.: "Jonathan Haubert" → "JH"). */
export function initialsOf(user: CurrentUser): string {
  const base = user.fullName ?? user.email;
  const parts = base.trim().split(/[\s@.]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}
