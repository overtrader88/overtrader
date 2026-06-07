-- =====================================================================
-- Overtrader v2 — Web Push (notificações do navegador).
-- Guarda as inscrições PushSubscription por usuário. Uma inscrição = um
-- navegador/dispositivo (endpoint único). RLS: o dono lê/gerencia as suas;
-- o envio é feito pelo service-role (ignora RLS).
-- =====================================================================

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- O dono enxerga e gerencia apenas as próprias inscrições.
create policy "push_own_select" on push_subscriptions for select using (auth.uid() = user_id);
create policy "push_own_insert" on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_own_delete" on push_subscriptions for delete using (auth.uid() = user_id);
