-- =====================================================================
-- Overtrader v2 — Live Trading metering (Fase 2).
-- Sessão de live por (usuário, ativo). Cobra 2 créditos na ativação (1ª hora) e
-- +2 a cada hora cheia enquanto ativa — o relógio corre no SERVIDOR e continua
-- mesmo com a página fechada; só para quando o usuário desliga. O acerto é feito
-- on-touch (rotas /api/live) + cron (diário no Hobby, horário no Pro).
-- =====================================================================

create table if not exists live_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  symbol         text not null,
  asset_type     text not null,
  active         boolean not null default true,
  activated_at   timestamptz not null default now(),
  hours_charged  integer not null default 1,   -- 1 = 1ª hora paga na ativação
  deactivated_at timestamptz,
  reason         text,                          -- null | 'user' | 'no_credits'
  created_at     timestamptz not null default now()
);

-- No máximo uma sessão ATIVA por (usuário, ativo).
create unique index if not exists live_sessions_active_uniq
  on live_sessions (user_id, symbol) where active;
create index if not exists live_sessions_active_idx on live_sessions (active) where active;

alter table live_sessions enable row level security;
create policy "live_own_select" on live_sessions for select using (auth.uid() = user_id);
-- escrita é via service-role nas rotas /api/live (ignora RLS).
