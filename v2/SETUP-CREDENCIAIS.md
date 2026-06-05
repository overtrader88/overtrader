# Setup de credenciais — TradeAI v2

> Onde colocar: **`v2/apps/web/.env.local`** (copie de `apps/web/.env.example`).
> Esse arquivo é gitignored — **nunca** comite chaves nem cole no chat.
> Quando terminar um tier, me avise: eu verifico a *presença* das vars (sem ver os valores) e sigo.

Ordem recomendada: **Tier 1 → Tier 2** desbloqueia o essencial. Tier 3 é por feature.

---

## Tier 0 — Já funciona sem nada (cripto)

A **Binance é pública e gratuita** (sem chave). Cripto (BTC, ETH, etc.) já dá para buscar
dados reais e **calibrar o motor agora**. Se quiser, posso rodar a calibração real de
cripto antes mesmo de você configurar o resto — é só pedir.

---

## Tier 1 — Essencial (subir o app + persistência)

Estas são as vars **obrigatórias** que o `lib/env.ts` exige para o app iniciar.

### 1. Supabase (banco + auth) — obrigatório
1. Crie um projeto em https://supabase.com/dashboard (free tier serve para começar).
2. Em **Project Settings → API**, copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (⚠️ secreto, só server) → `SUPABASE_SERVICE_ROLE_KEY`
3. **Aplique o schema** (`supabase/migrations/0001_init.sql`). Duas opções:
   - **Sem CLI (mais fácil):** abra **SQL Editor** no dashboard, cole o conteúdo de
     `v2/supabase/migrations/0001_init.sql` e rode.
   - **Com CLI:** instale o Supabase CLI, `supabase link --project-ref <ref>` e
     `supabase db push`.
   - ✅ Critério: todas as tabelas criadas e RLS ativo (o editor não acusa erro).

### 2. Site URL — obrigatório
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (em produção, o domínio real).

### 3. CRON_SECRET — obrigatório (≥ 32 chars)
Gere um aleatório (qualquer um abaixo):
- Python:  `python -c "import secrets;print(secrets.token_hex(32))"`
- PowerShell:  `-join ((1..64)|%{'{0:x}' -f (Get-Random -Max 16)})`
- openssl:  `openssl rand -hex 32`
→ cole em `CRON_SECRET`.

### 4. ADMIN_EMAILS — obrigatório
- `ADMIN_EMAILS=seu-email@dominio.com` (separe por vírgula se houver mais de um).

> Com o Tier 1 + um `OPENAI_API_KEY` (Tier 2) o app **sobe**. Sem OpenAI, a validação de
> env falha no boot — se quiser subir sem IA por ora, me avise que eu torno o OpenAI
> opcional no `lib/env.ts`.

---

## Tier 2 — Dados multi-mercado + IA

### 5. TwelveData — forex / ações / índices / commodities
- Crie conta em https://twelvedata.com (free: 800 req/dia, 8 req/min).
- Copie a API key → `TWELVEDATA_API_KEY`.
- Desbloqueia: dados reais não-cripto **e a calibração completa** (cripto já vem da Binance).

### 6. OpenAI — narrativa por IA (GPT-4o-mini)
- Crie key em https://platform.openai.com/api-keys → `OPENAI_API_KEY`.
- Custo ~R$ 0,003 por análise. (Hoje é obrigatória para o boot — ver nota do Tier 1.)

---

## Tier 3 — Por feature (pode deixar para depois)

| Feature | Vars | Onde obter |
|---|---|---|
| Notícias cripto | `CRYPTOPANIC_API_KEY` | cryptopanic.com/developers/api (free 500/dia) |
| Notícias gerais | `NEWSAPI_KEY` | newsapi.org (free 100/dia, dev) |
| Bot Telegram (PRO+) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | @BotFather no Telegram |
| Pagamentos | `HUBLA_WEBHOOK_SECRET` + 4 produtos + 4 URLs de checkout | painel HUBLA |
| Observabilidade | `SENTRY_DSN` | sentry.io |

---

## Como me devolver

1. Preencha `v2/apps/web/.env.local`.
2. Me diga **qual tier** você completou (ex.: "Tier 1 e TwelveData prontos").
3. Eu **verifico a presença** das vars com um comando que não exibe valores
   (algo como contar quais chaves estão definidas), confirmo, e sigo:
   - ligo o `realProviders` com a chave,
   - rodo a **calibração com dados reais**,
   - escrevo `SupabaseCacheStore`/`SupabaseRateLimiter` + wrappers de RPC contra o seu projeto,
   - e ponho de pé as primeiras API routes.

> Lembrete: o Binance (cripto) não precisa de nada — se quiser ver o motor calibrando com
> dado real **já**, é só pedir "roda a calibração de cripto".
