/**
 * Sessão do usuário atual (server-side) — junta auth + profile + saldo de
 * créditos num objeto pronto pra UI (AppBar). Retorna null se anônimo.
 */
import { supabaseServerSSR } from "./server-ssr";

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

  const [{ data: profile }, { data: credit }] = await Promise.all([
    sb.from("profiles").select("plan, email, full_name").eq("id", user.id).maybeSingle(),
    sb.from("user_credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? (profile?.email as string | undefined) ?? "",
    fullName: (profile?.full_name as string | null | undefined) ?? null,
    plan: (profile?.plan as string | undefined) ?? "free",
    credits: (credit?.balance as number | undefined) ?? 0,
  };
}

/** Lista de e-mails admin (env ADMIN_EMAILS, separados por vírgula). */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** True se o e-mail consta em ADMIN_EMAILS. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
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
