-- =============================================================
-- Sprint 8.3: Cache compartilhado de dados de mercado
--
-- Objetivo: reduzir drasticamente o consumo de Twelve Data (free tier 800/dia)
-- compartilhando cache entre TODOS os usuarios.
--
-- Padrao de uso:
--   key = "candles:XAUUSD:1h:300" ou "ticker:EURUSD"
--   TTL: 5min pra timeframes <1h, 15min pra >=1h
--
-- Sem RLS — leitura/escrita apenas via service_role (cache e dado publico,
-- nao tem informacao pessoal).
-- =============================================================

create table if not exists public.market_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  /** Provider que gerou esse dado (twelvedata, binance, yahoo) - util pra metrics */
  provider text
);

create index if not exists market_cache_expires_idx
  on public.market_cache (expires_at);

-- Sem RLS — service_role only
alter table public.market_cache enable row level security;

-- (Nao criamos policy de SELECT/INSERT/UPDATE pra authenticated.
-- Service role bypassa RLS — entao apenas o backend acessa.)

comment on table public.market_cache is
  'Cache compartilhado de dados de mercado (candles, tickers). Reduz consumo de APIs externas.';

-- =============================================================
-- HELPER: limpa entradas expiradas (rodar periodicamente)
-- =============================================================
create or replace function public.cleanup_market_cache()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.market_cache
    where expires_at < now() - interval '1 hour'
    returning 1 into v_deleted;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

grant execute on function public.cleanup_market_cache to service_role;

comment on function public.cleanup_market_cache is
  'Remove entradas expiradas ha mais de 1h. Rodar via cron a cada 6h.';
