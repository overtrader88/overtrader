-- =============================================================
-- Sprint 6.4: Watchlist + alertas in-app
-- =============================================================

-- =============================================================
-- TABELA: watchlist
-- Cada linha = um par (ativo, timeframe) que o usuario quer monitorar.
-- =============================================================
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  asset_type text not null check (
    asset_type in ('crypto', 'forex', 'stocks', 'indices', 'commodities')
  ),
  timeframe text not null check (
    timeframe in ('15m', '1h', '4h', '1d', '1w', '1M')
  ),
  /** Nivel minimo de sinal pra disparar alerta. Ex: 'BUY' alerta BUY ou STRONG_BUY */
  min_signal_strength text not null default 'STRONG_BUY' check (
    min_signal_strength in ('BUY', 'STRONG_BUY', 'WEAK_BUY')
  ),
  created_at timestamptz not null default now(),
  /** Ultimo check do job de alerta (evita rodar varias vezes pro mesmo padrao) */
  last_checked_at timestamptz,
  /** Ultimo signal alertado (evita spam: so dispara se sinal mudou) */
  last_alerted_signal text,
  unique (user_id, asset, timeframe)
);

create index if not exists watchlist_user_idx
  on public.watchlist (user_id);

create index if not exists watchlist_last_checked_idx
  on public.watchlist (last_checked_at);

alter table public.watchlist enable row level security;

drop policy if exists watchlist_select_own on public.watchlist;
create policy watchlist_select_own
  on public.watchlist
  for select
  using (auth.uid() = user_id);

drop policy if exists watchlist_insert_own on public.watchlist;
create policy watchlist_insert_own
  on public.watchlist
  for insert
  with check (auth.uid() = user_id);

drop policy if exists watchlist_delete_own on public.watchlist;
create policy watchlist_delete_own
  on public.watchlist
  for delete
  using (auth.uid() = user_id);

drop policy if exists watchlist_update_own on public.watchlist;
create policy watchlist_update_own
  on public.watchlist
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- TABELA: alerts (notificacoes in-app)
-- =============================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  timeframe text not null,
  signal text not null,
  /** Forca do sinal (0-100) e confluencia (0-10) no momento */
  strength int,
  confluence int,
  /** Snapshot dos niveis de risco */
  entry numeric,
  stop_loss numeric,
  take_profit1 numeric,
  /** Link pra analise gerada (opcional - alerts podem ser standalone) */
  analysis_id uuid references public.analyses(id) on delete set null,
  /** Mensagem custom (LLM ou heuristica) */
  message text,
  /** Quando o usuario leu */
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_unread_idx
  on public.alerts (user_id, created_at desc)
  where read_at is null;

create index if not exists alerts_user_recent_idx
  on public.alerts (user_id, created_at desc);

alter table public.alerts enable row level security;

drop policy if exists alerts_select_own on public.alerts;
create policy alerts_select_own
  on public.alerts
  for select
  using (auth.uid() = user_id);

-- Usuario pode marcar como lido
drop policy if exists alerts_update_own on public.alerts;
create policy alerts_update_own
  on public.alerts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insert apenas via service_role (job de checagem)
drop policy if exists alerts_insert_service on public.alerts;
create policy alerts_insert_service
  on public.alerts
  for insert
  with check (auth.role() = 'service_role');

-- Usuario pode deletar (arquivar)
drop policy if exists alerts_delete_own on public.alerts;
create policy alerts_delete_own
  on public.alerts
  for delete
  using (auth.uid() = user_id);

-- =============================================================
-- VIEW: contagem de alerts nao lidos por usuario
-- (alternativa: count() em runtime — view pre-calculada e mais rapido)
-- =============================================================
create or replace view public.unread_alerts_count as
select
  user_id,
  count(*) as unread_count
from public.alerts
where read_at is null
group by user_id;

-- =============================================================
-- COMMENT
-- =============================================================
comment on table public.watchlist is
  'Ativos que o usuario monitora. Job periodico checa e gera alerts em alerts.';
comment on table public.alerts is
  'Notificacoes in-app de sinais. Criado pelo job de monitoramento.';
