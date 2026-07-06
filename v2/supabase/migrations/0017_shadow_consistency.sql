-- =====================================================================
-- MODO SOMBRA self-consistency k=3 (revisão dos motores, achado 18a — Pacote B).
-- A emissão NÃO muda (1 chamada, temp 0); k=3 amostras extras a temp 0.7 são
-- colhidas SÓ quando o sinal é emitido (motores llm e llm_ds) e gravadas aqui
-- como metadado. Hipótese pré-registrada: sinais com convicção 60-65 E dissenso
-- interno (sc_agree < sc_k) têm WR pior — só vira filtro de emissão se
-- confirmar com ≥100 resolvidos com metadado.
-- O código escreve best-effort: sem estas colunas o update falha silencioso.
--
-- ATENÇÃO (lição da 0013): rodar no schema PUBLIC e recarregar o PostgREST.
-- =====================================================================
alter table public.signals add column if not exists sc_k smallint;          -- amostras de sombra colhidas (≤3)
alter table public.signals add column if not exists sc_agree smallint;      -- quantas concordaram com o lado emitido
alter table public.signals add column if not exists sc_sides text;          -- lados das amostras, ex.: "BBN" (B/S/N)
alter table public.signals add column if not exists sc_conv_spread numeric; -- dispersão de convicção (máx − mín)

notify pgrst, 'reload schema';
