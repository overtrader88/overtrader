-- =============================================================
-- Resincroniza a coluna `signal` a partir do payload jsonb.
-- =============================================================
-- Para análises antigas (anteriores ao refactor de 7 níveis),
-- a coluna `signal` pode ter ficado fora de sincronia com o
-- valor real registrado em `payload.signal.signal`.
--
-- Esta migration faz UPDATE só em linhas onde os dois valores diferem
-- — opcional e segura de rodar várias vezes.
-- =============================================================

update public.analyses a
set signal = (a.payload->'signal'->>'signal')::public.signal_direction
where a.payload is not null
  and a.payload->'signal'->>'signal' is not null
  and a.signal::text <> (a.payload->'signal'->>'signal');

-- Sanity check
select 'Total alinhado: ' || count(*) || ' registros' as msg
from public.analyses
where payload is not null
  and signal::text = (payload->'signal'->>'signal');
