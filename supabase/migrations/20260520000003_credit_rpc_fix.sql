-- =============================================================
-- HOTFIX — corrige ambiguidade de coluna em consume_credits / credit_user
-- =============================================================
-- Bug: PL/pgSQL ficava confuso entre coluna da tabela `user_credits`
-- e as colunas de saída da RETURNS TABLE (mesmo nome).
-- Fix: renomear as colunas de saída com prefixo `out_`.
-- =============================================================

drop function if exists public.consume_credits(uuid, int, int, text, jsonb);
drop function if exists public.credit_user(uuid, int, int, text, public.txn_type, jsonb);

-- =============================================================
-- consume_credits: debita do saldo com lock pessimista, retorna o novo saldo
-- ou levanta exception se insuficiente.
-- =============================================================
create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount_pro int default 0,
  p_amount_simple int default 0,
  p_source text default 'analyze',
  p_metadata jsonb default '{}'::jsonb
)
returns table(out_credits_pro int, out_credits_simple int, out_total_used int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro int;
  v_simple int;
  v_total int;
begin
  -- Lock pessimista da linha do usuario
  select uc.credits_pro, uc.credits_simple, uc.total_used
  into v_pro, v_simple, v_total
  from public.user_credits uc
  where uc.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Usuario sem registro de creditos: %', p_user_id
      using errcode = 'P0002';
  end if;

  -- Valida saldo
  if v_pro < p_amount_pro or v_simple < p_amount_simple then
    raise exception 'Saldo insuficiente'
      using errcode = 'P0001',
            hint = jsonb_build_object(
              'have_pro', v_pro,
              'have_simple', v_simple,
              'need_pro', p_amount_pro,
              'need_simple', p_amount_simple
            )::text;
  end if;

  -- Debita
  update public.user_credits uc
  set credits_pro    = uc.credits_pro - p_amount_pro,
      credits_simple = uc.credits_simple - p_amount_simple,
      total_used     = uc.total_used + p_amount_pro + p_amount_simple,
      updated_at     = now()
  where uc.user_id = p_user_id
  returning uc.credits_pro, uc.credits_simple, uc.total_used
  into v_pro, v_simple, v_total;

  -- Registra transacao
  insert into public.credit_transactions (
    user_id, type, amount_pro, amount_simple, source, metadata
  ) values (
    p_user_id, 'consume', -p_amount_pro, -p_amount_simple, p_source, p_metadata
  );

  return query select v_pro, v_simple, v_total;
end;
$$;

revoke all on function public.consume_credits from public;
grant execute on function public.consume_credits to authenticated, service_role;

-- =============================================================
-- credit_user: para webhooks/admin/refund. Cria linha se nao existir.
-- =============================================================
create or replace function public.credit_user(
  p_user_id uuid,
  p_amount_pro int default 0,
  p_amount_simple int default 0,
  p_source text default 'admin',
  p_type public.txn_type default 'bonus',
  p_metadata jsonb default '{}'::jsonb
)
returns table(out_credits_pro int, out_credits_simple int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro int;
  v_simple int;
begin
  insert into public.user_credits as uc (user_id, credits_pro, credits_simple)
  values (p_user_id, p_amount_pro, p_amount_simple)
  on conflict (user_id) do update
    set credits_pro    = uc.credits_pro + excluded.credits_pro,
        credits_simple = uc.credits_simple + excluded.credits_simple,
        updated_at     = now()
  returning uc.credits_pro, uc.credits_simple
  into v_pro, v_simple;

  insert into public.credit_transactions (
    user_id, type, amount_pro, amount_simple, source, metadata
  ) values (
    p_user_id, p_type, p_amount_pro, p_amount_simple, p_source, p_metadata
  );

  return query select v_pro, v_simple;
end;
$$;

revoke all on function public.credit_user from public;
grant execute on function public.credit_user to service_role;
