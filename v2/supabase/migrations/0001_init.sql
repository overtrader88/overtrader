-- =====================================================================
-- TradeAI v2 — schema consolidado (M0)
--
-- Substitui as 12 migrations fragmentadas do v1 (com duplicata de timestamp
-- e "fix de fix") por UM schema limpo. Mudanças-chave vs v1:
--   - audit_log: trilha de toda operação admin/webhook (compliance + fraude)
--   - rate_limits: backing da camada de rate limit (sem serviço externo)
--   - RPCs ATÔMICOS para consumo de crédito e alertas (corrige race conditions)
--   - RLS habilitado e explícito em TODAS as tabelas
--
-- Os corpos de RPC marcados [STUB] têm a assinatura final mas lógica mínima;
-- a lógica completa é endurecida no M4 (dados + segurança).
-- =====================================================================

-- ---------- ENUMS ----------
create type signal_direction as enum (
  'STRONG_SELL','SELL','WEAK_SELL','NEUTRAL','WEAK_BUY','BUY','STRONG_BUY'
);
create type plan_tier as enum ('free','pro','pro_plus');
create type billing_period as enum ('monthly','annual');
create type subscription_status as enum ('active','canceled','expired');

-- ---------- PROFILES ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  plan        plan_tier not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table profiles enable row level security;

create policy "profiles: dono lê" on profiles
  for select using (auth.uid() = id);
create policy "profiles: dono atualiza" on profiles
  for update using (auth.uid() = id);

-- ---------- USER_CREDITS ----------
create table user_credits (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);
alter table user_credits enable row level security;

create policy "credits: dono lê" on user_credits
  for select using (auth.uid() = user_id);

-- ---------- CREDIT_TRANSACTIONS ----------
create table credit_transactions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      integer not null,                  -- positivo = crédito, negativo = consumo
  source      text not null,                     -- 'signup_trial','analyze','hubla','admin'
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table credit_transactions enable row level security;

create index on credit_transactions (user_id, created_at desc);

create policy "tx: dono lê" on credit_transactions
  for select using (auth.uid() = user_id);

-- ---------- ANALYSES ----------
create table analyses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  symbol       text not null,
  asset_type   text not null,
  timeframe    text not null,
  signal       signal_direction not null,
  strength     integer not null,
  result       jsonb not null,                   -- AnalysisResult completo
  created_at   timestamptz not null default now()
);
alter table analyses enable row level security;

create index on analyses (user_id, created_at desc);

create policy "analyses: dono lê" on analyses
  for select using (auth.uid() = user_id);
create policy "analyses: dono insere" on analyses
  for insert with check (auth.uid() = user_id);

-- ---------- SUBSCRIPTIONS ----------
create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan          plan_tier not null,
  period        billing_period not null,
  status        subscription_status not null default 'active',
  current_period_end timestamptz not null,
  hubla_event_id text unique,                    -- idempotência de webhook
  created_at    timestamptz not null default now()
);
alter table subscriptions enable row level security;

create index on subscriptions (user_id);

create policy "subs: dono lê" on subscriptions
  for select using (auth.uid() = user_id);

-- ---------- WATCHLIST ----------
create table watchlist (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  symbol              text not null,
  timeframe           text not null,
  min_signal_strength signal_direction not null default 'STRONG_BUY',
  last_checked_at     timestamptz,
  last_alerted_signal signal_direction,
  created_at          timestamptz not null default now(),
  unique (user_id, symbol, timeframe)
);
alter table watchlist enable row level security;

create policy "watchlist: dono total" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ALERTS ----------
create table alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,
  timeframe   text not null,
  signal      signal_direction not null,
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table alerts enable row level security;

create index on alerts (user_id, created_at desc);

create policy "alerts: dono lê" on alerts
  for select using (auth.uid() = user_id);
create policy "alerts: dono atualiza" on alerts
  for update using (auth.uid() = user_id);

-- ---------- TELEGRAM_LINKS ----------
create table telegram_links (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  chat_id     text unique,
  pair_token  text unique,
  linked_at   timestamptz,
  created_at  timestamptz not null default now()
);
alter table telegram_links enable row level security;

