/**
 * Checagem de e-mail admin — módulo PURO, sem dependências de servidor
 * (não importa next/headers nem o cliente Supabase). Por isso pode ser
 * importado tanto por server components (AppBar) quanto por código que
 * acaba no barrel `components/ui`, sem quebrar o bundle do cliente.
 *
 * Em runtime de cliente `process.env.ADMIN_EMAILS` não existe (não é
 * NEXT_PUBLIC), então retorna false — o que é seguro: o gate de verdade
 * roda no servidor.
 */

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
