-- =====================================================================
-- 0015 — Darwin + Autópsia
--
-- 1) signals.autopsy: post-mortem gerado pela IA quando um sinal morre no
--    SL (qual camada falhou, o que o mercado fez de diferente). Best-effort.
-- 2) evo_engines: os "slots" da EVOLUÇÃO DARWINIANA. Cada slot é um motor
--    LLM cujo NÚCLEO de estratégia (prompt) evolui: quando a banca de
--    sobrevivência do prompt atual QUEBRA, o cron cruza dois núcleos
--    sobreviventes e gera um filho mutado (geração+1) no lugar.
--    O contrato de saída (JSON/regras fixas) fica no código — só o núcleo
--    evolui, então uma mutação nunca quebra o formato.
--
-- Rodar no schema PUBLIC e recarregar o PostgREST (lição da 0013).
-- =====================================================================
alter table public.signals add column if not exists autopsy text;

create table if not exists public.evo_engines (
  slot        text primary key,            -- id do motor (ex.: evo_gpt, evo_ds)
  provider    text not null,               -- gpt | ds
  core        text not null,               -- núcleo de estratégia (o que evolui)
  generation  integer not null default 1,
  deaths      integer not null default 0,  -- mortes acumuladas da linhagem
  parents     text,                        -- descrição curta do cruzamento
  born_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.evo_engines enable row level security;
-- Leitura pública (transparência: o núcleo vigente é auditável); escrita só service-role.
create policy "evo_engines: leitura publica" on public.evo_engines for select using (true);

notify pgrst, 'reload schema';
