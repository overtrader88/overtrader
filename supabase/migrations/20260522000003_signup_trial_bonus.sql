-- =============================================================
-- Sprint 6.2: Trial automatico generoso no signup
--
-- Antes:  3 creditos simples (sem PRO)
-- Agora:  10 simples + 3 PRO  (~R$ 0,01 de custo por signup,
--         mas converte muito mais — usuario testa IA antes de assinar)
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  -- Trial generoso: 10 simples + 3 PRO permite testar IA + backtest
  insert into public.user_credits (user_id, credits_simple, credits_pro)
  values (new.id, 10, 3)
  on conflict (user_id) do nothing;

  -- Registra na auditoria
  insert into public.credit_transactions (
    user_id, type, amount_simple, amount_pro, source, metadata
  )
  values (
    new.id,
    'bonus',
    10,
    3,
    'signup_trial',
    jsonb_build_object(
      'reason', 'Bonus de boas-vindas - teste IA + backtest gratis',
      'version', 'sprint-6.2'
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Trigger ja existe e aponta pra handle_new_user — nao precisa recriar
