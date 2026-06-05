-- =============================================================
-- Sprint 6.5: Telegram bot — vinculo usuario <-> chat_id
-- =============================================================
-- Usuario gera um token de pareamento no app, manda no chat com /start <token>
-- Webhook do bot recebe e vincula chat_id -> user_id.
-- =============================================================

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  /** chat_id no Telegram (bigint mas guardado como text por seguranca) */
  chat_id text not null unique,
  /** username @ do Telegram (opcional, pra UI mostrar) */
  username text,
  /** Token de pareamento gerado pelo app (gasto apos uso) */
  pair_token text unique,
  /** Quando o usuario completou o /start <token> */
  paired_at timestamptz,
  /** Token expira em 15min sem uso */
  pair_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_links_user_idx
  on public.telegram_links (user_id);

create index if not exists telegram_links_pair_token_idx
  on public.telegram_links (pair_token)
  where pair_token is not null;

alter table public.telegram_links enable row level security;

-- Usuario ve apenas seu proprio link
drop policy if exists telegram_links_select_own on public.telegram_links;
create policy telegram_links_select_own
  on public.telegram_links
  for select
  using (auth.uid() = user_id);

-- Usuario gera token via API server-side (que usa service_role).
-- Mas pode deletar (desvincular).
drop policy if exists telegram_links_delete_own on public.telegram_links;
create policy telegram_links_delete_own
  on public.telegram_links
  for delete
  using (auth.uid() = user_id);

drop policy if exists telegram_links_service_modify on public.telegram_links;
create policy telegram_links_service_modify
  on public.telegram_links
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table public.telegram_links is
  'Vincula chat do Telegram a usuario do app. Pareamento via token efemero.';
