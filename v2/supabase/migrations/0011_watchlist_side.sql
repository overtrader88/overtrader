-- =====================================================================
-- Overtrader v2 — Watchlist por LADO (compra E venda no mesmo ativo+TF).
-- Antes a unicidade era (user, symbol, timeframe) → só 1 alerta por ativo+TF,
-- e adicionar o lado oposto sobrescrevia (upsert). Agora a unicidade inclui o
-- lado, então o usuário pode acompanhar compra E venda do mesmo ativo/TF.
-- =====================================================================

alter table watchlist add column if not exists side text;

-- Backfill: deriva o lado do gatilho atual (min_signal_strength).
update watchlist
  set side = case when min_signal_strength::text like '%SELL%' then 'sell' else 'buy' end
  where side is null;

alter table watchlist alter column side set default 'buy';
alter table watchlist alter column side set not null;

-- Troca a constraint de unicidade: agora inclui o lado.
alter table watchlist drop constraint if exists watchlist_user_id_symbol_timeframe_key;
alter table watchlist add constraint watchlist_user_symbol_tf_side_key
  unique (user_id, symbol, timeframe, side);
