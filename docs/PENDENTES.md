# Pendências de ativação / validação

> Itens que estão **prontos no código** mas faltam **passos externos** (deploy, credenciais,
> validação ao vivo) para entrar em produção. Atualizado em 06/06/2026.

## 🟢 PRODUÇÃO NO AR (06/06)
- ✅ Deploy na **Vercel** (monorepo: Root `v2/apps/web`, `outputFileTracingRoot` = raiz do repo na Vercel via `process.env.VERCEL`).
- ✅ Domínio **overtrader.com.br** com SSL (registro A `@ → 216.198.79.1` na Locaweb; e-mail/MX/DKIM intactos).
- ✅ Supabase Auth **Site URL** → produção (corrigir redirect URLs se faltar).
- ✅ Webhook Telegram registrado em `https://overtrader.com.br/api/telegram/webhook`; `/start` responde.
- ✅ Webhook Hubla com as 4 regras apontando pro domínio final.
- ✅ **Rotação de keys (crítica):** Supabase (migrado p/ `sb_publishable`/`sb_secret`, legadas desativadas), OpenAI, Resend, Telegram — todas trocadas e verificadas ao vivo.
- [ ] **Rotação restante:** Hubla webhook secret · GitHub token · FMP/TwelveData/NewsData/WorldNews · CRON_SECRET · TELEGRAM_WEBHOOK_SECRET (ver `docs/ROTACAO-KEYS.md`).
- [x] **Plano Vercel PRO (07/06):** crons agora rodam no schedule real — `check-watchlist`(1h), `emit-signals`(4h), `resolve-signals`(1h), `settle-live`(1h).

## 💳 Sistema de créditos (modelo definido 07/06)

**Grants (assinatura):** PRO 75/mês · 900/ano · PRO+ 175/mês · 2.100/ano · Free 3 vitalícios (já no signup).
**Consumo:** /analise = 1 crédito/análise · /ao-vivo = 2 créditos/hora (PRO/PRO+) · /monitor = ativação 20 créditos por 5 dias (re-paga ao expirar).

- [x] **Fase 1 — /analise consome 1 crédito por análise NOVA** (RPC `consume_credits`; Free a 0 → bloqueia + CTA /planos). Análises ficam SALVAS no histórico e o usuário reabre quando quiser **de graça** via `/analise?id=<id>` (snapshot, sem recomputar/cobrar) — histórico e recentes do dashboard linkam por `?id`. Validado em prod (gerar nova 49→48; abrir salva 48→48).
- [x] **Fase 2 — /ao-vivo (código):** grade de ativos com toggle + metering no servidor (2 na ativação + 2/hora; relógio segue com página fechada até desligar; sem saldo desativa). Exclusivo PRO/PRO+; mercado fechado trava. Cron `settle-live` (15 * * * *). Migration 0010 aplicada. **Vercel PRO ativo (07/06) → crons rodam de hora em hora (metering em tempo real).**
- [x] **Fase 3 — /monitor (código):** exclusivo PRO/PRO+, ativação 20 créditos/5 dias. **Aplicar migration 0009.**
- [x] **Fase 4 — grants (código):** `activate_subscription` concede 75/900 (PRO) · 175/2100 (PRO+); anual de uma vez, mensal a cada renovação (event_id novo). **Aplicar migration 0008.** ⚠️ validar com evento real da Hubla que a renovação mensal chega como webhook.
- [ ] **APLICAR EM PROD (Supabase):** migrations **0008, 0009, 0010** (na ordem).

## 🔒 Cadastros FECHADOS (pré-lançamento / validação)

