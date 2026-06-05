# TradeAI — Sistema concorrente ao Vortex Trade IA

Plataforma de análises de trading com IA, posicionada para **nascer melhor** que o Vortex Trade IA com investimento enxuto (estratégia LEAN — R$ 60-150k, 2-4 pessoas, 90 dias até primeira receita).

> **Placeholder:** "TradeAI" é nome temporário enquanto a marca não é definida. Substituir em massa quando decidir o nome final.

---

## O que o Sprint 1 entrega

- ✅ Scaffold Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui
- ✅ Cliente Supabase (browser, server, service role, middleware)
- ✅ Landing page mobile-first em dark mode (Hero, Features, Diferenciais, Pricing, Waitlist, Footer)
- ✅ Formulário de Waitlist com API protegida (rate limit + UTM + hash de IP para LGPD)
- ✅ Fluxo completo de autenticação: login, cadastro, esqueci senha, callback de email
- ✅ Middleware com proteção de rotas
- ✅ Dashboard placeholder com layout, badge de plano e logout
- ✅ Schema inicial do banco (waitlist, profiles, user_credits, credit_transactions, analyses)
- ✅ Triggers automáticos (provisionar profile + 3 créditos free ao cadastro, updated_at)
- ✅ Row-Level Security em todas as tabelas
- ✅ SEO base (metadata, OG, viewport, robots)
- ✅ Acessibilidade: áreas de clique ≥ 44×44px, focus rings, semantic HTML

---

## Pré-requisitos

- **Node.js 20+**
- **pnpm** ou **npm**
- **Conta Supabase** (free tier funciona) — https://supabase.com
- **(Opcional)** Supabase CLI para desenvolvimento local — https://supabase.com/docs/guides/cli

---

## Setup rápido (10 minutos)

### 1. Instalar dependências

```bash
cd novo-sistema-trading
npm install
# ou: pnpm install
```

### 2. Criar projeto no Supabase

1. Acesse https://supabase.com/dashboard → **New project**
2. Anote: `Project URL`, `anon public key`, `service_role key` (Settings → API)
3. Em **Authentication → URL Configuration**, adicione:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/callback`

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha pelo menos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Rodar a migration no Supabase

**Opção A — SQL Editor (mais rápido):**

1. Abra o SQL Editor do seu projeto Supabase
2. Cole o conteúdo de `supabase/migrations/20260520000001_initial_schema.sql`
3. Clique em **Run**

**Opção B — via CLI:**

```bash
npx supabase link --project-ref SEU-REF
npx supabase db push
```

### 5. Subir o app

```bash
npm run dev
```

Acesse http://localhost:3000

---

## Estrutura de pastas

```
novo-sistema-trading/
├─ app/
│  ├─ (auth)/                    # Rotas de autenticação (login, cadastro, etc.)
│  │  ├─ login/
│  │  ├─ register/
│  │  ├─ forgot-password/
│  │  ├─ callback/               # Endpoint que o Supabase chama após email
│  │  └─ layout.tsx
│  ├─ dashboard/                 # Área logada (placeholder Sprint 1)
│  │  ├─ layout.tsx              # Header + logout
│  │  ├─ page.tsx
│  │  └─ actions.ts              # Server Actions (signOut)
│  ├─ api/
│  │  └─ waitlist/route.ts       # POST endpoint da lista de espera
│  ├─ layout.tsx                 # Root layout + fontes + Toaster
│  ├─ page.tsx                   # Landing page
│  └─ globals.css                # Tema dark + tokens HSL
├─ components/
│  ├─ ui/                        # Botão, Input, Label, Card, Badge (shadcn-style)
│  ├─ landing/                   # Nav, Hero, Features, Differentials, Pricing, Waitlist, Footer
│  ├─ auth/                      # AuthCard, LoginForm, RegisterForm, ForgotForm
│  └─ shared/                    # (vazio, para componentes compartilhados futuros)
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts               # Cliente browser (Client Components)
│  │  ├─ server.ts               # Cliente server + service role
│  │  └─ middleware.ts           # Sync de sessão no middleware
│  └─ utils/cn.ts                # Helper de classes Tailwind
├─ types/
│  └─ database.ts                # Tipos do banco
├─ supabase/
│  ├─ config.toml                # Config local
│  └─ migrations/                # SQL migrations
├─ middleware.ts                 # Edge middleware Next.js
├─ tailwind.config.ts            # Paleta dark + animações
└─ ...
```

---

## Rotas implementadas

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | Public | Landing page (Hero + Features + Diferenciais + Pricing + Waitlist) |
| `/login` | Public | Entrar (redireciona logado → `/dashboard`) |
| `/register` | Public | Criar conta com validação de senha em tempo real |
| `/forgot-password` | Public | Solicitar email de redefinição |
| `/callback` | Public | OAuth/Email callback do Supabase |
| `/dashboard` | **Protected** | Painel principal (placeholder dos próximos sprints) |
| `/api/waitlist` | API | POST — cadastrar lead com rate limit |

---

## Decisões de design

### Tema dark fintech
Paleta inspirada no próprio Vortex (ciano + laranja sobre azul-quase-preto), mas mais sofisticada e consistente. Definida via CSS custom properties em `app/globals.css` (HSL para facilitar variações).

### Mobile-first
- Todos os toques têm área mínima 44×44px (padrão Apple/Google)
- `<input type="text|email|...>` com `text-base` para impedir zoom do iOS no foco
- Navegação com hamburger menu em telas pequenas
- Cards empilhados no mobile, grid no desktop
- Tabelas viram cards no mobile (ver `differentials.tsx`)

