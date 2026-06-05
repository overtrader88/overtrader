/**
 * Gate de admin — bem simples: lista de emails autorizados via env.
 *
 * Para producao com mais de 1-2 admins, considerar coluna `is_admin` em profiles
 * com RLS dedicada. Por enquanto, env e suficiente.
 */

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
