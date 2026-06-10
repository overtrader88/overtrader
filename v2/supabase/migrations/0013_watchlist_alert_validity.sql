-- =====================================================================
-- Overtrader v2 — Watchlist como ALERTA PAGO.
-- Cada alerta (ativo + timeframe + lado) custa 15 créditos e vale 5 dias.
-- `expires_at` guarda o vencimento; o cron ignora alertas vencidos.
--
-- expires_at NULL = alerta LEGADO (criado quando era grátis) → continua
-- ativo para sempre (grandfathering). Apenas alertas NOVOS/renovados a partir
-- de agora recebem expires_at = now() + 5 dias e são cobrados.
-- =====================================================================

alter table watchlist add column if not exists expires_at timestamptz;

comment on column watchlist.expires_at is
  'Vencimento do alerta pago (15 créditos / 5 dias). NULL = alerta legado grátis (não expira).';
