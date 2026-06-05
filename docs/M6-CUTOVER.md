# M6 — Checklist de cutover (v1 → v2)

Guia honesto para colocar o **TradeAI v2** em produção e migrar do v1 com segurança.
Marque cada item; nada de cutover sem os **críticos (🔴)** verdes. O v1 fica no ar
até os critérios de aceite passarem (rollback = apontar o domínio de volta).

> Estado em 04/06/2026: motor + camada de API + frontend (Análise, Dashboard, Login,
> Histórico, Watchlist, Planos) ligados a dados reais. 140 testes verdes. Faltam itens
> de infra/operacão listados abaixo.

---

## 1. Pré-requisitos de ambiente (🔴)

Variáveis (validadas por `apps/web/lib/env.ts`; em dev ficam em `apps/web/.env.local`,
em produção no painel do host):

| Var | Obrigatória | Observação |
|-----|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | 🔴 | projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🔴 | pública (RLS protege) |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 | **server-only**, nunca no bundle |
| `NEXT_PUBLIC_SITE_URL` | 🔴 | usada em redirects/OAuth |
| `OPENAI_API_KEY` | 🟡 | só quando ligar a narrativa de IA |
| `ADMIN_EMAILS` | 🔴 | gate de admin |
| `CRON_SECRET` | 🔴 | ≥ 32 chars; protege rotas de cron |
| `TWELVEDATA_API_KEY` | 🟡 | forex/ações/índices/commodities (cripto não precisa) |
| `SENTRY_DSN` | 🟡 | observabilidade |
| `TELEGRAM_*`, `HUBLA_WEBHOOK_SECRET` | ⚪ | só quando ligar bot/pagamentos |

- [ ] Todas as 🔴 setadas no host de produção.
- [ ] `getEnv()` não lança no boot (rode uma rota qualquer e confira o log).

## 2. Banco de dados / Supabase (🔴)

- [ ] Aplicar `v2/supabase/migrations/0001_init.sql` no projeto de produção.
- [ ] Confirmar **RLS habilitado** em todas as tabelas (o schema já faz; revalidar no painel).
- [ ] **Auth → Email** habilitado (login email+senha). Decidir se exige confirmação de e-mail
      (precisa de SMTP configurado; o SMTP de dev do Supabase tem limite baixo).
- [ ] (Opcional) **Auth → Google** habilitado + Client ID/Secret + redirect
      `https://SEU_DOMINIO/auth/callback` na allowlist. Sem isso, o botão Google falha (email+senha segue ok).
- [ ] `Site URL` e `Redirect URLs` do Supabase Auth apontando para o domínio de produção.
- [ ] Trigger `on_auth_user_created` ativo (dá 3 créditos de trial). Testar criando um usuário.

## 3. Segurança (🔴)

- [ ] Segredos: só `NEXT_PUBLIC_*` vão ao cliente. `SUPABASE_SERVICE_ROLE_KEY` é lida em
      `lib/supabase/server.ts` (server-only) — confirme que não vaza no bundle (`next build` + inspeção).
- [ ] `middleware.ts` protege `/dashboard`, `/historico`, `/alertas` (testado: 307 → /login).
- [ ] **Rate limit** em `/api/analyze` e `/api/quotes`: a tabela `rate_limits` e `lib/http/rate-limit.ts`
      existem, mas **ainda não estão plugados às rotas** — ⚠️ ligar antes de abrir ao público (evita abuso de fetch).
- [ ] `.env.local` no `.gitignore` (confirmado).

## 4. Build & deploy

- [ ] `pnpm run ci` (type-check + lint + test + build) verde. No Windows o build pode dar `EPERM`
      em `.next/trace` se houver dev server segurando o lock — em CI/Vercel (Linux) não ocorre.
- [ ] `next.config` transpila os pacotes do workspace (`@tradeai/engine`, `@tradeai/shared`) — confirmar
      `transpilePackages` (necessário p/ importar TS do monorepo).
- [ ] Rotas de API usam `runtime = "nodejs"` (Supabase/providers) — já setado.
- [ ] Host (ex.: Vercel): root do projeto = `v2`; build command `pnpm --filter @tradeai/web build`; Node 20+.

## 5. Critérios de aceite vs v1 (🔴 antes de flipar o domínio)

- [ ] **Análise** funciona para os 3 mundos: cripto (BTCUSDT), forex (EURUSD), ação (AAPL) —
      retorna sinal + níveis + Monte Carlo + cenários + backtest + **selo**.
- [ ] **Selo honesto**: mostra cinza com amostra fina, e veredito (verde/amarelo/vermelho) com amostra
      suficiente — nunca verde sobre n pequeno. (Hoje: BTC 4h → vermelho; BTC 1d → amarelo.)
- [ ] **Credibilidade**: todo número estatístico exibe n + IC + período (ConfidenceBadge).
- [ ] **Login → Dashboard → Histórico**: criar conta, analisar, ver a análise no histórico e nas "recentes".
- [ ] **Watchlist**: ★ Acompanhar na Análise → aparece e some no dashboard.
- [ ] **Planos**: página renderiza (pagamento real é pós-cutover, depende do HUBLA).
- [ ] Posicionamento honesto preservado (sem "máquina de lucro"; ver [[REESCRITA-BLUEPRINT]] §12).

## 6. Passos de cutover

1. [ ] Deploy v2 em **staging** (subdomínio, ex.: `app2.tradeai...`).
2. [ ] Smoke completo de §5 no staging com dados reais.
3. [ ] Conferir latência da Análise (fetch profundo + backtest ~2–6s; ok p/ MVP, considerar loading/streaming).
4. [ ] Backup do banco do v1 (se compartilham projeto, garantir isolamento de tabelas).
5. [ ] Apontar o domínio para o v2. **Manter o v1 acessível** num subdomínio por alguns dias.
6. [ ] Monitorar erros (Sentry/logs) nas primeiras horas.
7. [ ] **Rollback**: reapontar o domínio para o v1 (sem migração destrutiva, é instantâneo).

## 7. Lacunas conhecidas (honesto — não bloqueiam o cutover, mas registre)

- **Alertas/cron**: RPC `process_watchlist_alert` e `cleanup_market_cache` existem no schema, mas
  **não há scheduler nem rota de cron** ligando a watchlist a notificações. Watchlist hoje = lista salva + re-analisar.
- **Consumo de crédito**: ver análise é grátis (decisão honesta p/ não cobrar em refresh/prefetch); o saldo é real e
  `consume_credits` está pronto como gancho p/ uma ação premium futura.
- **Catálogo**: 16 ativos curados (`lib/market/catalog.ts`); o catálogo completo (143) é incremental.
- **Narrativa de IA**: `OPENAI_API_KEY` previsto, mas não há rota gerando texto ainda.
- **Webhooks** (HUBLA pagamentos, Telegram bot): schemas Zod prontos, rotas a construir.
- **Binance geo**: a API pública da Binance pode ser bloqueada em alguns países/IPs de datacenter;
  o fallback Yahoo cobre cripto parcialmente. Validar do IP do host de produção.

---

**Resumo:** o produto está funcional e honesto. Antes do tráfego público, os bloqueadores reais são
**rate limit nas rotas** e **confirmar build/deploy no host (Linux)** + **config de Auth no Supabase**.
O resto é incremental e pode entrar depois do cutover.
