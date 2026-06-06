-- =============================================================
-- Overtrader — SCHEMA COMPLETO (0001→0006) para projeto NOVO.
-- Cole TUDO no SQL Editor do Supabase novo e rode UMA vez.
-- =============================================================

-- ===== 0001_init.sql =====

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

-- ===== 0002_signals.sql =====

-- =====================================================================
-- TradeAI v2 — Track record FORWARD (Fase C4) — o moat.
--
-- Cada sinal de QUALIDADE (selo verde/amarelo + direção acionável) é CARIMBADO
-- na emissão com seu plano fixo (entrada/stop/TPs) + o que o backtest previa.
-- Um cron resolve o desfecho REAL contra os candles posteriores. A agregação
-- (win rate + PF + R médio com IC e n) é PÚBLICA — performance auditada honesta,
-- impossível de copiar sem expor os números reais.
--
-- Plataforma-owned (sem user_id): é o track record oficial, leitura pública.
-- Escrita só via service-role (cron). Dedup: 1 sinal ABERTO por símbolo+TF.
-- =====================================================================

create type signal_outcome as enum ('TP1','TP2','TP3','SL','EXPIRED');

create table signals (
  id               uuid primary key default gen_random_uuid(),
  symbol           text not null,
  asset_type       text not null,
  timeframe        text not null,
  direction        signal_direction not null,
  seal             text not null,            -- green | yellow (só emitimos estes)
  side             text not null,            -- buy | sell
  entry            numeric not null,
  stop_loss        numeric not null,
  tp1              numeric not null,
  tp2              numeric not null,
  tp3              numeric not null,
  regime           text,
  engine_version   text not null,
  -- o que o backtest PREVIA na emissão (para comparar previsto × realizado):
  bt_pf            numeric,
  bt_wr            numeric,
  bt_n             integer,
  emitted_at       timestamptz not null default now(),
  -- resolução FORWARD (preenchida pelo cron de resolução):
  outcome          signal_outcome,           -- null enquanto ABERTO
  exit_price       numeric,
  pnl_r            numeric,
  duration_candles integer,
  resolved_at      timestamptz,
  checked_at       timestamptz               -- última passada do cron de resolução
);

alter table signals enable row level security;

-- scan rápido de sinais ABERTOS (cron de resolução)
create index signals_open_idx on signals (emitted_at) where outcome is null;
create index signals_symbol_tf_idx on signals (symbol, timeframe);
create index signals_resolved_idx on signals (resolved_at desc) where outcome is not null;

-- Leitura PÚBLICA (o moat é aberto, inclusive p/ visitantes não logados).
create policy "signals: leitura pública" on signals
  for select using (true);
-- Sem policies de insert/update → só o service-role (cron) escreve.

