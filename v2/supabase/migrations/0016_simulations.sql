-- =====================================================================
-- Overtrader v2 — Simulador "Máquina do Tempo" (0016).
-- Cada linha = 1 simulação histórica executada. Serve a dois propósitos:
--   1) cota diária grátis (SIMULATOR_FREE_PER_DAY por usuário, dia UTC) —
--      a rota conta as linhas de hoje antes de decidir grátis × cobrada;
--   2) trilha de auditoria (data simulada, se foi cobrada e o desfecho).
-- O débito (além da cota) usa a RPC consume_credits (service-role), fonte
-- 'simulator'. RLS: o dono lê; INSERT via service-role (rota /api/simulator).
-- Obs.: aplicando pelo SQL editor, rode também NOTIFY pgrst, 'reload schema';
-- para o PostgREST enxergar a tabela nova (pegadinha já vista na watchlist).
-- =====================================================================

create table if not exists simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  symbol      text not null,
  asset_type  text not null,
  timeframe   text not null,
  sim_date    date not null,                     -- o "dia viajado" (corte no fim dele, UTC)
  charged     boolean not null default false,    -- true = debitou crédito (além da cota grátis)
  outcome     text,                              -- TP1|TP2|TP3|SL|EXPIRED; null = neutro/aberto
  pnl_r       double precision,                  -- resultado em R (quando resolvido)
  created_at  timestamptz not null default now()
);

create index if not exists simulations_user_day_idx on simulations (user_id, created_at desc);

alter table simulations enable row level security;

create policy "simulations_own_select" on simulations for select using (auth.uid() = user_id);
-- inserção é feita pelo service-role (ignora RLS) na rota /api/simulator.
