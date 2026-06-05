# TradeAI v2

Reescrita **credibilidade-first** do TradeAI. Monorepo pnpm.

> Planta baixa e decisões: [`../docs/REESCRITA-BLUEPRINT.md`](../docs/REESCRITA-BLUEPRINT.md).
> O v1 (funcional) continua na raiz do repositório até o cutover (M6).

## Estrutura

```
v2/
├── packages/
│   ├── engine/   # motor de análise PURO (sem I/O), testável — coração do produto
│   └── shared/   # tipos compartilhados: timeframes, níveis de sinal, catálogo, planos
├── apps/
│   └── web/      # Next.js 15 (App Router)
└── supabase/
    └── migrations/  # schema consolidado
```

## Pré-requisitos

- Node ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm@9`)

## Comandos

```bash
pnpm install        # instala tudo
pnpm dev            # sobe o app web
pnpm type-check     # checagem de tipos em todos os pacotes
pnpm lint           # lint
pnpm test           # testes (vitest)
pnpm build          # build de todos os pacotes
pnpm ci             # pipeline completo (type-check + lint + test + build)
```

## Estado: M0 (scaffold)

Fundação sem regra de negócio. A lógica de trading entra no M1 (motor puro).
Ver marcos M0–M6 no blueprint.