Trava na UI ativa via flag `NEXT_PUBLIC_SIGNUPS_OPEN` (ausente/`false` = fechado).
- [x] UI travada: landing sem "Criar conta", /login só "Entrar" com aviso.
- [ ] **OBRIGATÓRIO (bloqueio real):** Supabase → **Authentication → Sign In / Providers → desligar "Allow new users to sign up"**. Sem isso, dá pra criar conta chamando a API de auth direto com a anon key (pública) — e via Google OAuth. Existentes continuam logando.
- [x] **Navegação travada (anti-recon):** mesma flag no middleware — pré-lançamento só deixa navegar sem login a allowlist (`/`, `/login`, `/recuperar`, `/redefinir-senha`, `/termos`, `/privacidade`, callback OAuth); todo o produto (dashboard, /analise, /ao-vivo, /monitor, /planos, /track-record, /roadmap…) redireciona pra /login. Validado anônimo (307→/login).
- [ ] **Hardening opcional:** APIs de produto (`/api/analyze`, `/api/candles`, `/api/quotes`) NÃO são gated pelo middleware (excluídas p/ não quebrar webhooks/cron/telegram). Recon direto via API ainda é possível — gatear por auth se virar preocupação (cuidando p/ não afetar webhooks/cron).
- [ ] **No lançamento:** setar `NEXT_PUBLIC_SIGNUPS_OPEN=true` na Vercel (rebuild) reabre **cadastro E navegação** de uma vez **e** reativar o toggle do Supabase.

## 🟡 Web Push (alertas de confluência reforçada) — ativar

Código pronto (SW `public/sw.js`, `lib/push/*`, rotas `/api/push/subscribe|notify`, toggle "🔔 Alertas" no /ao-vivo). Falta:
- [ ] **Migration 0007** aplicada no Supabase de prod: `v2/supabase/migrations/0007_push.sql` (tabela `push_subscriptions` + RLS).
- [ ] **Env vars na Vercel** (3): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto). As chaves já estão no `.env.local`; **recriar com `npx web-push generate-vapid-keys` se vazarem**. `NEXT_PUBLIC_*` é baked no build → redeploy após setar.
- [ ] Validar: logar → /ao-vivo → "🔔 Alertas" (aceitar permissão) → quando uma confluência REFORÇADA aparecer, chega notificação + entra no sininho (tabela `alerts`).
- ⚠️ Sem cron, o push só dispara enquanto há uma aba do /ao-vivo aberta detectando a confluência. Para alerta com o site fechado, ligar um cron server-side que analisa os ativos (depende do Vercel Pro — ver acima).

## 🟡 Telegram (C5 + C2) — validar ao vivo

- [ ] **Registrar o webhook** após o deploy (Telegram não alcança `localhost`):
  ```bash
  curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<APP>.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
  ```
- [ ] **Validar o fluxo real de usuário:** logar → Alertas → Conectar Telegram → `/start` no bot → confirmar vínculo → disparar um alerta de watchlist e ver o DM chegar. (Verificado só com usuário de teste sintético até agora.)
- [ ] **Rotacionar o token** do bot antes de ir a público (apareceu no chat de dev). BotFather → `/revoke` → atualizar `TELEGRAM_BOT_TOKEN` no `.env.local` e na Vercel.
- ✅ Já validado: canal oficial de sinais (`emit-signals` postou 6 sinais reais), webhook secret 401/200, `/start` vincula, `/stop` desvincula.

## 🟡 Vercel (deploy) — validar

