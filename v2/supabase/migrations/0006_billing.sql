-- =====================================================================
-- Overtrader v2 — Billing: ativar/desativar assinatura via webhook (Fase F3).
--
-- O webhook (ex.: Hubla) roda com service-role e chama estes RPCs ATÔMICOS:
--   - activate_subscription   → cria a assinatura (idempotente por event_id) e
--                               promove profiles.plan. Retorna FALSE se o evento
--                               já foi processado (dedupe), TRUE se aplicou agora.
--   - deactivate_subscription → marca assinaturas ativas como 'canceled' e
--                               rebaixa profiles.plan para 'free'. Idempotente.
-- Ambos gravam trilha em audit_log. A coluna subscriptions.hubla_event_id é a
-- chave de idempotência (unique) — vale para qualquer provedor.
-- =====================================================================

create or replace function activate_subscription(
  p_event_id   text,
  p_user_id    uuid,
  p_plan       plan_tier,
  p_period     billing_period,
  p_period_end timestamptz default null,
  p_actor      text default 'webhook:hubla'
)
returns boolean                                  -- true = aplicado agora; false = duplicado
language plpgsql
security definer set search_path = public
as $$
declare
  v_end timestamptz;
begin
  v_end := coalesce(
    p_period_end,
    now() + case p_period when 'annual' then interval '1 year' else interval '1 month' end
  );

  insert into subscriptions (user_id, plan, period, status, current_period_end, hubla_event_id)
  values (p_user_id, p_plan, p_period, 'active', v_end, p_event_id)
  on conflict (hubla_event_id) do nothing;

  if not found then
    return false;                               -- evento já processado → no-op
  end if;

  update profiles set plan = p_plan, updated_at = now() where id = p_user_id;

  insert into audit_log (actor, action, target, metadata)
  values (p_actor, 'activate_sub', p_user_id::text,
          jsonb_build_object('plan', p_plan, 'period', p_period, 'event', p_event_id, 'period_end', v_end));

  return true;
end;
$$;

create or replace function deactivate_subscription(
  p_event_id text,
  p_user_id  uuid,
  p_actor    text default 'webhook:hubla'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  update subscriptions
    set status = 'canceled'
  where user_id = p_user_id and status = 'active';

  update profiles set plan = 'free', updated_at = now() where id = p_user_id;

  insert into audit_log (actor, action, target, metadata)
  values (p_actor, 'deactivate_sub', p_user_id::text, jsonb_build_object('event', p_event_id));

  return true;
end;
$$;
