-- =============================================================
-- Sprint 2 - RPCs para gestão atomica de créditos
-- =============================================================
-- consume_credits: debita N créditos com lock pessimista
-- credit_user: bonifica créditos (uso administrativo)
-- analyses: índices adicionais
-- =============================================================

-- =============================================================
-- consume_credits: debita do saldo, retorna o novo saldo ou nulo se insuficiente
-- =============================================================
create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount_pro int default 0,
  p_amount_simple int default 0,
  p_source text default 'analyze',
  p_metadata jsonb default '{}'::jsonb
)
returns table(credits_pro int, credits_simple int, total_used int)
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
  select c.credits_pro, c.credits_simple, c.total_used
  into v_pro, v_simple, v_total
  from public.user_credits c
  where c.user_id = p_user_id
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
  update public.user_credits
  set credits_pro = credits_pro - p_amount_pro,
      credits_simple = credits_simple - p_amount_simple,
      total_used = total_used + p_amount_pro + p_amount_simple,
      updated_at = now()
  where user_id = p_user_id
  returning credits_pro, credits_simple, total_used
  into v_pro, v_simple, v_total;

  -- Registra transação
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
-- credit_user: usado por webhooks/admin para creditar
-- =============================================================
create or replace function public.credit_user(
  p_user_id uuid,
  p_amount_pro int default 0,
  p_amount_simple int default 0,
  p_source text default 'admin',
  p_type public.txn_type default 'bonus',
  p_metadata jsonb default '{}'::jsonb
)
returns table(credits_pro int, credits_simple int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro int;
  v_simple int;
begin
  insert into public.user_credits (user_id, credits_pro, credits_simple)
  values (p_user_id, p_amount_pro, p_amount_simple)
  on conflict (user_id) do update
    set credits_pro = user_credits.credits_pro + excluded.credits_pro,
        credits_simple = user_credits.credits_simple + excluded.credits_simple,
        updated_at = now()
  returning user_credits.credits_pro, user_credits.credits_simple
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

-- =============================================================
-- Index extra na tabela analyses (filtros por asset/tf no historico)
-- =============================================================
create index if not exists analyses_user_asset_tf_idx
  on public.analyses (user_id, asset_type, asset, timeframe, created_at desc);

create index if not exists analyses_signal_idx
  on public.analyses (signal) where signal is not null;