- [ ] **Env vars na Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_SIGNALS_CHAT_ID`, `NEWSDATA_API_KEY`, (`RESEND_API_KEY`, `EMAIL_FROM` quando ativar e-mail).
- [ ] **Crons** (`vercel.json`): confirmar que `check-watchlist` / `emit-signals` / `resolve-signals` rodam no agendamento (Hobby limita a 1×/dia; Pro permite o cron real). Auth via header `Authorization: Bearer CRON_SECRET` (Vercel injeta).
- [ ] Build/deploy do monorepo (transpilePackages + `outputFileTracingIncludes` das fontes do PDF já configurados).

## 🟡 Migrations no Supabase de produção

- Dev atual: **0002 ✅ · 0003 ✅ · 0004 ✅ · 0005 ✅** (todas aplicadas em 05/06; narrativas re-emitidas e ativas no monitor).
- [ ] Aplicar 0002–0005 no projeto Supabase de **produção** quando houver.

## 🟢 E-mail (Resend) — ativo no dev

- ✅ Domínio `overtrader.com.br` **verificado** no Resend; envio real testado (HTTP 200 + id) de/para `contato@overtrader.com.br`.
- ✅ `RESEND_API_KEY` + `EMAIL_FROM=contato@overtrader.com.br` no `.env.local` (dev). Remetente exibido como "Overtrader <…>".
- ✅ Toggle de opt-in na página **Alertas** (`components/email-notify.tsx` + `/api/notify-prefs`); persiste `profiles.notify_email` (migration 0004 já aplicada).
- [ ] **Vercel:** adicionar `RESEND_API_KEY` + `EMAIL_FROM` nas env vars de produção.
- [ ] **Rotacionar a `RESEND_API_KEY`** antes do público (apareceu no chat de dev) — Resend → API Keys → revoke/recreate.
- ✅ **Fluxo dispatch validado end-to-end:** usuário de teste (notify_email=true, email=contato@overtrader.com.br) → `dispatchUserAlert` retornou `email: "sent"` e o e-mail chegou. Usuário de teste e rota temporária já removidos.
- [ ] Falta só validar via **UI logada real** (login → Alertas → botão "Ativar e-mail" → toggle persiste). A rota `/api/notify-prefs` está testada deslogada (401 seguro); o caminho autenticado é trivial mas não exercitado com sessão de browser.

## 🟡 Fase F (robustez/segurança) — parcial

- ✅ **F1 rate-limit por IP** (`lib/http/limit.ts`) plugado em 10 rotas públicas/pesadas (analyze 15, narrative 10, backtest 20, report 10, fundamental 40, news 30, monitor 30, candles 60, quotes 60, telegram-link 10 — req/min). Verificado ao vivo (11ª req → 429 + `Retry-After`). Crons e webhook ficam de fora (já protegidos por secret).
  - ⚠️ **Caveat serverless:** estado é **por-instância** (in-memory). Corta burst/abuso numa instância, mas o rate-limit **global** (compartilhado) precisa da tabela `rate_limits` no Supabase — TODO de produção.
- ✅ **env Zod** (`lib/env.ts`): adicionados `TELEGRAM_SIGNALS_CHAT_ID`, `RESEND_API_KEY`, `EMAIL_FROM` (todos opcionais).
- ✅ **F4 catálogo → 143 ativos** (cripto 52, forex 25, commodities 12, índices 13, ações 41). Cada símbolo novo verificado fetchável ao vivo. DAX/CAC dropados (TwelveData grátis resolve para ETFs US ambíguos — dado errado); compensados com 2 criptos.
- [ ] **F2 Sentry** (SDK real, hoje stub) · **F3 HUBLA webhook** (pagamentos) · **F5 prod Supabase** · **F6 consume_credits** (RPC existe, não plugado) · **F7 deploy** · **F8 e2e** · **F9 cutover**. Adiados (dependem de prod/credenciais).

## 🟡 HUBLA / pagamentos (F3) — código pronto, falta ativar

Implementado e testado (137 testes verdes, build ok): adapter de billing **agnóstico** (`lib/billing/` — Hubla hoje, Kiwify/Asaas trocando 1 arquivo), webhook `POST /api/webhooks/hubla` (verifica HMAC, normaliza evento, aplica plano idempotente), RPCs atômicos `activate_subscription`/`deactivate_subscription` (migration **0006**), e botões de checkout na página `/planos` (toggle mensal×anual, lê `HUBLA_CHECKOUT_URL_*`). Verificado ao vivo: 503 sem secret · 401 assinatura inválida · 200 ignorado · 200 `user_not_found` (HMAC real bateu).

Para ativar:
- ✅ **Migration `0006_billing.sql` aplicada no dev** + **fluxo validado end-to-end**: ativar PRO → `plan=pro` + assinatura ativa; reenvio → `duplicate` (idempotente); reembolso → `plan=free` + `canceled`; trilha em `audit_log`. Aplicar também no **prod** quando houver.
- ✅ **IDs/ofertas** mapeados no `.env.local` (dev) e verificados ao vivo (5 eventos → activate/deactivate corretos): PRO=`j6GJHPug3fwnDc5tg7R5`, PRO+=`UmxSpbxlucRrwCMuuwQb`, PRO anual=`RlEiN3z9YWnuVNwLP95I`, PRO+ anual=`OKU1Pv90sdFHw2SO6Nzo`. Replicar na **Vercel**. (Na Hubla são 2 produtos com ofertas mensal/anual — o **plano** sai sempre certo; o **período** confirmar no 1º evento real.)
- ✅ **Links de checkout** dos 4 no `.env.local` (dev) — botões da `/planos` já abrem o checkout certo. Falta replicar na **Vercel**.
- ✅ **Autenticação confirmada:** a Hubla usa **token estático** (painel → Autenticação), não HMAC. `verify()` ajustado pra aceitar o token em `x-hubla-token`/`Authorization: Bearer`/etc. `HUBLA_WEBHOOK_SECRET` = token da Hubla no `.env.local` (dev). Verificado ao vivo: token certo → 200, token errado → 401.
- ✅ **Eventos confirmados:** "Assinatura ativa (v2)" → activate · "Solicitação reembolso" → deactivate. `parse()` agora classifica por **palavra-chave** (PT/EN) — resiliente à string exata. 4 regras criadas na Hubla (PRO/PRO+ × ativar/reembolso).
- [ ] ⚠️ **Corrigir a URL das 4 regras na Hubla:** hoje apontam pro domínio raiz (`overtrade.com.br`) — trocar para `https://<APP-PUBLICO>/api/webhooks/hubla` após o deploy. **Conferir o domínio** (overtrade vs overtrade**r**).
- [ ] (Opcional) Criar regras de **"Assinatura cancelada/inativa"** além de reembolso, pra revogar acesso em cancelamento/expiração (não só reembolso).
- [ ] ⚠️ **Confirmar caminhos do payload** (e-mail, productId, eventId) pela aba **Histórico** após o 1º evento real — a extração é defensiva mas pode precisar de ajuste fino.
- [ ] **Admin — link clicável do código de compra (fazer nos testes de venda):** o `/admin` já mostra o `subscriptions.hubla_event_id` ao lado do usuário (texto monoespaçado, clique copia). Quando rodarmos os **testes de venda reais**, confirmar (a) qual id o webhook está de fato gravando — `event.id`/`invoiceId`/`subscriptionId` — e (b) a URL do painel da Hubla que abre a ficha da compra/transação por esse id; então trocar o texto por um **link direto** pra Hubla (rastreio em 1 clique). Depende do item acima (confirmar caminhos do payload).
- [ ] **Rotacionar o token** da Hubla antes do público (apareceu no chat de dev) — painel → Autenticação → gerar novo + atualizar `.env.local`/Vercel.
- [ ] Decisão tributária: começar **CPF**, migrar p/ CNPJ quando o faturamento crescer (não afeta código).

