-- =====================================================================
-- Overtrader v2 — Motor 2 (seletor de motor) na fase forward.
--
-- O Motor 2 ("por classe de ativo") é uma SEGUNDA leitura sobre os mesmos dados
-- reais. Para o track record forward comparar os dois motores, cada sinal passa
-- a carregar a coluna `engine` ('padrao' = Motor 1; 'classe' = Motor 2).
--
-- NÃO-QUEBRÁVEL: a coluna tem default 'padrao', então todos os sinais já
-- existentes (e os do Motor 1, que continua chamando record_signal sem p_engine)
-- ficam como 'padrao'. A deduplicação passa a ser POR MOTOR — assim Motor 1 e
-- Motor 2 podem ter, cada um, um sinal aberto no mesmo símbolo+TF.
-- =====================================================================

alter table signals add column if not exists engine text not null default 'padrao';
create index if not exists signals_engine_idx on signals (engine);

-- Colunas preparadas para os alertas por motor (usadas na onda de Alertas).
alter table alerts add column if not exists engine text not null default 'padrao';
alter table watchlist add column if not exists engine text not null default 'padrao';

-- Redefine record_signal com p_engine (default 'padrao') e dedup POR MOTOR.
-- Drop explícito porque adicionar parâmetro muda a assinatura. Chamadas antigas
-- (16 args, sem p_engine) continuam válidas via o default.
drop function if exists record_signal(
  text, text, text, signal_direction, text, text,
  numeric, numeric, numeric, numeric, numeric, text, text,
  numeric, numeric, integer
);

create or replace function record_signal(
  p_symbol text, p_asset_type text, p_timeframe text,
  p_direction signal_direction, p_seal text, p_side text,
  p_entry numeric, p_stop numeric, p_tp1 numeric, p_tp2 numeric, p_tp3 numeric,
  p_regime text, p_engine_version text,
  p_bt_pf numeric, p_bt_wr numeric, p_bt_n integer,
  p_engine text default 'padrao'
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  -- 1 sinal aberto por símbolo+TF+MOTOR (cada motor tem sua "posição viva").
  if exists (
    select 1 from signals
    where symbol = p_symbol and timeframe = p_timeframe
      and engine = p_engine and outcome is null
  ) then
    return null;
  end if;

  insert into signals (
    symbol, asset_type, timeframe, direction, seal, side,
    entry, stop_loss, tp1, tp2, tp3, regime, engine_version, bt_pf, bt_wr, bt_n, engine
  ) values (
    p_symbol, p_asset_type, p_timeframe, p_direction, p_seal, p_side,
    p_entry, p_stop, p_tp1, p_tp2, p_tp3, p_regime, p_engine_version, p_bt_pf, p_bt_wr, p_bt_n, p_engine
  )
  returning id into v_id;

  return v_id;
end;
$$;