### Acessibilidade
- Focus rings visíveis em todos os elementos focáveis
- `aria-label`, `aria-invalid`, `aria-describedby` nos forms
- Semantic HTML (`<main>`, `<nav>`, `<header>`, `<footer>`)
- Contraste WCAG AA garantido nos textos primários

### Segurança
- Middleware refresca sessão a cada request
- Cliente service role **só** usado em Route Handlers (nunca exposto no browser)
- Row-Level Security em todas as tabelas
- Rate limit no `/api/waitlist` (5 req/min/IP)
- Hash de IP para LGPD (não armazenamos IP cru)
- Validação Zod em forms client + server
- HTTPS-only em produção (Vercel/Cloudflare)

---

## Deploy na Vercel

1. Push do repo no GitHub
2. Importar projeto na Vercel
3. Configurar variáveis de ambiente (mesmas do `.env.local`, exceto `NEXT_PUBLIC_SITE_URL` → URL de produção)
4. Em **Supabase → Authentication → URL Configuration**, adicionar a URL de produção
5. Deploy

---

## Próximos sprints (resumo)

| Sprint | Foco | Entregáveis |
|---|---|---|
| **2 (semanas 3-4)** | Motor de análise | 20 indicadores cripto via pandas-ta, gráfico ao vivo TradingView Lightweight, primeiro sinal |
| **3 (semanas 5-6)** | Histórico + Dashboard | 5 widgets (preço, F&G, notícias), histórico do usuário com filtros |
| **4 (semanas 7-8)** | XAI + Backtesting | Explicação dos sinais via LLM, backtesting com vectorbt, sentimento de notícias |
| **5 (semanas 9-10)** | Monetização + Alertas | Sistema de créditos, checkout HUBLA, Web Push + bot Telegram |
| **6 (semanas 11-12)** | Beta + Marketing | 50 usuários da waitlist, ajustes, primeira ronda de ads |

---

## Comandos úteis

```bash
npm run dev          # Servidor de desenvolvimento (porta 3000)
npm run build        # Build de produção
npm run start        # Servidor de produção (após build)
npm run lint         # Lint do código
npm run type-check   # Verificar tipos TypeScript

# Supabase local (opcional)
npm run supabase:start    # Sobe Postgres + Studio local
npm run supabase:stop     # Para os containers
npm run supabase:reset    # Reseta banco aplicando todas as migrations
npm run supabase:migrate  # Aplica migrations pendentes
```

---

## Suporte

- Documento completo de produto: `../Vortex_Trade_IA_Mapeamento_Completo.docx`
- Matriz de funcionalidades: `../Vortex_Trade_IA_Matriz_Funcionalidades.xlsx`
- Apresentação executiva: `../Vortex_Trade_IA_Apresentacao.pptx`

---

**Construído com a estratégia LEAN definida na seção 12.5 do documento de mapeamento.**
