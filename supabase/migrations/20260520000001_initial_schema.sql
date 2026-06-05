-- =============================================================
-- Sprint 1 - Schema Inicial
-- =============================================================
-- Tabelas: waitlist, profiles, user_credits, credit_transactions, analyses
-- Politicas RLS, triggers de timestamp, e provisionamento automatico
-- =============================================================

-- Extensoes necessarias
create extension if not exists "pgcrypto";

-- =============================================================
-- WAITLIST
-- =============================================================
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text default 'landing',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_email_unique
  on public.waitlist (lower(email));

create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- Apenas service role pode ler waitlist (admin). Insert e feito via API com service role tambem (no nosso caso, via anon + RLS sem select).
drop policy if exists "waitlist_insert_anon" on public.waitlist;
create policy "waitlist_insert_anon" on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Sem policy de SELECT -> ninguem le

-- =============================================================
-- PROFILES (1:1 com auth.users)
-- =============================================================
create type public.plan_tier as enum ('free', 'mensal', 'pro_anual', 'vip');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  plan public.plan_tier default 'free',
  plan_active_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_plan_idx on public.profiles (plan);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- =============================================================
-- USER CREDITS (1:1)
-- =============================================================
create table if not exists public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits_simple int not null default 0 check (credits_simple >= 0),
  credits_pro int not null default 0 check (credits_pro >= 0),
  total_used int not null default 0 check (total_used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

drop policy if exists "credits_self_select" on public.user_credits;
create policy "credits_self_select" on public.user_credits
  for select using (auth.uid() = user_id);

-- INSERT/UPDATE feito apenas via funcoes RPC ou webhooks (service role)

-- =============================================================
-- CREDIT TRANSACTIONS (auditoria)
-- =============================================================
create type public.txn_type as enum ('purchase', 'consume', 'bonus', 'refund');

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.txn_type not null,
  amount_pro int not null default 0,
  amount_simple int not null default 0,
  source text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_txn_user_idx on public.credit_transactions (user_id, created_at desc);

alter table public.credit_transactions enable row level security;

drop policy if exists "txn_self_select" on public.credit_transactions;
create policy "txn_self_select" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- INSERT apenas via service role

-- =============================================================
-- ANALYSES (historico do usuario - diferencial vs Vortex 'Em Breve')
-- =============================================================
create type public.asset_type as enum ('crypto', 'forex', 'stocks', 'indices', 'commodities');
create type public.analysis_type as enum ('simple', 'complete');
create type public.signal_direction as enum ('BUY', 'SELL', 'NEUTRAL');

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type public.asset_type not null,
  asset text not null,
  timeframe text not null,
  analysis_type public.analysis_type not null,
  signal public.signal_direction,
  strength int check (strength between 0 and 100),
  confluence int check (confluence between 0 and 10),
  entry numeric,
  stop_loss numeric,
  take_profit_1 numeric,
  take_profit_2 numeric,
  take_profit_3 numeric,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_created_idx
  on public.analyses (user_id, created_at desc);
create index if not exists analyses_asset_idx
  on public.analyses (asset, timeframe);

alter table public.analyses enable row level security;

drop policy if exists "analyses_self_select" on public.analyses;
create policy "analyses_self_select" on public.analyses
  for select using (auth.uid() = user_id);

drop policy if exists "analyses_self_insert" on public.analyses;
create policy "analyses_self_insert" on public.analyses
  for insert with check (auth.uid() = user_id);

-- =============================================================
-- TRIGGER: provisionar profile + credits ao criar usuario
-- =============================================================
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

  insert into public.user_credits (user_id, credits_simple, credits_pro)
  values (new.id, 3, 0)  -- Free tier: 3 analises simples por mes
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, type, amount_simple, source, metadata)
  values (new.id, 'bonus', 3, 'signup_free_tier', jsonb_build_object('reason', 'Bônus de boas-vindas'))
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =============================================================
-- TRIGGER: updated_at automatico
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists credits_set_updated_at on public.user_credits;
create trigger credits_set_updated_at
  before update on public.user_credits
  for each row execute function public.set_updated_at();
