# TradeAI — Documentação Master

> Plataforma BR de análise de trading com IA. Pré-lançamento. Concorrente
> direto: Vortex Trade IA.

**Última atualização:** 28 de maio de 2026
**Estado:** Sprints 1-9 concluídos. Sprint 10 (Go-to-Market) pendente.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Estado atual](#2-estado-atual)
3. [Arquitetura técnica](#3-arquitetura-técnica)
4. [Engine v1.1-adaptive — 15 camadas](#4-engine-v11-adaptive--15-camadas)
5. [Modelo de planos](#5-modelo-de-planos)
6. [Backtests validados](#6-backtests-validados)
7. [Diferenciais vs concorrência](#7-diferenciais-vs-concorrência)
8. [Compliance LGPD](#8-compliance-lgpd)
9. [Skills Cowork criadas](#9-skills-cowork-criadas)
10. [Pendências pra lançamento](#10-pendências-pra-lançamento)
11. [Decisões estratégicas pendentes](#11-decisões-estratégicas-pendentes)

---

## 1. Visão geral

### O que é

Plataforma de análise de trading com IA que entrega **15 camadas analíticas
por sinal** em uma única consulta. Diferencial central: **backtest público
transparente + IA explicativa em PT-BR**.

### Pitch principal

> *"A IA de trading que prova antes de prometer."*

### Audiência alvo

- Trader BR, 25-45 anos, intermediário/avançado
- Já opera (cripto, forex, commodities, ações, índices)
- Cético de IA "mágica", quer prova com dado
- Sensível a preço (R$ 99/mês fica no limite tolerável)

### Posicionamento

A maioria das plataformas é caixa-preta — vende confiança cega.
Diferenciamos por **transparência**: backtest público de cada padrão antes
de operar, algoritmos abertos, IA narrativa que explica o porquê.

---

## 2. Estado atual

### Sprints concluídos (1-9)

| Sprint | Entrega |
|---|---|
| **1** | Auth + scaffold + landing inicial + waitlist |
| **2** | Motor de análise + 20 indicadores + gráfico ao vivo |
| **3** | Dashboard widgets + histórico filtrável |
| **4** | LLM narrativa (GPT-4o-mini) + Backtest 3 estratégias |
| **5** | Sistema de planos + Webhook HUBLA + Admin de créditos |
| **6** | Banner qualidade + Trial automático + Watchlist + Alertas + Telegram esqueleto |
| **7** | Dashboard multi-categoria (5 mercados) |
| **8** | Compliance LGPD + Cache compartilhado + Yahoo fallback + Plans v2 |
| **9** | SMC + Multi-TF + Monte Carlo + Sazonalidade + Dual Scenarios + Harmônicos + WEGD + Notícias + Polish + Landing |

### Sprint 10 (pendente) — Go-to-Market

- **Bloco 1:** Setup técnico local (validar migrations + env vars)
- **Bloco 2:** Validação funcional end-to-end (50+ testes)
- **Bloco 3:** Infraestrutura produção (Supabase prod, Vercel, HUBLA, Telegram, APIs notícias)
- **Bloco 4:** Segurança (7 checks)
- **Bloco 5:** Performance + cota APIs
- **Bloco 6:** Marketing + conteúdo (logo, OG image, blog posts, copy revisado)

Detalhamento completo em [Pendências](#10-pendências-pra-lançamento).

---

## 3. Arquitetura técnica

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15.5 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui style |
| Auth + DB | Supabase (Postgres + RLS + Auth) |
| Mercado cripto | Binance REST + WebSocket (gratis) |
| Mercado tradicional | Twelve Data (free 800/dia, fallback Yahoo Finance) |
| IA | OpenAI GPT-4o-mini (~R$ 0.003/análise) |
| Pagamentos | HUBLA (gateway BR) |
| Telegram | Telegram Bot API |
| Notícias | CryptoPanic (cripto, free 500/dia) + NewsAPI.org (geral, free 100/dia) |
| Charts | TradingView Lightweight Charts |
| Deploy | Vercel + Vercel Cron |

### Estrutura de pastas

```
novo-sistema-trading/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # login, cadastro
│   ├── api/                     # API routes
│   │   ├── admin/credit/        # admin: creditar usuários
│   │   ├── alerts/              # alertas in-app
│   │   ├── analyze/             # POST roda análise + backtest
│   │   ├── jobs/                # cron jobs (check-alerts, cleanup-cache)
│   │   ├── market/tickers/      # tickers ao vivo
│   │   ├── me/delete-account/   # LGPD apagamento
│   │   ├── telegram/pair/       # pareamento de bot
│   │   ├── watchlist/           # CRUD watchlist
│   │   └── webhooks/
│   │       ├── hubla/           # pagamentos
│   │       └── telegram/        # bot
│   ├── dashboard/               # área logada
│   │   ├── admin/credits/       # admin
│   │   ├── alertas/             # bell + watchlist UI
│   │   ├── analise/             # nova análise + resultado
│   │   ├── assinatura/          # minha conta
│   │   ├── historico/           # análises antigas
│   │   ├── integracoes/telegram/# pareamento UI
│   │   └── layout.tsx
│   ├── planos/                  # pricing público
│   ├── politica-de-privacidade/
│   ├── termos-de-uso/
│   └── page.tsx                 # landing
├── components/
│   ├── admin/                   # credits-client
│   ├── alerts/                  # alerts-client + bell-badge
│   ├── analysis/                # cards de cada uma das 15 camadas
│   ├── dashboard/               # multi-market-tickers, fear-greed, etc
│   ├── landing/                 # hero, features, differentials, pricing, cta
│   ├── legal/                   # legal-footer
│   ├── planos/                  # planos-client (toggle mensal/anual)
│   ├── settings/                # delete-account-button
│   ├── telegram/                # pair-client
│   └── ui/                      # primitives (Button, Card, Badge...)
├── lib/
│   ├── analysis/                # ENGINE — coração do produto
│   │   ├── engine.ts            # runAnalysis() pipeline
│   │   ├── types.ts             # AnalysisResult, SignalDirection
│   │   ├── indicators.ts        # 20 indicadores técnicos
│   │   ├── signal-utils.ts      # 7 níveis, mapeamentos
│   │   ├── backtest.ts          # 3 estratégias
│   │   ├── smc.ts               # Smart Money Concepts
│   │   ├── multi-timeframe.ts   # Confluência 3 TFs
│   │   ├── monte-carlo.ts       # 5k simulações
│   │   ├── seasonality.ts       # Heatmap 12 meses
│   │   ├── dual-scenarios.ts    # Compra E Venda + prob TPs
│   │   ├── harmonics.ts         # Bat, Butterfly, etc
│   │   └── wegd.ts              # Wyckoff/Elliott/Gann/Dow
│   ├── llm/                     # OpenAI client + prompt builder
│   ├── market/                  # provider unificado + cache + yahoo
│   ├── news/                    # CryptoPanic + NewsAPI + LLM sentiment
│   ├── plans/                   # config dos 3 planos
│   ├── supabase/                # client (server + service-role)
│   ├── telegram/                # Bot API client
│   ├── auth/admin.ts            # gate de admin
│   └── utils/cn.ts              # className helper
├── supabase/migrations/         # 11 migrations SQL
├── docs/                        # ESTE DIRETÓRIO
└── vercel.json                  # Crons configurados
```

### Migrations Supabase (na ordem)

| Arquivo | Conteúdo |
|---|---|
| `20260520000001_initial_schema.sql` | profiles, user_credits, analyses, credit_transactions, trigger handle_new_user |
| `20260520000002_credit_rpcs.sql` | RPC `credit_user` |
| `20260520000003_credit_rpc_fix.sql` | fix de ambiguidade de coluna |
| `20260520000004_signal_7_levels.sql` | enum 7 níveis |
| `20260520000005_resync_signal_column.sql` | corrige sinal antigo |
| `20260522000001_subscriptions.sql` | tabela subscriptions + RPCs ativar/cancelar |
| `20260522000002_helper_get_user_id_by_email.sql` | resolução email→uuid |
| `20260522000003_signup_trial_bonus.sql` | trial 3 PRO no signup |
| `20260522000004_watchlist_alerts.sql` | watchlist + alerts |
| `20260522000005_telegram_links.sql` | pareamento Telegram |
| `20260525000001_plans_v2_trial.sql` | trial vitalício + billing_period |
| `20260525000002_market_cache.sql` | cache compartilhado |

### Variáveis de ambiente necessárias

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Site
NEXT_PUBLIC_SITE_URL=

# Market data
TWELVEDATA_API_KEY=
# (Binance é gratuito, sem key)
# (Yahoo é gratuito, sem key)

# IA
OPENAI_API_KEY=

# Admin
ADMIN_EMAILS=email1@ex.com,email2@ex.com

# Cron
CRON_SECRET=

# Notícias
CRYPTOPANIC_API_KEY=
NEWSAPI_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=

# HUBLA (pagamentos)
HUBLA_WEBHOOK_SECRET=
HUBLA_PRODUCT_PRO_MONTHLY=
HUBLA_PRODUCT_PRO_ANNUAL=
HUBLA_PRODUCT_PRO_PLUS_MONTHLY=
HUBLA_PRODUCT_PRO_PLUS_ANNUAL=
HUBLA_CHECKOUT_URL_PRO_MONTHLY=
HUBLA_CHECKOUT_URL_PRO_ANNUAL=
HUBLA_CHECKOUT_URL_PRO_PLUS_MONTHLY=
HUBLA_CHECKOUT_URL_PRO_PLUS_ANNUAL=
```

---

## 4. Engine v1.1-adaptive — 15 camadas

Cada análise entrega TODAS estas 15 camadas em uma única consulta (~5-15s):

### 4.1 Sinal final + força + confluência
- **7 níveis graduados:** STRONG_BUY / BUY / WEAK_BUY / NEUTRAL / WEAK_SELL / SELL / STRONG_SELL
- **Força:** 0-100 (consenso entre indicadores)
- **Confluência:** 0-10 (quantos indicadores votaram a favor)

### 4.2 20 indicadores técnicos votando ponderado
RSI, MACD, EMA 20/50/200, SMA 50, VWMA 20, Stochastic, CCI, Williams %R, Awesome Oscillator, MFI, ROC, ADX, Supertrend, TRIX, Bollinger Bands, ATR, OBV, CMF. Cada um vota BUY/SELL/NEUTRAL com peso por categoria.

### 4.3 8 gates adaptativos
Filtros de qualidade que se ajustam ao regime de mercado:
- **A:** Confluência mínima ≥ 6
- **B:** Tendência presente (ADX > 20)
- **C:** Volume saudável
- **D:** R:R mínimo 1:1.5 do TP1
- **E:** Volatilidade ativa (Bollinger bandwidth)
- **F:** Força mínima 50/100
- **G:** Regime de mercado adequado (trending/ranging não-transitional)
- **H:** Volatilidade não-explosiva (ATR < 2× média)

### 4.4 Níveis de risco (ATR-based)
- **Entry:** preço atual
- **SL:** 1.2× ATR
- **TP1:** 1.8× ATR (R:R = 1.5)
- **TP2:** 3.0× ATR
- **TP3:** 4.5× ATR

### 4.5 Multi-Timeframe Confluence (Sprint 9.2)
Roda análise nos 2 TFs adjacentes superiores. Calcula score 0-100 de alinhamento. Estados: `fully_aligned` / `partially_aligned` / `divergent` / `neutral`.

### 4.6 Monte Carlo Simulation (Sprint 9.3)
5.000 simulações via Geometric Brownian Motion. Cenários otimista (P90), mediana (P50), pessimista (P10). Win rate por direção. Volatilidade anualizada.

### 4.7 Sazonalidade histórica (Sprint 9.4)
Heatmap 12 meses. Stats por mês: avg return, win rate, sample size. Destaque do mês atual.

### 4.8 Dual Scenarios — Compra E Venda (Sprint 9.5)
Calcula ambos os lados (hipotéticos) com probabilidade individual por TP via CDF normal (GBM). Score por lado. Recomendação fundamentada.

### 4.9 Smart Money Concepts (Sprint 9.1)
- **Order Blocks** (até 5, com strength e mitigation status)
- **Fair Value Gaps** (até 8, com status active/filled)
- **Liquidity Zones** (até 5, com cluster count e swept status)
- **Market Structure:** BOS bullish/bearish / CHoCH bullish/bearish / consolidating
- **Viés institucional:** bullish/bearish/neutral

### 4.10 Padrões Harmônicos (Sprint 9.6)
Detecta 6 padrões XABCD via Fibonacci: Bat, Butterfly, Gartley, Crab, Cypher, Shark. Cada um com PRZ (Potential Reversal Zone), completion %, qualidade do match.

### 4.11 WEGD (Sprint 9.10)
- **Wyckoff:** fase (accumulation/markup/distribution/markdown/transition) via VSA
- **Elliott:** onda provável (1-5 impulsivas, A-B-C corretivas) com probabilidade
- **Gann:** ângulo 1x1 + posição do preço + 5 níveis projetados
- **Dow Theory:** tendência primária + confirmação

### 4.12 Notícias + Sentimento Macro (Sprint 9.11)
- Cripto: CryptoPanic (sentiment scoring nativo)
- Forex/Stocks/Comm/Indices: NewsAPI
- LLM resume e atribui sentimento agregado: bullish/bearish/neutral/mixed
- Curadoria de perfis X relevantes por categoria

### 4.13 Banner de Qualidade Automático (Sprint 6.1)
Semáforo verde/amarelo/vermelho/cinza baseado no backtest persistido. Critério:
- 🟢 **Verde:** PF ≥ 1.5 + WR ≥ 50% + TP1 Touch ≥ 55%
- 🟡 **Amarelo:** intermediário
- 🔴 **Vermelho:** PF < 1.0 OU WR < 40% OU TP1 Touch < 40%
- ⚪ **Cinza:** ainda não rodou backtest

### 4.14 Backtest público (Sprint 4 + 9)
Walk-forward sobre 500 candles. 3 estratégias comparadas:
- **Exit-TP1:** fecha tudo em TP1
- **Move-to-BE:** move stop pra entrada após TP1, busca TP2/TP3
- **Partial Exit:** fecha 50% em TP1, trail rest com BE

### 4.15 IA narrativa (Sprint 4 + 9)
GPT-4o-mini explica em PT-BR natural por que o sinal foi gerado. Inclui contexto de TODAS as 14 camadas anteriores no prompt. Custo: ~R$ 0,003 por análise.

---

## 5. Modelo de planos

### Estrutura

| Plano | Mensal | Anual | Créditos | Recursos |
|---|---|---|---|---|
| **Free** | R$ 0 | — | 3 vitalícios | Cripto · Dashboard 5 mercados |
| **PRO** | R$ 59 | **R$ 50/mês** (R$ 600/ano · −15%) | 75/mês ou 900/ano | Todos 143 ativos · IA · Backtest |
| **PRO+** | R$ 99 | **R$ 78/mês** (R$ 936/ano · −21%) | 90/mês ou 1.080/ano | Tudo do PRO + Telegram + Watchlist ilimitada |

### Custo unitário
- 1 análise = R$ 0,003 (OpenAI) + R$ 0,01 (TwelveData se non-crypto) = **~R$ 0,013**
- Margem em PRO anual: **~97%**

### Trial
- 3 análises completas vitalícias (one-time no signup)
- Sem cartão · Sem expiração · Não renovam

### Catálogo
- **143 ativos:** 59 cripto + 11 forex + 8 commodities + 59 ações + 6 índices
- **6 timeframes:** 15m, 1h, 4h, 1d, 1w, 1M

---

## 6. Backtests validados

Rodados durante validação de Sprint 9:

| Contexto | PF (TP1) | Win Rate | TP1 Touch | Avg R | Veredito |
|---|---|---|---|---|---|
| **XAUUSD 4h (ouro)** | **3.82** | 56.8% | 59% | +1.16R | 🌟 **Excepcional** |
| BTCUSDT 1h | 1.83 | 52.5% | 52% | +0.39R | ✅ Sólido |
| BTCUSDT 4h | 1.59 | 48.4% | 48% | +0.30R | ✅ Sólido |
| ETHUSDT 1h | 1.52 | 47.5% | 47% | +0.27R | ✅ Sólido |
| ETHUSDT 4h | 1.40 (BE) | 34.6% | 42% | +0.23R | ✅ Sólido (com move-to-BE) |
| BTCUSDT D1 | 1.19 | 31.9% | 41% | +0.13R | ⚠️ Marginal |

**Validação:** 6/6 positivos · 5/6 sólidos (PF > 1.3) · 1 excepcional (XAU 4h)

**PF médio:** 1.89

---

## 7. Diferenciais vs concorrência

### Tabela direta (13 linhas, em produção em /landing)

| Feature | TradeAI | Vortex Trade IA |
|---|---|---|
| Dashboard preços ao vivo (5 mercados) | ✅ em todas telas | ❌ não tem |
| Backtest público antes de operar | ✅ 3 estratégias | ❌ não disponível |
| IA narrativa explicando sinal | ✅ GPT-4o-mini PT-BR | ❌ texto genérico |
| Smart Money Concepts | ✅ algoritmos abertos | ❌ caixa-preta |
| Multi-Timeframe Confluence | ✅ score 0-100 | ❌ manual |
| Monte Carlo | ✅ 5k simulações | ✅ tem (15k mas sem prova) |
| Padrões Harmônicos | ✅ com PRZ + completion% | ✅ tem |
| WEGD (Wyckoff/Elliott/Gann/Dow) | ✅ com probabilidade | ✅ com afirmação |
| Notícias + sentimento IA | ✅ CryptoPanic + NewsAPI + LLM | ✅ sem fonte clara |
| Sazonalidade histórica | ✅ heatmap 12 meses | ✅ tem |
| 7 níveis graduados de sinal | ✅ | ❌ 3 níveis |
| Banner qualidade automático | ✅ verde/amarelo/vermelho | ❌ não tem |
| Trial vitalício sem cartão | ✅ 3 análises | ❌ apenas trial pago |

### Posicionamento-mestre

> **"Eles te dizem confie. A gente te mostra os números."**

Detalhes da análise do concorrente: ver [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md).

---

## 8. Compliance LGPD

Implementado no Sprint 8.1:

### Páginas legais (em /app)
- `/termos-de-uso` — 12 seções com disclaimer de risco no topo
- `/politica-de-privacidade` — 13 seções LGPD compliant + TL;DR

### Direitos do titular (art. 18 LGPD)
- **Confirmação e acesso:** via /dashboard/assinatura
- **Correção:** edição de profile
- **Eliminação:** endpoint `DELETE /api/me/delete-account` com confirmação "APAGAR MINHA CONTA"
- **Portabilidade:** dados via export (a fazer)
- **Revogação de consentimento:** unsubscribe nos emails

### Encarregado (DPO)
- Email: `dpo@tradeai.com.br` (a configurar com domínio real)

### Disclaimer integrado
- Footer global com aviso de risco em todas as páginas
- Disclaimer em cada análise: "Conteúdo informativo. Não constitui recomendação personalizada."
- Banner expansível com texto completo em LegalFooter component

### Cookies
- Apenas cookies essenciais (Supabase Auth)
- Sem tracking publicitário

---

## 9. Skills Cowork criadas

Duas skills foram criadas via skill-creator pra apoiar o projeto:

### 9.1 `tradeai-copywriter`
**Propósito:** copywriter especializado em produtos do TradeAI (headlines, CTAs, emails, posts, anúncios, FAQ, microcopy).

**Estrutura:**
- `SKILL.md` (123 linhas) — workflow, princípios, linhas vermelhas
- `references/brand-facts.md` (203 linhas) — números reais, pricing, features, comparativo
- `references/voice-and-tone.md` (185 linhas) — voz da marca com exemplos
- `references/frameworks.md` (199 linhas) — AIDA, PAS, BAB, 4U, HSO, CAB
- `references/examples.md` (261 linhas) — exemplos aprovados

**Arquivo:** `tradeai-copywriter.skill` (gerado nos outputs)

### 9.2 `tradeai-brainstorm`
**Propósito:** co-fundador estratégico que aplica frameworks (SCAMPER, 6 Hats, Crazy 8s, JTBD, First Principles, Pre-Mortem, Reverse Brainstorm, Analogous Worlds) ancorados no contexto TradeAI.

**Estrutura:**
- `SKILL.md` (166 linhas) — workflow 7 passos, princípios
- `references/frameworks.md` (275 linhas) — 10 frameworks com exemplos aplicados
- `references/project-context.md` (173 linhas) — snapshot completo do projeto
- `references/output-templates.md` (221 linhas) — 5 templates de saída

**Arquivo:** `tradeai-brainstorm.skill` (gerado nos outputs)

---

## 10. Pendências pra lançamento

### Bloco 1 — Setup técnico local (~30min)
- Aplicar 12 migrations no Supabase
- Validar trigger handle_new_user dá 3 PRO no signup
- Completar `.env.local` com 18 vars
- `npm install` limpo, `npm run dev` sem erro

### Bloco 2 — Validação funcional (~2h)
50+ testes em 5 sub-blocos:
- **2A:** Fluxo Free (10 testes)
- **2B:** Análise mostra todas 15 camadas (15 testes)
- **2C:** Sistema de planos (10 testes)
- **2D:** Alertas + Telegram (5 testes)
- **2E:** Legal/LGPD (4 testes)

### Bloco 3 — Infraestrutura produção

**3.A — Supabase prod (~1h)**
- Decidir projeto separado dev/prod ou compartilhado
- Backup automático (Supabase Pro $25/mo)
- Email confirmation ON
- Templates de email customizados
- Site URL + Redirect URLs

**3.B — Vercel (~45min)**
- Conectar repo GitHub
- Configurar 18 env vars
- Domínio próprio + SSL
- Atualizar NEXT_PUBLIC_SITE_URL
- Primeiro deploy

**3.C — HUBLA (~1h30)**
- Abrir conta + verificar
- Criar 4 produtos (PRO/PRO+ × mensal/anual)
- Configurar webhook → `/api/webhooks/hubla`
- Gerar `HUBLA_WEBHOOK_SECRET`
- Testar pagamento real + refund

**3.D — Telegram bot (~30min)**
- @BotFather `/newbot` → pegar token
- Configurar 3 env vars
- `setTelegramWebhook` após deploy
- Testar `/start <token>`, `/btc 1h`, `/help`

**3.E — APIs notícias (~15min)**
- Criar conta CryptoPanic + key
- Criar conta NewsAPI.org + key
- Configurar 2 env vars
- Testar análise completa com card Contexto Macro

### Bloco 4 — Segurança (~1h)
7 checks:
1. SERVICE_ROLE_KEY apenas server-side
2. RLS habilitado em TODAS as tabelas
3. CRON_SECRET ≥32 chars
4. Admin gate funciona (testar com conta não-admin)
5. Webhook HUBLA valida HMAC
6. Endpoint apagar conta exige string exata
7. Grep `console.log` de dados sensíveis

### Bloco 5 — Performance pós-deploy (~30min)
Monitorar:
- Cache market_cache populando
- TwelveData não estoura
- Análise completa < 15s
- Vercel cron rodando a cada 15min
- Cleanup cache a cada 6h

### Bloco 6 — Marketing + conteúdo (~3h)
- Revisar copy de TODAS as páginas
- Substituir `tradeai.com.br` pelo domínio real
- Substituir emails `dpo@/contato@` por reais
- Logo + favicon + Open Graph image
- robots.txt + sitemap.xml
- Plausible ou Vercel Analytics
- Página /contato
- 3 posts iniciais de divulgação

---

## 11. Decisões estratégicas pendentes

Da última sessão de brainstorm:

1. **Gerar `/contato` + `robots.txt` + `sitemap.xml`?** (eu posso fazer em ~15min)
2. **Email do domínio próprio** vs Gmail/outro provider?
3. **Plausible** vs **Vercel Analytics**?
4. **Atacar Bloco 1+2 primeiro** (validar local) **vs Bloco 3 em paralelo** (configurar infra prod)?

E do brainstorm crítico:

5. **Validar engine em 30-50 contextos** antes de lançar? (PF 3.82 pode ser cherry-pick)
6. **2 modos de UI** — Simples (1 sinal) e Avançado (15 camadas)? Reduz overload do trader iniciante.
7. **Trocar inimigo no pitch** — Vortex → Telegram channels gratuitos? (real concorrente)
8. **B2B piloto** — abrir contato com 5 escritórios de gestão BR?
9. **Beta privado de 20 usuários** antes de público?
10. **Lançar versão EN** simultânea ao PT-BR? (audiência 25x maior)

---

## Como retomar o projeto

Quando voltar:
1. Abrir este `PROJECT.md` (visão geral)
2. Abrir [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md) (contexto competitivo)
3. Decidir qual bloco atacar primeiro (1, 2, 3, 4, 5, 6)
4. Pedir "vamos retomar o projeto" no Claude — task list pendente já carregada

**Estado atual em 1 frase:** produto 100% feito tecnicamente. Falta configurar infra de produção, validar funcionalmente e ir pra ar.

---

*Documento gerado a partir do histórico de sprints 1-9. Próxima atualização após Bloco 1-2 validados.*
