-- =====================================================================
-- 0018 — Darwin 2.0 (revisão dos motores 05/07, lente Projetista Evolutivo)
--
-- 1) evo_engines_history: ARQUIVO da linhagem (achado 29). Cada morte INSERE
--    o núcleo que morreu (com estatísticas da vida) ANTES do UPDATE que o
--    sobrescreve — a curva de fitness por geração vira auditável e pública.
--    PK própria (uuid): slot+generation não é único garantido se um
--    renascimento falhar no meio.
-- 2) evo_engines: colunas de ELITISMO PASSIVO (best_core/best_expectancy/
--    best_generation — registradas na morte com ≥15 trades; a ressurreição
--    automática fica DESLIGADA por design até haver amostra) e de TELEMETRIA
--    DE FITNESS (achado 25: n, média R, σ e as bandas de 90% da expectância,
--    atualizadas a cada cron — auditoria barata da regra de morte
--    "ruína OU upper bound 90% < 0, sempre com n ≥ 20").
--
-- O código tolera a ausência desta migration (updates/inserts best-effort).
-- Rodar no schema PUBLIC e recarregar o PostgREST (lição da 0013).
-- =====================================================================

alter table public.evo_engines add column if not exists best_core text;
alter table public.evo_engines add column if not exists best_expectancy numeric;   -- média R da melhor vida registrada
alter table public.evo_engines add column if not exists best_generation integer;
alter table public.evo_engines add column if not exists life_resolved integer;     -- n de trades resolvidos desde born_at
alter table public.evo_engines add column if not exists life_mean_r numeric;       -- expectância média (R) da vida
alter table public.evo_engines add column if not exists life_std_r numeric;        -- desvio-padrão amostral (R)
alter table public.evo_engines add column if not exists fitness_lb_r numeric;      -- média − 1.28σ/√n (banda 90%)
alter table public.evo_engines add column if not exists fitness_ub_r numeric;      -- média + 1.28σ/√n (morte se < 0 com n ≥ 20)
alter table public.evo_engines add column if not exists fitness_at timestamptz;    -- última atualização da telemetria

create table if not exists public.evo_engines_history (
  id            uuid primary key default gen_random_uuid(),
  slot          text not null,               -- evo_gpt | evo_ds
  generation    integer not null,
  core          text not null,               -- o genoma que morreu (preservado)
  born_at       timestamptz not null,
  died_at       timestamptz not null default now(),
  life_trades   integer,                     -- n resolvidos desde born_at
  expectancy_r  numeric,                     -- média R da vida
  max_dd_pct    numeric,                     -- pior drawdown da banca na vida
  death_context text                         -- [ruina|expectancia|letargia] + clusters + autópsias usados no cruzamento
);

create index if not exists evo_engines_history_slot_idx on public.evo_engines_history (slot, died_at desc);

alter table public.evo_engines_history enable row level security;
-- Leitura pública (transparência: a linhagem inteira é auditável); escrita só service-role.
create policy "evo_engines_history: leitura publica" on public.evo_engines_history for select using (true);

notify pgrst, 'reload schema';
