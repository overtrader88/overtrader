-- =====================================================================
-- Convicção + racional dos motores LLM — persistidos por sinal.
-- Habilita: calibração (convicção 80 acerta mais que 60?), sizing contínuo
-- do Ringue de Sobrevivência e auditoria do "porquê" de cada decisão da IA.
-- O código escreve best-effort: sem estas colunas o update falha silencioso.
--
-- ATENÇÃO (lição da 0013): rodar no schema PUBLIC e recarregar o PostgREST.
-- =====================================================================
alter table public.signals add column if not exists conviction integer;
alter table public.signals add column if not exists rationale text;

notify pgrst, 'reload schema';