## 🔵 Web push (C2) — feature adiada

- [ ] Notificações web push (VAPID + service worker) — não iniciado; canais de Telegram + e-mail cobrem o C2 por ora.

## ⚙️ Motor 2 (leitura por classe) — pendências

- [ ] **Motor 2 atualizar sozinho na live (polling client-side).** Hoje, no Ao vivo, o Motor 2 é um snapshot 4h renderizado no servidor (recalcula só ao recarregar a página). O Motor padrão faz streaming contínuo via LiveTrading. Pendente: um componente client que faz polling da leitura por classe (veredito + plano + dados) e atualiza ao vivo, como o Motor padrão. Onda maior (novo endpoint de leitura por classe + componente client de polling).

## 🧠 IA de insights sobre os motores — aguardando amostra (decisão 08/06)

Objetivo: a IA analisar os resultados forward dos motores e propor ajustes na
lógica para melhorar resultados — SEM overfitting.

- [ ] **Aguardar ~5 dias de amostra forward** (sinais resolvidos por motor) antes de construir. Com amostra muito pequena qualquer "insight" é ruído.
- [ ] **Depois:** painel **"Insights da IA"** (read-only) no admin — lê os agregados por motor × classe × TF × regime (com n e IC), aponta padrões só onde a amostra é suficiente, marca o resto como ruído, e propõe hipóteses testáveis ranqueadas.
- [ ] **Harness de "Motor candidato" (A/B forward):** hipóteses viram uma variante que roda em paralelo só no track record; só promove a lógica viva se o desempenho **out-of-sample** vencer com amostra ≥ limiar + IC. Nunca auto-aplica; o forward decide.
