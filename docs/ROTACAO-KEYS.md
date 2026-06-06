# 🔐 Checklist de rotação de chaves (pós-deploy)

> ✅ **STATUS 06/06: CONCLUÍDA.** Supabase (migrado p/ `sb_publishable`/`sb_secret`, legadas
> desativadas), OpenAI, Resend, Telegram (token + webhook secret), CRON_SECRET, FMP, NewsData,
> TwelveData, WorldNews — todas rotacionadas e verificadas em produção (secret antigo → 401).
> Hubla webhook secret NÃO é rotacionável no painel → mitigado com 2ª camada `HUBLA_URL_SECRET`
> (`?k=` na URL, exigida pelo endpoint). Pendência única: deletar o GitHub PAT (`ghp_...`) —
> baixo risco (repo privado, app não usa).


> Todas as chaves abaixo apareceram no chat de desenvolvimento e devem ser
> **rotacionadas antes de divulgar o produto**. Ordem: 🔴 crítico → 🟡 médio → 🟢 interno.
>
> **Para cada chave:** (1) gera nova no provedor → (2) atualiza na **Vercel**
> (Settings → Environment Variables → editar → Save) → (3) atualiza no `.env.local`
> local → (4) passos extras quando houver.
>
> ⚠️ **Depois de trocar tudo na Vercel, faça UM Redeploy** (Deployments → ⋯ → Redeploy)
> — variáveis de ambiente só valem após novo deploy.

---

## 🔴 Críticas (acesso total / dinheiro / e-mail)

- [ ] **SUPABASE_SERVICE_ROLE_KEY** — acesso total ao banco (ignora RLS).
  - Supabase → Project Settings → **API Keys** → rotacionar a `service_role`
    (ou Settings → API → **JWT Secret → Rotate**, que regenera anon+service).
  - ⚠️ Rotacionar o JWT secret **desloga todos os usuários** (invalida sessões). Como
    ainda não há usuários reais, é o momento ideal.
  - Atualiza `SUPABASE_SERVICE_ROLE_KEY` (e `NEXT_PUBLIC_SUPABASE_ANON_KEY` se rotacionou o JWT) na Vercel + `.env.local`.

- [ ] **OPENAI_API_KEY** — gera custo se vazar.
  - platform.openai.com → **API keys** → revoga a antiga → **Create new**.
  - Atualiza na Vercel + `.env.local`.

- [ ] **TELEGRAM_BOT_TOKEN** — controle do bot.
  - BotFather → `/mybots` → bot → **API Token** → **Revoke current token**.
  - Atualiza na Vercel + `.env.local`.
  - ⚠️ **Re-registra o webhook** com o token novo:
    ```
    curl "https://api.telegram.org/bot<TOKEN_NOVO>/setWebhook?url=https://overtrader.com.br/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
    ```

- [ ] **RESEND_API_KEY** — envio de e-mail em seu nome.
  - resend.com → **API Keys** → deleta → **Create**.
  - Atualiza na Vercel + `.env.local`. (Domínio/DKIM/SPF não mudam.)

- [ ] **HUBLA_WEBHOOK_SECRET** — autenticação do webhook de pagamento.
  - Hubla → Integrações → Webhook → **Autenticação** → gerar novo token.
  - Atualiza na Vercel + `.env.local` (o código compara com esse valor).

- [ ] **GitHub Personal Access Token** (`ghp_...`) — push no repo.
  - github.com/settings/tokens → **deleta** os tokens usados no deploy.
  - O remote local volta a pedir login; gera um novo só quando for push de novo.

---

## 🟡 Médias (APIs de dados — rate-limited)

- [ ] **FMP_API_KEY** — site FMP → Dashboard → **API Key → Regenerate**. Vercel + `.env.local`.
- [ ] **TWELVEDATA_API_KEY** — twelvedata.com → Account → API → regenerar. Vercel + `.env.local`.
- [ ] **NEWSDATA_API_KEY** — newsdata.io → Dashboard → regenerar. Vercel + `.env.local`.
- [ ] **WORLDNEWS_API_KEY** — worldnewsapi.com → Account → regenerar. Vercel + `.env.local`.

---

## 🟢 Internas (você mesmo gera)

- [ ] **CRON_SECRET** — protege as rotas de cron.
  - Gera: `openssl rand -hex 32`
  - Atualiza na Vercel + `.env.local`. (A Vercel injeta `Authorization: Bearer CRON_SECRET` nos crons automaticamente — só vale após Redeploy.)

- [ ] **TELEGRAM_WEBHOOK_SECRET** — valida que o request vem do Telegram.
  - Gera: `openssl rand -hex 32`
  - Atualiza na Vercel + `.env.local`.
  - ⚠️ **Re-registra o webhook** (mesmo comando do TELEGRAM_BOT_TOKEN) com o secret novo.

---

## ✅ Não precisa rotacionar

- **NEXT_PUBLIC_SUPABASE_ANON_KEY** — é pública por design (vai pro browser), protegida por RLS.
  Só muda se você rotacionar o JWT secret do Supabase (aí atualiza junto).
- **ADMIN_EMAILS**, **EMAIL_FROM**, **TELEGRAM_BOT_USERNAME**, **HUBLA_PRODUCT_*/CHECKOUT_URL_*** — não são segredos.

---

## Validação após rotacionar tudo

1. Vercel → Redeploy.
2. Testar: login, uma análise (OpenAI), gerar alerta/e-mail (Resend), `/start` no bot (Telegram), e um evento de teste da Hubla.
3. Conferir que os crons rodam (Vercel → Deployments → Functions/Cron logs).
