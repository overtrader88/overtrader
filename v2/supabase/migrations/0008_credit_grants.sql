-- =====================================================================
-- Overtrader v2 — Créditos por assinatura (Fase 4).
-- Recria activate_subscription para, além de promover o plano, CONCEDER os
-- créditos do plano/período. Concede a cada evento NÃO-duplicado:
--   - anual  → total de uma vez (PRO 900 · PRO+ 2.100)
--   - mensal → a cada pagamento recorrente confirmado (PRO 75 · PRO+ 175),
--              pois cada renovação chega como um event_id novo.
-- Idempotente por hubla_event_id (não credita duas vezes o mesmo evento).
-- Usa credit_user (upsert de saldo + trilha em credit_transactions).
-- =====================================================================

create or replace function activate_subscription(
  p_event_id   text,
  p_user_id    uuid,
  p_plan       plan_tier,
  p_period     billing_period,
  p_period_end timestamptz default null,
  p_actor      text default 'webhook:hubla'
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_end     timestamptz;
  v_credits integer;
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

  -- Concessão de créditos do plano/período.
  v_credits := case
    when p_plan = 'pro'      and p_period = 'monthly' then 75
    when p_plan = 'pro'      and p_period = 'annual'  then 900
    when p_plan = 'pro_plus' and p_period = 'monthly' then 175
    when p_plan = 'pro_plus' and p_period = 'annual'  then 2100
    else 0
  end;
  if v_credits > 0 then
    perform credit_user(
      p_user_id, v_credits, 'subscription',
      jsonb_build_object('plan', p_plan, 'period', p_period, 'event', p_event_id)
    );
  end if;

  insert into audit_log (actor, action, target, metadata)
  values (p_actor, 'activate_sub', p_user_id::text,
          jsonb_build_object('plan', p_plan, 'period', p_period, 'event', p_event_id,
                             'period_end', v_end, 'credits_granted', v_credits));

  return true;
end;
$$;
