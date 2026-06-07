-- =====================================================================
-- Overtrader v2 — Monitor ao vivo (Fase 3).
-- Ativação paga: 20 créditos por 5 dias (exclusivo PRO/PRO+). Cada ativação
-- cria uma janela; "ativo" = existe janela com expires_at no futuro.
-- O débito é feito pela RPC consume_credits (service-role). RLS: o dono lê.
-- =====================================================================

create table if not exists monitor_activations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  activated_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  credits      integer not null default 20,
  created_at   timestamptz not null default now()
);

create index if not exists monitor_activations_user_idx on monitor_activations (user_id, expires_at desc);

alter table monitor_activations enable row level security;

create policy "monitor_own_select" on monitor_activations for select using (auth.uid() = user_id);
-- inserção é feita pelo service-role (ignora RLS) na rota /api/monitor/activate.
