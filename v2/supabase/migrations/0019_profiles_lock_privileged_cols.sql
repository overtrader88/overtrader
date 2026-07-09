-- =====================================================================
-- 0019 — Fecha escalada de plano via PostgREST (falha de segurança).
--
-- A policy de UPDATE de profiles (0001_init.sql: "profiles: dono atualiza",
-- `for update using (auth.uid() = id)`) NÃO tem `with check`, então o Postgres
-- só valida que a linha continua sendo do próprio usuário — NÃO restringe QUAIS
-- colunas mudam. Resultado: qualquer usuário logado podia dar
--   PATCH /rest/v1/profiles?id=eq.<seu_uid>  body {"plan":"pro_plus"}
-- (anon key + JWT dele) e liberar features pagas de graça — `plan` é o
-- entitlement (v2/apps/web/lib/live/session.ts, lib/monitor.ts).
--
-- FIX por PRIVILÉGIO DE COLUNA: o role `authenticated` só pode alterar colunas
-- NÃO sensíveis (nome, preferência de e-mail, updated_at). Mudanças de `plan`/
-- `email` legítimas vêm do service_role (admin /api/admin/set-plan faz update
-- direto com a service key) e de RPCs SECURITY DEFINER (billing set_plan em
-- 0006/0008) — nenhum é afetado por grants do `authenticated`.
-- =====================================================================

revoke update on public.profiles from authenticated;
grant  update (full_name, notify_email, updated_at) on public.profiles to authenticated;

-- Recarrega o schema cache do PostgREST (senão o grant novo pode demorar a valer).
notify pgrst, 'reload schema';
