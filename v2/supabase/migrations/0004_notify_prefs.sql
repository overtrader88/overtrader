-- =====================================================================
-- TradeAI v2 — Preferência de notificação por e-mail (Fase C2).
-- Opt-in explícito: e-mail de alerta só sai se o usuário ativar (anti-spam /
-- conformidade). Telegram é por vínculo (telegram_links), sem coluna extra.
-- =====================================================================

alter table profiles add column notify_email boolean not null default false;
