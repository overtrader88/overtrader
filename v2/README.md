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

## Troubleshooting

### `Cannot find module './XXXX.js'` / `routes-manifest.json ENOENT` / 500 em todas as rotas

Sintoma: o dev server passa a dar **500** com erros tipo `Cannot find module './7859.js'`,
`ENOENT: ... .next\server\app-paths-manifest.json`, ou `__webpack_modules__[moduleId] is not a function`.

**Não é bug do código** — é o diretório `.next` (cache de build) ficando inconsistente. As causas:

- Rodar `pnpm build`/`pnpm ci` **enquanto** o `pnpm dev` está de pé — o build apaga e reescreve
  o mesmo `.next` que o dev usa.
- Múltiplos `next dev` (ex.: processos órfãos) escrevendo no mesmo `.next` ao mesmo tempo.

**Recuperação (Windows / PowerShell):**

```powershell
# 1. pare TUDO que for next deste repo (dev e build, inclusive órfãos)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'tradeai' -and $_.CommandLine -match 'next' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 2. apague o cache de build
Remove-Item -Recurse -Force apps\web\.next

# 3. suba só UM dev server
pnpm dev
```

**Regra de ouro:** nunca rode `pnpm build`/`pnpm ci` com o `pnpm dev` ativo, e garanta um único
`next dev` por vez (eles disputam `apps/web/.next`).

## Estado: M0 (scaffold)

Fundação sem regra de negócio. A lógica de trading entra no M1 (motor puro).
Ver marcos M0–M6 no blueprint.
