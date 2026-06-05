-- =============================================================
-- Helper: resolver email -> user_id
-- Usado pelo webhook HUBLA pra encontrar o usuario pelo email da venda.
-- Acesso apenas via service_role (nunca exposto ao authenticated).
-- =============================================================

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email from public;
revoke all on function public.get_user_id_by_email from authenticated;
grant execute on function public.get_user_id_by_email to service_role;

comment on function public.get_user_id_by_email is
  'Resolve email -> user_id. APENAS service_role. Usado por webhooks.';