-- =====================================================================
-- record_signal — carimba um sinal na emissão, de forma ATÔMICA.
-- Não emite se já existe um sinal ABERTO para o mesmo símbolo+TF
-- (1 "posição viva" por mercado). Retorna o id, ou null se pulou.
-- =====================================================================
create or replace function record_signal(
  p_symbol text, p_asset_type text, p_timeframe text,
  p_direction signal_direction, p_seal text, p_side text,
  p_entry numeric, p_stop numeric, p_tp1 numeric, p_tp2 numeric, p_tp3 numeric,
  p_regime text, p_engine_version text,
  p_bt_pf numeric, p_bt_wr numeric, p_bt_n integer
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (
    select 1 from signals
    where symbol = p_symbol and timeframe = p_timeframe and outcome is null
  ) then
    return null;  -- já há um sinal aberto para este mercado
  end if;

  insert into signals (
    symbol, asset_type, timeframe, direction, seal, side,
    entry, stop_loss, tp1, tp2, tp3, regime, engine_version, bt_pf, bt_wr, bt_n
  ) values (
    p_symbol, p_asset_type, p_timeframe, p_direction, p_seal, p_side,
    p_entry, p_stop, p_tp1, p_tp2, p_tp3, p_regime, p_engine_version, p_bt_pf, p_bt_wr, p_bt_n
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ===== 0003_signal_lifecycle.sql =====

-- =====================================================================
-- TradeAI v2 — Ciclo de vida do sinal (Fase C3).
-- Colunas que registram o progresso da gestão escalonada (multi-TP + breakeven
-- automático): quais alvos já bateram e onde o stop está agora. Atualizadas pelo
-- cron de resolução a cada passada — inclusive em sinais AINDA ABERTOS, para a
-- vitrine mostrar "TP1 atingido · stop no breakeven · correndo p/ TP2".
-- =====================================================================

alter table signals
  add column tp1_hit      boolean not null default false,
  add column tp2_hit      boolean not null default false,
  add column tp3_hit      boolean not null default false,
  add column stop_stage   text not null default 'initial',  -- initial | breakeven | tp1
  add column current_stop numeric;

-- ===== 0004_notify_prefs.sql =====

-- =====================================================================
-- TradeAI v2 — Preferência de notificação por e-mail (Fase C2).
-- Opt-in explícito: e-mail de alerta só sai se o usuário ativar (anti-spam /
-- conformidade). Telegram é por vínculo (telegram_links), sem coluna extra.
-- =====================================================================

alter table profiles add column notify_email boolean not null default false;

-- ===== 0005_signal_narrative.sql =====

-- =====================================================================
-- TradeAI/Overtrader v2 — Narrativa do sinal (Fase D1, monitor ao vivo).
-- A leitura da IA é gerada UMA vez na emissão do sinal e guardada aqui, para o
-- monitor ao vivo exibir o sinal de qualidade já com a narrativa — sem gerar
-- texto a cada atualização (nada de "tagarelice" de IA por poll).
-- =====================================================================

alter table signals add column narrative text;

-- ===== 0006_billing.sql =====

-- =====================================================================
-- Overtrader v2 — Billing: ativar/desativar assinatura via webhook (Fase F3).
--
-- O webhook (ex.: Hubla) roda com service-role e chama estes RPCs ATÔMICOS:
--   - activate_subscription   → cria a assinatura (idempotente por event_id) e
--                               promove profiles.plan. Retorna FALSE se o evento
--                               já foi processado (dedupe), TRUE se aplicou agora.
--   - deactivate_subscription → marca assinaturas ativas como 'canceled' e
--                               rebaixa profiles.plan para 'free'. Idempotente.
-- Ambos gravam trilha em audit_log. A coluna subscriptions.hubla_event_id é a
-- chave de idempotência (unique) — vale para qualquer provedor.
-- =====================================================================

create or replace function activate_subscription(
  p_event_id   text,
  p_user_id    uuid,
  p_plan       plan_tier,
  p_period     billing_period,
  p_period_end timestamptz default null,
  p_actor      text default 'webhook:hubla'
)
returns boolean                                  -- true = aplicado agora; false = duplicado
language plpgsql
security definer set search_path = public
as $$
declare
  v_end timestamptz;
begin
  v_end := coalesce(
    p_period_end,
    now() + case p_period when 'annual' then interval '1 year' else interval '1 month' end
  );

  insert into subscriptions (user_id, plan, period, status, current_period_end, hubla_event_id)
  values (p_user_id, p_plan, p_period, 'active', v_end, p_event_id)
  on conflict (hubla_event_id) do nothing;

  if not found then
    return false;                               -- evento já processado → no-op
  end if;

  update profiles set plan = p_plan, updated_at = now() where id = p_user_id;

  insert into audit_log (actor, action, target, metadata)
  values (p_actor, 'activate_sub', p_user_id::text,
          jsonb_build_object('plan', p_plan, 'period', p_period, 'event', p_event_id, 'period_end', v_end));

  return true;
end;
$$;

create or replace function deactivate_subscription(
  p_event_id text,
  p_user_id  uuid,
  p_actor    text default 'webhook:hubla'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update subscriptions
    set status = 'canceled'
  where user_id = p_user_id and status = 'active';

  update profiles set plan = 'free', updated_at = now() where id = p_user_id;

  insert into audit_log (actor, action, target, metadata)
  values (p_actor, 'deactivate_sub', p_user_id::text, jsonb_build_object('event', p_event_id));

  return true;
end;
$$;
