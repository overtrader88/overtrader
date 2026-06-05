-- =====================================================================
-- TradeAI v2 — Ciclo de vida do sinal (Fase C3).
-- Colunas que registram o progresso da gestão escalonada (multi-TP + breakeven
-- automático): quais alvos já bateram e onde o stop está agora. Atualizadas pelo
-- cron de resolução a cada passada — inclusive em sinais AINDA ABERTOS, para a
-- vitrine mostrar "TP1 atingido · stop no breakeven · correndo p/ TP2".
-- =====================================================================

alter table signals
  add column tp1_hit      boolean not null default false,
  add column tp2_hit      boolean not null default false,
  add column tp3_hit      boolean not null default false,
  add column stop_stage   text not null default 'initial',  -- initial | breakeven | tp1
  add column current_stop numeric;
