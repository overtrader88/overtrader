-- =============================================================
-- Sprint 5: Sistema de assinaturas (HUBLA / manual)
-- =============================================================
-- Cria tabela subscriptions, enum plan_tier, helper RPC para
-- ativar plano e creditar atomicamente.
-- =============================================================

-- Enum dos planos disponiveis
do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('free', 'pro', 'pro_plus');
  end if;
end$$;

-- Enum do status da assinatura
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum (
      'active',     -- pagando, plano ativo
      'cancelled',  -- usuario cancelou, ainda valido ate next_renewal_at
      'expired',    -- ultrapassou next_renewal_at sem renovar
      'refunded'    -- estornado (acesso revogado imediatamente)
    );
  end if;
end$$;

-- =============================================================
-- TABELA: subscriptions
-- =============================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan public.plan_tier not null,
  status public.subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  current_period_end timestamptz not null,
  /** ID externo no HUBLA (ou outro processador) - util pra reconciliacao */
  external_id text,
  /** Source - "hubla", "manual", "trial" */
  source text not null default 'manual',
  /** Dados crus do webhook - util pra audit/debug */
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id, status)
  where status = 'active';

create index if not exists subscriptions_external_id_idx
  on public.subscriptions (external_id)
  where external_id is not null;

-- =============================================================
-- RLS: usuario ve apenas suas proprias subscriptions
-- =============================================================
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE apenas via service_role (webhook ou admin)
drop policy if exists subscriptions_service_modify on public.subscriptions;
create policy subscriptions_service_modify
  on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- =============================================================
-- HELPER: ativar/renovar plano e creditar atomicamente
-- =============================================================
-- Usado tanto pelo webhook HUBLA quanto pelo admin manual.
-- Idempotente: se ja existe subscription com mesmo external_id,
-- atualiza ao inves de criar duplicada.
-- =============================================================
create or replace function public.activate_subscription(
  p_user_id uuid,
  p_plan public.plan_tier,
  p_credits_pro int,
  p_credits_simple int,
  p_period_days int default 30,
  p_external_id text default null,
  p_source text default 'manual',
  p_metadata jsonb default '{}'::jsonb
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
  -- Idempotencia: se ja existe subscription com mesmo external_id, atualiza
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
           metadata = p_metadata,
           updated_at = now()
     where id = v_sub_id;
  else
    insert into public.subscriptions (
      user_id, plan, status, current_period_end,
      external_id, source, metadata
    )
    values (
      p_user_id,
      p_plan,
      'active',
      now() + (p_period_days || ' days')::interval,
      p_external_id,
      p_source,
      p_metadata
    )
    returning id into v_sub_id;
  end if;

  -- Credita os creditos atomicamente (chama credit_user existente)
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

-- =============================================================
-- HELPER: cancelar / revogar assinatura
-- =============================================================
create or replace function public.cancel_subscription(
  p_external_id text,
  p_revoke_access boolean default false
)
returns table(subscription_id uuid, prev_status public.subscription_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_prev public.subscription_status;
  v_new public.subscription_status;
begin
  select id, status into v_sub_id, v_prev
    from public.subscriptions
    where external_id = p_external_id
    limit 1;

  if v_sub_id is null then
    return; -- nao tem o que cancelar
  end if;

  v_new := case when p_revoke_access then 'refunded' else 'cancelled' end;

  update public.subscriptions
    set status = v_new,
        updated_at = now()
    where id = v_sub_id;

  return query select v_sub_id, v_prev;
end;
$$;

revoke all on function public.cancel_subscription from public;
grant execute on function public.cancel_subscription to service_role;

-- =============================================================
-- HELPER: pegar plano ativo de um usuario (chamada do app)
-- =============================================================
create or replace function public.get_active_plan(p_user_id uuid)
returns public.plan_tier
language sql
security definer
set search_path = public
stable
as $$
  select plan
    from public.subscriptions
    where user_id = p_user_id
      and status = 'active'
      and current_period_end > now()
    order by current_period_end desc
    limit 1;
$$;

revoke all on function public.get_active_plan from public;
grant execute on function public.get_active_plan to authenticated;
grant execute on function public.get_active_plan to service_role;

-- =============================================================
-- COMMENT (audit trail)
-- =============================================================
comment on table public.subscriptions is
  'Assinaturas pagas via HUBLA ou bonus manual. Linkado a auth.users com cascade.';
comment on function public.activate_subscription is
  'Idempotente: ativa/renova plano e credita simultaneamente. Usado pelo webhook HUBLA.';
