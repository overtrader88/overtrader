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