create policy "tg: dono lê" on telegram_links
  for select using (auth.uid() = user_id);

-- ---------- MARKET_CACHE (sem dono — service-role apenas) ----------
create table market_cache (
  key         text primary key,
  value       jsonb not null,
  expires_at  timestamptz not null
);
alter table market_cache enable row level security;
-- Sem policies: acessível só via service-role (que ignora RLS).

create index on market_cache (expires_at);

-- ---------- RATE_LIMITS (novo — backing do rate limit) ----------
create table rate_limits (
  key         text not null,
  window_start timestamptz not null,
  count       integer not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security;
-- Sem policies: service-role apenas.

-- ---------- AUDIT_LOG (novo — trilha de operações sensíveis) ----------
create table audit_log (
  id          bigint generated always as identity primary key,
  actor       text,                              -- email admin ou 'webhook:hubla'
  action      text not null,                     -- 'credit_user','activate_sub',...
  target      text,                              -- email/uuid afetado
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
alter table audit_log enable row level security;
-- Sem policies: service-role apenas (admin lê via API com gate).

create index on audit_log (created_at desc);

-- =====================================================================
-- TRIGGER: novo usuário ganha profile + 3 créditos de trial vitalício
-- =====================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.user_credits (user_id, balance)
  values (new.id, 3);

  insert into public.credit_transactions (user_id, amount, source, metadata)
  values (new.id, 3, 'signup_trial', '{"note":"3 análises vitalícias"}');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- RPC ATÔMICO: consumir crédito (corrige a race condition do v1)
-- Usa UPDATE condicional num único statement — sem read-then-write.
-- =====================================================================
create or replace function consume_credits(
  p_user_id uuid,
  p_amount  integer,
  p_source  text,
  p_metadata jsonb default '{}'
)
returns integer                                  -- saldo restante
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance integer;
begin
  update user_credits
    set balance = balance - p_amount,
        updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'creditos insuficientes' using errcode = 'P0001';
  end if;

  insert into credit_transactions (user_id, amount, source, metadata)
  values (p_user_id, -p_amount, p_source, p_metadata);

  return v_balance;
end;
$$;

-- =====================================================================
-- RPC: creditar usuário (admin / webhook). [STUB — endurecer no M4]
-- =====================================================================
create or replace function credit_user(
  p_user_id uuid,
  p_amount  integer,
  p_source  text,
  p_metadata jsonb default '{}'
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance integer;
begin
  insert into user_credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = user_credits.balance + p_amount,
        updated_at = now()
  returning balance into v_balance;

  insert into credit_transactions (user_id, amount, source, metadata)
  values (p_user_id, p_amount, p_source, p_metadata);

  return v_balance;
end;
$$;

-- =====================================================================
-- RPC: resolver uuid por email (usado por webhook/admin)
-- =====================================================================
create or replace function get_user_id_by_email(p_email text)
returns uuid
language sql
security definer set search_path = public
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

-- =====================================================================
-- RPC: limpar cache expirado (cron). Retorna nº de linhas removidas.
-- =====================================================================
create or replace function cleanup_market_cache()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from market_cache where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- =====================================================================
-- RPC ATÔMICO: processar alerta de watchlist (corrige updates disjuntos do v1)
-- [STUB — lógica de threshold completa no M4]
-- =====================================================================
create or replace function process_watchlist_alert(
  p_item_id uuid,
  p_signal  signal_direction,
  p_message text
)
returns boolean                                  -- true se gerou alerta novo
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
  v_symbol text;
  v_tf text;
  v_last signal_direction;
begin
  select user_id, symbol, timeframe, last_alerted_signal
    into v_user, v_symbol, v_tf, v_last
  from watchlist where id = p_item_id for update;

  if v_user is null then
    return false;
  end if;

  update watchlist set last_checked_at = now() where id = p_item_id;

  -- Não realerta o mesmo sinal consecutivo.
  if v_last is not distinct from p_signal then
    return false;
  end if;

  insert into alerts (user_id, symbol, timeframe, signal, message)
  values (v_user, v_symbol, v_tf, p_signal, p_message);

  update watchlist set last_alerted_signal = p_signal where id = p_item_id;
  return true;
end;
$$;
