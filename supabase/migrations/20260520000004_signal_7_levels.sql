-- =============================================================
-- 7 níveis de sinal (Compra Forte → Venda Forte)
-- =============================================================
-- Estende o enum public.signal_direction com 4 novos valores:
--   STRONG_BUY, WEAK_BUY, WEAK_SELL, STRONG_SELL
-- Os valores antigos (BUY, SELL, NEUTRAL) permanecem.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE não pode rodar dentro de uma
-- transação. Cada ADD VALUE precisa estar isolado, e o Supabase
-- SQL Editor executa cada statement separadamente. Funciona ✓
-- =============================================================

alter type public.signal_direction add value if not exists 'STRONG_BUY';
alter type public.signal_direction add value if not exists 'WEAK_BUY';
alter type public.signal_direction add value if not exists 'WEAK_SELL';
alter type public.signal_direction add value if not exists 'STRONG_SELL';

-- Recria o índice (opcional, mas garante que pegue novos valores)
drop index if exists public.analyses_signal_idx;
create index analyses_signal_idx
  on public.analyses (signal)
  where signal is not null;

-- Sanity check
comment on type public.signal_direction is '7 níveis: STRONG_BUY, BUY, WEAK_BUY, NEUTRAL, WEAK_SELL, SELL, STRONG_SELL';
