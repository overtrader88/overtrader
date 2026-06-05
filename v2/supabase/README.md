# Supabase — TradeAI v2

Schema **consolidado** numa única migration ([`migrations/0001_init.sql`](./migrations/0001_init.sql)),
substituindo as 12 migrations fragmentadas do v1.

## Aplicar (requer Supabase CLI)

O Supabase CLI **não está instalado** neste ambiente. Para validar o schema:

```bash
# instalar o CLI: https://supabase.com/docs/guides/cli
supabase init        # se ainda não inicializado (gera config.toml)
supabase start       # sobe Postgres local
supabase db reset    # aplica migrations do zero  → critério de aceite do M0.5
```

`supabase db reset` deve aplicar `0001_init.sql` sem erro, com RLS ativo em todas as
tabelas. Esse é o critério de aceite do M0.5 — rodar quando o CLI estiver disponível.

## Destaques do schema

- **RLS em todas as tabelas.** Tabelas de infra (`market_cache`, `rate_limits`,
  `audit_log`) ficam sem policies → acessíveis só via service-role.
- **RPCs atômicos:** `consume_credits` e `process_watchlist_alert` num único
  statement com lock — corrigem as race conditions do v1.
- **Idempotência de webhook:** `subscriptions.hubla_event_id` é `unique`.
- **Trail de auditoria:** `audit_log` para operações admin/webhook.
- RPCs marcados `[STUB]` têm assinatura final; a lógica completa entra no M4.
