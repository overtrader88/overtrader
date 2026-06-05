-- =============================================================
-- Sprint 8.0: Reestrutura de planos v2
--
-- Modelo novo:
--   - Free: 3 creditos PRO VITALICIOS (one-time no signup, nao renovam)
--   - PRO mensal R$59 = 75 creditos / PRO anual R$600 = 900 creditos
--   - PRO+ mensal R$99 = 90 creditos / PRO+ anual R$936 = 1080 creditos
--
-- Mudancas:
--   1. handle_new_user agora da 3 PRO + 0 Simples (era 10 Simples + 3 PRO)
--   2. Adiciona coluna billing_period em subscriptions
-- =============================================================

-- 1) Trigger de signup — apenas 3 creditos PRO vitalicios
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  -- Trial vitalicio: 3 creditos PRO (sem creditos Simples)
  -- Usuario testa o produto completo (com IA + backtest) e depois assina
  insert into public.user_credits (user_id, credits_simple, credits_pro)
  values (new.id, 0, 3)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (
    user_id, type, amount_simple, amount_pro, source, metadata
  )
  values (
    new.id,
    'bonus',
    0,
    3,
    'signup_trial_lifetime',
    jsonb_build_object(
      'reason', 'Trial vitalicio - 3 analises PRO para testar o produto',
      'version', 'plans-v2'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

-- 2) Adiciona coluna billing_period em subscriptions pra distinguir mensal/anual
alter table public.subscriptions
  add column if not exists billing_period text
  check (billing_period in ('monthly', 'annual'));

-- Backfill: subscriptions existentes sao consideradas mensais
update public.subscriptions
set billing_period = 'monthly'
where billing_period is null;

-- A partir daqui, novas subscriptions sempre passam billing_period
-- (atualizado em activate_subscription mais abaixo)

-- 3) Atualiza activate_subscription pra aceitar billing_period
--    Precisamos DROPAR a versao antiga (8 parametros) antes de criar a nova (9),
--    porque Postgres trata sobrecargas com argumentos diferentes como funcoes
--    distintas — o CREATE OR REPLACE so substitui assinaturas identicas.
drop function if exists public.activate_subscription(
  uuid, public.plan_tier, int, int, int, text, text, jsonb
);

create or replace function public.activate_subscription(
  p_user_id uuid,
  p_plan public.plan_tier,
  p_credits_pro int,
  p_credits_simple int,
  p_period_days int default 30,
  p_external_id text default null,
  p_source text default 'manual',
  p_metadata jsonb default '{}'::jsonb,
  p_billing_period text default 'monthly'
)
returns table(
  subscription_id uuid,
  new_credits_pro int,
  new_credits_simple int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_new_pro int;
  v_new_simple int;
begin
  -- Validacao: billing_period
  if p_billing_period not in ('monthly', 'annual') then
    p_billing_period := 'monthly';
  end if;

  -- Idempotencia via external_id
  if p_external_id is not null then
    select id into v_sub_id
      from public.subscriptions
      where external_id = p_external_id
      limit 1;
  end if;

  if v_sub_id is not null then
    update public.subscriptions
       set plan = p_plan,
           status = 'active',
           current_period_end = now() + (p_period_days || ' days')::interval,
           billing_period = p_billing_period,
           metadata = p_metadata,
           updated_at = now()
     where id = v_sub_id;
  else
    insert into public.subscriptions (
      user_id, plan, status, current_period_end,
      external_id, source, metadata, billing_period
    )
    values (
      p_user_id,
      p_plan,
      'active',
      now() + (p_period_days || ' days')::interval,
      p_external_id,
      p_source,
      p_metadata,
      p_billing_period
    )
    returning id into v_sub_id;
  end if;

  -- Credita atomicamente
  select uc.credits_pro, uc.credits_simple
    into v_new_pro, v_new_simple
  from public.credit_user(
    p_user_id,
    p_credits_pro,
    p_credits_simple,
    coalesce(p_source, 'subscription'),
    'purchase'::public.txn_type,
    p_metadata
  ) as uc;

  return query
    select v_sub_id, v_new_pro, v_new_simple;
end;
$$;

revoke all on function public.activate_subscription from public;
grant execute on function public.activate_subscription to service_role;

comment on column public.subscriptions.billing_period is
  'Periodo da cobranca: monthly (30 dias) ou annual (365 dias). Usado em /dashboard/assinatura.';
