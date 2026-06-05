# Blueprint da Reescrita — TradeAI v2

> Plano de reescrita do zero, decidido em 03/06/2026. Ainda **em fase de planejamento**
> — nenhum código novo escrito. Este documento é a planta baixa a ser aprovada antes
> de executar.
>
> Pré-requisitos de leitura: [`REVISAO-E-ESTRATEGIA.md`](./REVISAO-E-ESTRATEGIA.md)
> (o "porquê") + [`PROJECT.md`](./PROJECT.md) (o produto) + [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md).

---

## 0. Premissa honesta (ler antes de tudo)

O produto atual está **100% funcional** (Sprints 1–9). Reescrever do zero é, em
cronograma, a opção mais arriscada — joga fora código que funciona e adia o
lançamento. **Como você decidiu reescrever, o plano abaixo mitiga esse risco com 3 regras:**

1. **Reaproveitar o que já validei como correto** (indicadores Wilder, GBM, Box-Muller, layout de tipos) — *portar*, não rederivar.
2. **Reescrever de verdade só o que estava errado ou frágil** (probabilidades, backtest, calibração, parâmetros mágicos, UX linear, segurança).
3. **Manter o app atual no ar e funcionando** enquanto o v2 é construído em paralelo (mesmo repo, pasta separada), com *cutover* só quando o v2 passar nos critérios de aceite.

> Se em algum momento o custo da reescrita ficar maior que o ganho, este plano permite
> "parar e absorver" — cada peça do v2 é independente e pode ser portada de volta ao v1.

---

## 1. Princípios de design (não-negociáveis no v2)

1. **Credibilidade-first.** Todo número exibido carrega `n` (amostra), `IC` (intervalo de confiança) e `período`. Se a amostra é insuficiente, o produto **diz isso** em vez de mostrar um número bonito.
2. **Cálculo separado de calibração.** Zero parâmetro mágico espalhado pelo código. Tudo vem de um `config` versionado e documentado.
3. **Motor puro e testável.** O motor de análise é uma biblioteca pura (sem I/O, sem rede, sem DB). Entra `Candle[]`, sai `AnalysisResult`. Isso permite testes determinísticos e o "auditável" deixa de ser marketing.
4. **Probabilidade por simulação, não por fórmula frágil.** Reusar o Monte Carlo para estimar prob. de TP/SL — honesto e defensável.
5. **Honestidade > completude.** Melhor 10 camadas defensáveis que 15 com asteriscos.
6. **Segurança e observabilidade desde o dia 1**, não como "Bloco 4".

---

## 2. O que reaproveitar × reescrever × descartar

| Área | Decisão | Notas |
|------|---------|-------|
| Indicadores (RSI, MACD, ATR, ADX, Bollinger, OBV, CMF, Stoch, CCI, W%R, AO) | **Portar** | Validados como corretos. Só adicionar testes contra TradingView. |
| Monte Carlo (GBM + Box-Muller) | **Portar + expandir** | Discretização correta. Passa a também estimar prob. de toque de níveis. |
| Tipos (`AnalysisResult` etc.) | **Portar, limpando** | Bom desenho. Corrigir `enginVersion`→`engineVersion`, tornar campos obrigatórios. |
| Probabilidades (dual-scenarios) | **Reescrever** | Trocar fórmula fechada por estimativa Monte Carlo. |
| Backtest | **Reescrever** | ≥12 meses, train/test, walk-forward honesto, métricas com IC. |
| Pesos/gates/thresholds | **Reescrever** | Externalizar p/ `config` + processo de calibração. |
| SMC / Harmônicos / WEGD | **Reescrever com rótulos honestos** | Manter, mas marcar como "contexto qualitativo" e endurecer parâmetros (tolerância Fibonacci ±3–4%, BOS confirmado por fechamento). |
| Sazonalidade | **Reescrever** | IC + n mínimo + janela recente. |
| Camada de dados (Binance/TwelveData/Yahoo/cache) | **Portar + endurecer** | Lógica de fallback é boa. Adicionar retry/timeout/rate-limit genéricos. |
| Webhooks (HUBLA/Telegram) | **Reescrever** | HMAC bom; adicionar rate-limit, idempotência, audit, observabilidade. |
| Auth/planos/créditos (Supabase + RLS) | **Portar, com RPCs atômicos** | Modelo bom; consertar concorrência e jobs não-atômicos. |
| Frontend (componentes) | **Reescrever** | Nova arquitetura de apresentação (grid colapsável, gauges, charts, modo Simples×Avançado). |
| Migrations | **Reescrever do zero, consolidadas** | Eliminar a duplicata e o histórico de "fix de fix". Um schema limpo. |
| Pasta vazia `novo-sistema-trading/` | **Descartar** | Confunde. |

---

## 3. Stack-alvo + decisões

Recomendação: **manter o núcleo do stack** (já é moderno e correto) e mudar a
*organização*, não as ferramentas.

| Camada | v1 atual | v2 proposto | Por quê |
|--------|----------|-------------|---------|
| Framework | Next.js 15 + React 19 | **Manter** | Maduro, SSR, API routes, Vercel. Trocar seria custo sem ganho. |
| Linguagem | TypeScript | **Manter, strict** | `strict: true`, `noUncheckedIndexedAccess`. |
| Organização | App único | **Monorepo (pnpm workspaces)** | Isola o motor puro (`packages/engine`) do app web. Permite testar e versionar o motor sozinho. |
| Motor | `lib/analysis` | **`packages/engine` (puro, 0 deps de runtime)** | Auditável, testável, publicável. |
| DB/Auth | Supabase | **Manter** | RLS é um ativo. |
| Validação | Zod (parcial) | **Zod em 100% das bordas** | Input de API, webhooks, respostas de LLM, env vars. |
| Charts | lightweight-charts | **Manter + camada de overlays** | Já permite desenhar OB/FVG/PRZ no gráfico. |
| Visualização | — | **Adicionar Recharts** (gauges, equity curve, cone) | Gap visual vs Vortex. |
| Testes | nenhum | **Vitest + Playwright** | Unit no motor, e2e no fluxo crítico. |
| Rate limit | nenhum | **Tabela Supabase** (`rate_limits`) | Webhooks/admin. Sem serviço novo — usa o Postgres existente. |
| Observabilidade | console.* | **Sentry + log estruturado (pino)** | Falhas silenciosas hoje passam batido. |
| CI | nenhum | **GitHub Actions** (type-check, lint, test, build) | Pré-requisito de "auditável". |

**Decisão em aberto (seção 11):** o motor é pesado em CPU. Roda bem em função
serverless por enquanto, mas se o backtest de 12 meses ficar lento, talvez precise de
um *worker* dedicado ou pré-computação. Plano: começar serverless, medir, extrair se preciso.

---

## 4. Estrutura de pastas (monorepo)

```
tradeai/
├── packages/
│   ├── engine/                 # MOTOR PURO — sem I/O, sem rede, 100% testável
│   │   ├── src/
│   │   │   ├── indicators/      # portados + testados (1 arquivo por indicador)
│   │   │   ├── signal/          # votação, 7 níveis, força, confluência
│   │   │   ├── regime/          # classificação de regime
│   │   │   ├── risk/            # SL/TP por ATR + estrutura
│   │   │   ├── gates/           # filtros de qualidade (config-driven)
│   │   │   ├── montecarlo/      # GBM + estimador de prob. de toque
│   │   │   ├── backtest/        # walk-forward honesto + métricas com IC
│   │   │   ├── seasonality/     # com IC e n mínimo
│   │   │   ├── smc/ harmonics/ wegd/   # rótulo "qualitativo", params endurecidos
│   │   │   ├── stats/           # IC, binomial, normal CDF, bootstrap — núcleo da honestidade
│   │   │   ├── config.ts        # TODOS os parâmetros, versionados e documentados
│   │   │   └── types.ts
│   │   └── test/                # vitest: golden values vs TradingView
│   └── shared/                  # tipos compartilhados engine↔web (catálogo, timeframes, planos)
├── apps/
│   └── web/                     # Next.js
│       ├── app/                 # rotas (auth, dashboard, api, landing, legal)
│       ├── components/
│       │   ├── charts/          # RadialGauge, EquityCurve, DistributionCone, ProbabilityBar, ConfidenceBadge
│       │   ├── analysis/        # layout grid colapsável + modo Simples×Avançado
│       │   └── ui/              # primitivos
│       ├── lib/
│       │   ├── market/          # providers + cache + retry/timeout
│       │   ├── llm/             # cliente + prompt + validação Zod da saída
│       │   ├── news/            # providers + sentimento
│       │   ├── supabase/        # clients
│       │   ├── http/            # withRetry, withTimeout, rateLimit
│       │   └── obs/             # logger estruturado + Sentry
│       └── e2e/                 # Playwright
├── supabase/migrations/         # schema consolidado e limpo
└── docs/                        # esta pasta
```

---

## 5. Arquitetura do motor (`packages/engine`)

O coração da reescrita. Contrato:

```ts
runAnalysis(input: AnalysisInput, config?: EngineConfig): AnalysisResult
```

- **Puro:** recebe candles, devolve resultado. Nada de fetch/DB/LLM dentro.
- **`config` injetável:** todos os números (pesos por categoria, multiplicadores de regime, thresholds dos gates, múltiplos de SL/TP, tolerância de Fibonacci, n mínimo de sazonalidade) vivem em `EngineConfig` com default documentado. Permite calibrar sem reescrever.
- **Camada `stats/` nova:** funções de intervalo de confiança (Wilson p/ proporções, t-student p/ médias), teste binomial, bootstrap. **É o que torna "prova antes de prometer" verdade.** Toda métrica de backtest/sazonalidade/prob passa por aqui.
- **Probabilidades por Monte Carlo:** `probabilityOfTouch(level, side)` conta em quantas das N trajetórias simuladas o preço toca o nível — substitui a fórmula fechada frágil. Devolve estimativa **+ IC**.
- **Backtest honesto:** mínimo 12 meses, `train/test split`, walk-forward sem lookahead, e o `signal-quality-banner` só fica verde se `n ≥ limiar` E métricas robustas. Banner cinza quando amostra insuficiente.

Cada indicador e cada estatística ganha um **teste de valor-âncora** (golden value)
comparado a referência externa. Isso é o "auditável" deixando de ser slogan.

---

## 6. Modelo de dados (Supabase, consolidado)

Reescrever as 12 migrations num **schema único limpo** (mantendo o domínio):
`profiles`, `user_credits`, `analyses`, `credit_transactions`, `subscriptions`,
`watchlist`, `alerts`, `telegram_links`, `market_cache`, `audit_log` (novo),
`rate_limits` (novo, se não usar Redis).

Mudanças-chave:
- **RPCs atômicos** para `consume_credits`, processamento de alerta e ativação de plano (eliminam as race conditions de hoje).
- **`audit_log`** para toda operação admin/webhook (compliance + investigação de fraude).
- RLS revisado e testado tabela a tabela (era um "check" do Bloco 4 — vira requisito de schema).

---

## 7. Frontend (`apps/web`)

Reescrever a apresentação resolvendo os 2 problemas de UX (sobrecarga linear + falta
de visualização):

- **`AnalysisLayout`**: grid 2 colunas + seções colapsáveis. Sinal + filtros juntos no topo. `SignalCard` sticky/compact.
- **Modo Simples × Avançado** (toggle persistido): Simples = 1 sinal + 1 motivo + nível de confiança; Avançado = as camadas completas. Reduz o overload que afasta iniciantes.
- **`components/charts/`**: `RadialGauge` (RSI/Stoch/MFI), `EquityCurve` (backtest), `DistributionCone` (Monte Carlo), `ProbabilityBar`, e o **`ConfidenceBadge`** (mostra n + IC + período) usado em todo número — a materialização visual do diferencial.
- **Overlays no chart**: OB, FVG, PRZ de harmônicos e níveis SL/TP desenhados no lightweight-charts.
- **A11y + i18n desde o início**: navegação por teclado nas tabs, locale não-hardcoded (preparar terreno p/ versão EN — decisão #10 do PROJECT).

---

## 8. Segurança e observabilidade (dia 1, não "Bloco 4")

- `lib/http/`: `withRetry` (backoff em 429/5xx), `withTimeout`, `rateLimit` — aplicados a OpenAI, TwelveData, Binance, news, e webhooks.
- Webhooks: HMAC (portar) + **idempotência** (dedupe por event id) + **rate-limit** + **audit_log**.
- `admin/credit`: rate-limit por admin + audit + (decisão) MFA.
- Sentry + logger `pino` estruturado substituindo `console.*`. Alertas em falhas silenciosas (ex.: email não encontrado no webhook HUBLA).
- Validação Zod de env vars no boot (falha cedo se faltar var).

---

## 9. Estratégia de cutover (reescrever sem derrubar o produto)

```
v1 (atual) continua no ar  ───────────────────────────────►  cutover  ──►  v2 em prod
                                                                 ▲
apps/web (v2) construído em paralelo no mesmo repo ──────────────┘
packages/engine validado isoladamente com testes  ──────────────┘
```

1. **Engine primeiro, isolado.** Portar + testar `packages/engine` com golden values. Critério: bater com referência externa e ter os módulos de IC funcionando. *Nenhum risco ao v1.*
2. **App v2 em paralelo** consumindo o engine. Deploy em URL de preview (Vercel) — v1 segue em produção.
3. **Paridade funcional**: rodar os 50+ testes do Bloco 2 (PROJECT.md §10) contra o v2.
4. **Cutover atrás de critério de aceite** (seção 10). Trocar o domínio só quando passar.
5. **Rollback trivial**: v1 fica acessível por uma branch/tag até o v2 provar estabilidade em produção.

---

## 10. Plano de build por fases (marcos)

| Marco | Entrega | Critério de aceite |
|-------|---------|--------------------|
| **M0 — Scaffold** ✅ | Monorepo pnpm, CI (type-check/lint/test/build), `shared`, `engine` (esqueleto), `web` (Next 15), schema Supabase consolidado | ✅ `pnpm run ci` verde (11 testes). ⏳ `supabase db reset` pendente do CLI |
| **M1 — Engine puro** | Indicadores portados + `stats/` (IC) + signal/regime/risk/gates config-driven | Testes golden batem; 0 parâmetro mágico fora do `config` |
| **M2 — Camadas probabilísticas** ✅ | Monte Carlo (prob. por simulação first-passage) + backtest honesto + sazonalidade com IC + selo honesto | ✅ `pnpm run ci` verde (65 testes); toda métrica com IC; selo nunca verde com amostra pequena |
| **M3 — Camadas qualitativas** ✅ | SMC/harmônicos/WEGD com params endurecidos e rótulo honesto | ✅ Tolerância Fibonacci 0.04; PRZ inválida rejeitada; BOS por fechamento; rotulado qualitativo; 76 testes |
| **M4 — Dados + segurança** | Providers com retry/timeout/cache + webhooks idempotentes + rate-limit + Sentry + RPCs atômicos + **janela de backtest dirigida por amostra** (ver decisão abaixo) | Webhook replay não duplica; rate-limit ativo; audit_log gravando; ≥80% dos pares ativo×TF atingem amostra suficiente |
| **M5 — Frontend** | Layout grid colapsável + modo Simples×Avançado + charts/gauges + overlays + ConfidenceBadge | Lighthouse a11y ≥90; mobile ok; ConfidenceBadge em todo número |
| **M6 — Paridade + cutover** | 50+ testes funcionais, LGPD, Telegram, planos | Paridade com v1 + critérios de credibilidade; aprovação manual → cutover |

---

## 11. Decisões — RESOLVIDAS (03/06/2026)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Organização | ✅ **Monorepo pnpm** (`packages/engine` + `apps/web`) |
| 2 | Lib de gráficos | ✅ **Recharts** (default recomendado — simples e suficiente) |
| 3 | Rate limiting | ✅ **Tabela Supabase** (`rate_limits`) — sem serviço novo |
| 4 | Motor | ✅ **Serverless incremental** — medir e extrair worker só se o backtest de 12m ficar lento |
| 5 | MFA no admin | ✅ **Entra no v2** (escopo inicial) |
| 6 | Simples×Avançado + i18n (EN) | ✅ **Ambos entram no v2** (escopo inicial) |

**Impacto no escopo:** M5 (frontend) inclui o toggle Simples×Avançado e a base i18n
desde o início; M4 (segurança) inclui MFA no admin além do rate-limit por tabela.

---

## 12. M0 — Scaffold (plano detalhado, próximo a executar)

Objetivo: repositório novo, vazio de lógica, mas com **CI verde, schema limpo aplicando,
e o esqueleto do monorepo pronto para receber o motor (M1)**. Nenhuma regra de negócio aqui.

| Tarefa | Detalhe | Pronto quando |
|--------|---------|---------------|
| M0.1 — Workspace pnpm | `pnpm-workspace.yaml` com `packages/*` e `apps/*`; raiz com tsconfig base `strict` + `noUncheckedIndexedAccess` | `pnpm install` funciona; tsconfig herda nos dois pacotes |
| M0.2 — `packages/engine` vazio | `package.json` (sem deps de runtime), `src/index.ts`, `src/types.ts` (tipos portados e limpos: `engineVersion` corrigido), `src/config.ts` (estrutura do `EngineConfig`, ainda sem números) | `pnpm --filter engine build` e `test` rodam (com 1 teste smoke) |
| M0.3 — `packages/shared` | catálogo de ativos, timeframes (`const` + Zod enum), níveis de sinal, config de planos — centralizados (hoje estão hardcoded em 3+ lugares) | importável por engine e web |
| M0.4 — `apps/web` (Next 15) | scaffold limpo: App Router, Tailwind, shadcn-style primitives, `lib/obs/logger` (pino) e Sentry stub, `lib/http/{withRetry,withTimeout,rateLimit}` (assinaturas + testes) | `pnpm --filter web dev` sobe a home placeholder |
| M0.5 — Schema Supabase consolidado | 1 migration limpa com todas as tabelas (incluindo `audit_log` e `rate_limits`), RLS por tabela, RPCs atômicos como stubs | `supabase db reset` aplica sem erro; RLS ativa em todas |
| M0.6 — Validação de env | Zod schema das env vars, falha no boot se faltar | build falha cedo com mensagem clara se var ausente |
| M0.7 — CI (GitHub Actions) | pipeline: install → type-check → lint → test → build (engine e web) | CI verde no primeiro PR |
| M0.8 — Higiene | remover pasta vazia `novo-sistema-trading/`; resolver migration duplicada do v1 (não portar) | repo sem lixo; sem duplicata de timestamp |

> M0 não toca em nenhuma regra de trading — é só a fundação. Isso garante que, quando
> o M1 (motor) começar, todo código nasça testado e com CI, que é o pré-requisito do
> "auditável".

### Estado do M0 — ✅ CONCLUÍDO (03/06/2026)

Scaffold construído em **`v2/`** (isolado do v1, que segue intocado na raiz até o cutover).
`pnpm run ci` passa verde: **type-check + lint + test (11) + build** nos 3 pacotes.

Entregue:
- `v2/` monorepo pnpm (workspace + tsconfig base strict + `.npmrc` + `.gitignore`)
- `packages/shared`: timeframes, níveis de sinal, mercado, planos, catálogo (semente — full no M4)
- `packages/engine`: tipos limpos (`engineVersion` corrigido), `EngineConfig` (params herdados, marcados NÃO CALIBRADOS), tipo `Estimate` (valor+IC+n), smoke tests
- `apps/web`: Next 15 + Tailwind, `lib/obs/{logger,sentry}`, `lib/http/{with-timeout,with-retry,rate-limit}` com testes, `lib/env.ts` (Zod, lazy), home placeholder
- `supabase/migrations/0001_init.sql`: schema consolidado, RLS em tudo, `audit_log` + `rate_limits`, RPCs atômicos
- CI GitHub Actions (`v2/.github/workflows/ci.yml` — move para a raiz no cutover)

Pendências conhecidas (não bloqueiam M0):
- `supabase db reset` a rodar quando o **Supabase CLI** for instalado (não disponível no ambiente).
- **eslint-config-next** adiado para o M5 (quando houver componentes reais).
- Catálogo completo dos 143 ativos a portar no **M4**.

### Estado do M1 — ✅ CONCLUÍDO (03/06/2026)

Motor puro em `packages/engine`: `stats/` (Wilson/t-Student/bootstrap + `Estimate`),
primitivos (`math/series`), 20 indicadores puros, signal/regime/risk/gates
config-driven e `runAnalysis` determinístico. **30 testes** (analíticos + invariantes;
cross-check TradingView documentado como passo manual). `pnpm run ci` verde.

### Estado do M2 — ✅ CONCLUÍDO (03/06/2026)

Camadas probabilísticas honestas, como **funções puras** compostas pela borda:
- `math/random` (PRNG mulberry32 + Box-Muller) e `math/calendar` (`periodsPerYear` por
  ativo/timeframe — corrige o `stepsPerYear` fixo).
- `montecarlo` (GBM determinístico; winRate com IC Wilson; **probabilidade de toque por
  first-passage simulado**).
- `scenarios` (compra/venda; prob. de TP/SL com IC + **R esperado**; sem reflection
  principle nem score mágico).
- `seasonality` (retorno médio com t-CI, winRate Wilson, flag `sufficient`, janela `recentYears`).
- `backtest` (walk-forward sem lookahead, 3 estratégias, janela por timeframe, métricas
  com IC, cobertura sem cap silencioso).
- `quality` (selo verde só com **limite inferior do IC** acima do limiar + amostra suficiente).

Todos os parâmetros novos centralizados no `EngineConfig` (`[NÃO CALIBRADO]`).
**65 testes** no total; `pnpm run ci` verde.

### Decisão — Janela de backtest (do brainstorm de 03/06/2026, vale no M4)

"12 vs 24 vs 36 meses" é a pergunta errada: **mês é a unidade errada**; o que dá força
é **nº de trades decisivos** + **cobertura de regimes**. Resolução adotada:

1. **Janela dirigida por amostra (quick win):** alvo = mínimo de trades decisivos
   (ex.: ~100), expandindo a janela para trás até atingir, **limitada** por um teto de
   calendário — **24m default / 36m para ativos estacionários** (forex/ações/índices vs
   cripto). "Meses" vira teto, não regra. Selo cinza quando não alcança.
2. **Backtest segmentado por regime** (reusa `computeMarketRegime`): PF/win-rate por
   regime, cada um com IC — mostra *em que mercado* funciona.
3. **Out-of-sample obrigatório** (train/test split): selo verde exige robustez no teste,
   não no histórico inteiro — defesa nº 1 contra overfitting.
4. **Habilitador técnico:** indicadores incrementais (mata o O(n²)) e/ou pré-computação
   server-side por job, pra janela longa não pesar no request.
5. **Futuro (Sprint 11+):** detecção de quebra estrutural + block bootstrap (IC honesto
   p/ trades autocorrelacionados).

Experimentos de validação registrados no brainstorm.

**✅ Implementado (03/06/2026) — parte de motor do M4:** o `backtest` v2 já entrega os 3
pilares: (1) **janela dirigida por amostra** — teto por classe de ativo (`targetMonths`
24m cripto/commodities, `targetMonthsStationary` 36m forex/ações/índices) e
`sampleSufficient` por `decisiveTrades ≥ minDecisiveTrades` (default 100); (2)
**segmentação por regime** (`byRegime`, cada regime com winRate/PF/avgR + IC, via
`meta.regime`); (3) **out-of-sample** (`outOfSample`, split cronológico `oosFraction`
0.3) e o **selo fica amarelo se o OOS colapsa** (anti-overfitting). 79 testes, CI verde.
**Harness de calibração** (`calibration/` + `pnpm --filter @tradeai/engine calibrate`):
roda o backtest em lote e reporta os experimentos do brainstorm (% amostra suficiente,
% OOS dentro do IC, regimes cobertos). Hoje sobre candles sintéticos (sem edge); pronto
para receber dados reais no M4.

Falta do M4 (depende de credencial/infra): providers de dados, fetch de histórico longo,
rate-limit Supabase, RPCs, catálogo completo, multi-TF na borda.

**Itens de motor — ✅ TODOS CONCLUÍDOS (03/06/2026):**
- ✅ **Indicadores incrementais** — `backtest/precompute.ts`: séries exatas (EMA/RSI/ATR/ADX/MACD/TRIX
  incrementais) + `runAnalysisAt(i)`. **Teste de paridade** (`test/parity.test.ts`) confirma
  valores IDÊNTICOS a `runAnalysis(slice)` em todos os índices, 3 seeds (~1.500 comparações).
  Backtest passou a usar o caminho rápido → O(n²) eliminado (testes 4× mais rápidos).
- ✅ **Multi-timeframe combiner** (`multi-timeframe/`): `combineTimeframes` puro (score +
  alinhamento, config-driven) + `getHigherTimeframes` + `toTimeframeAnalysis`. O fetch dos
  TFs adjacentes fica na borda (M4).

**Motor v2 COMPLETO.** 85 testes, `pnpm run ci` verde.

### M4-infra — código puro entregue (03/06/2026)

Camada de borda em `apps/web/lib`, **sem credencial** (testável sem rede):
- `market/symbols.ts` — mapeamento de símbolos/intervalos por provedor (Binance/TwelveData/Yahoo).
- `market/parse.ts` — parsers PUROS payload→`Candle[]` (klines Binance, time_series TwelveData, chart Yahoo), normalizados ascendentes.
- `market/providers.ts` — `getCandles` com cache + **cadeia de fallback** (crypto→Binance→Yahoo; demais→TwelveData→Yahoo); fetchers **injetáveis** (testados com fakes) + `realProviders()` com retry/timeout.
- `market/cache.ts` — `CacheStore` + `InMemoryCacheStore` (testado); `SupabaseCacheStore` é plug-point.
- `validation/schemas.ts` — Zod p/ analyze/watchlist + payloads HUBLA/Telegram + `parseTelegramCommand`.

**110 testes** no total (84 engine + 26 web). Plug-points de credencial bem marcados.

### Calibração com DADOS REAIS — primeiro resultado honesto (03/06/2026)

Credenciais ligadas (Supabase + TwelveData). Implementada **paginação Binance**
(`market/history.ts`, testada) p/ puxar histórico longo, e dois scripts:
`calibrate:real` e `calibrate:sweep` (em `apps/web/scripts`). Backtest de 17.000 candles
roda em **<1s** (indicadores incrementais provados).

**Achado (params NÃO calibrados, amostra adequada, SEM custos):**
- BTC 1h (1.882 trades): PF in-sample 1.21 / OOS ~1.3. ETH 4h: PF 1.33. → **edge modesto e real no cripto.**
- EURUSD 1h: PF 0.86 (perdendo). AAPL 1d: ~0.99. → não-cripto não mostra edge com a config atual.
- O **PF 3.82 do v1 NÃO se reproduz** — confirma cherry-pick/sob-amostra.
- **Sweep** (19 configs × 3 casos, ranqueado por OOS PF): melhor `conf7/adx20/RRtight`
  OOS PF ~1.64, mas só 2/3 casos com amostra (confluência 7 derruba o EURUSD → cuidado:
  parte da "melhora" é seleção de casos fáceis). DEFAULT OOS PF ~1.31 com 3/3 casos.

**✅ Custos modelados (bps/lado por classe → R) e re-calibração (03/06/2026) — VEREDITO:**
Líquido de custos realistas, o quadro vira sóbrio:
- BTC 1h: PF 1.21 → **0.87 (PERDE)** — o "edge" de 1h era 100% comido por custos (1.883 trades).
- ETH 4h: 1.33 → **1.19** (sobrevive — único claramente positivo).
- BTC 1d 0.97 · EURUSD 1h 0.64 · AAPL 1d 0.96 — todos ≤ 1.
- Sweep (19 configs, líquido, cobertura total dos 3 casos): **NENHUMA config é positiva em
  todos os casos.** Melhor com cobertura total = DEFAULT, OOS PF 1.025 (2/3 positivos).

**Conclusão (baseline):** a votação dos 20 indicadores **NÃO tem edge líquido robusto**;
survivors são 4h+ e marginais.

### Melhoria de edge — estratégia CONDICIONAL por regime (brainstorm #3)

`signal/conditional.ts` (config `signal.conditionalByRegime`): trend-following em trending,
mean-reversion/fade em ranging, NEUTRO em transitional/explosive. Medido em 6 cripto 4h,
líquido de custos, OOS (`pnpm --filter @tradeai/web calibrate:conditional`):

| Variante | OOS PF | OOS WR | positivos |
|----------|--------|--------|-----------|
| **COND (RR padrão)** | **1.18** | **42.9%** | 4/6 |
| BASELINE (votação) | 0.97 | 38.8% | 3/6 |
| COND + RR apertado | 0.96 | 38.7% | 2/6 |

**Melhora REAL mas não universal:** condicional subiu OOS PF 0.97 → **1.18** e WR
38.8% → 42.9% (melhor edge medido até agora), positivo em 4/6 — mas 2 ativos ainda perdem.
Aprendizado: RR apertado PIORA o trend-following (precisa de espaço pra deixar correr).
Não é vitória — é a melhor direção até agora. **Próximo (não-fooling):** walk-forward
rolante (não só 1 split), filtro multi-TF como gate (#4), investigar os 2 perdedores, testar 1d.
121 testes, type-check/lint/test verdes.

**Confluência de filtros (brainstorm #4 — macro EMA200, volume/OBV, concordância mínima):**
testada via `calibrate:confluence`. Resultado HONESTO: **não melhorou.** O condicional puro
(PF 1.177) seguiu melhor; macro/vol/minAgree reduziram um pouco (1.10–1.15) e nenhum elevou
de 4/6 para 5-6/6. Lição quant clássica: empilhar confirmações corta bons trades junto com
os ruins → diminishing returns/overfit. **Simplicidade venceu.**

**Estado do edge:** teto realista ~**PF 1.18 OOS líquido** no cripto 4h (4/6 positivo). Ganhos
maiores provavelmente exigem método diferente (momentum cross-sectional, meta-labeling/ML) —
maior esforço e risco de overfit, retorno incerto. **Antes de confiar até no 1.18: validar
com walk-forward rolante.**

**Decisão de produto ainda em aberto:** o edge per-asset é modesto.

### Método NOVO — momentum cross-sectional (brainstorm #10, 04/06/2026)

`cross-sectional/index.ts`: ranqueia uma cesta de criptos por momentum (lookback/skip), long topK /
short bottomK, rebalanceia, líquido de custos, OOS + Sharpe. Primeira passada (8 criptos, split único,
SEM funding de short): 4h fraco (Sharpe 0.17); **1d long-short lb30/rb7/top2 → OOS Sharpe 0.83, +54%** —
parecia a melhor pista (assinatura diferente do timing per-asset).

**Validação honesta (`calibrate:cs`, EDGE.6 — cesta DINÂMICA de 25 criptos + funding de short 10% a.a. +
WALK-FORWARD ancorado de 4 folds):** o 0.83 **NÃO sobrevive.** Era viés de seleção (split único) + custo de
short não modelado.
- **Sweep (split único, agora com funding):** topo vira tudo **long-only**, Sharpe 0.07–0.32 e **retorno OOS
  NEGATIVO** (−4.6% a −38.7%) no terço recente. O long-short some do topo — shortar cripto forte em bull +
  funding sangra.
- **Walk-forward (escolhe config no treino, mede no teste, 324 períodos):** escolhe **long-only nos 4 folds**.
  Resultado: **Sharpe 0.66, +289.9%, winRate 51.5%, maxDD 88.4%.** O +290% concentra-se nos bull runs e o
  drawdown de **88%** denuncia: isso é **beta de cripto alavancado, não alpha**. O único candidato a alpha
  market-neutral (long-short) é rejeitado pela seleção por Sharpe de treino.

**Veredito do cross-sectional:** não há edge market-neutral robusto no timing de cripto. O que "funciona"
é momentum long-only = exposição direcional (comprar a cesta vencedora) com drawdown de 88% — não é produto
de "edge", é beta vestido de estratégia.

**CONCLUSÃO ESTRATÉGICA (consolidada após per-asset + condicional + confluência + cross-sectional):**
líquido de custos e validado fora da amostra, **não existe alpha estatístico robusto no timing de cripto** —
nem per-asset (teto PF ~1.18 OOS 4h, modesto e não-universal) nem cross-sectional (long-short colapsa;
long-only = beta com 88% DD). O pitch honesto ("prova antes de prometer") **proíbe** posicionar como "máquina
de lucro" ou "portfólio market-neutral". **Posicionamento defensável = ferramenta de ANÁLISE/transparência
instrument-grade** (todo número com n + IC + período, regime explícito, custos embutidos, backtest sem
lookahead), opcionalmente com um módulo de swing 4h+ honesto (PF~1.18, comunicado como modesto). Decisão de
produto agora informada por dados, não por esperança. 128 testes verdes (99 engine + 29 web).

**Resta do M4 (depende de credencial/infra):** modelar custos no backtest e re-calibrar;
`SupabaseCacheStore` + `SupabaseRateLimiter` + wrappers de RPC com o service client;
clients Supabase; catálogo completo dos 143 ativos; orquestração multi-TF na borda
(combinador pronto); API routes finas plugando engine + validação + providers.

### M5 — Frontend ligado ao motor (Estágio A · API de compute) — 04/06/2026

Sessão paralela ("Frontend design system", `/anthropic-skills:frontend-design`) entregou o
**design system instrument-grade** completo (globals.css 703 linhas; componentes Logo/AppBar/
Panel/Chip/SignalBadge/QualityDot/ConfidenceBadge/RadialGauge/EquityCurve; páginas landing/
login/dashboard/análise/histórico/planos) — resolve a rejeição "amador" ([[design-direction-feedback]]).
Estava **100% estático**. Continuação aqui ligou a vitrine ao motor real (**Estágio A**, sem auth):
- **`lib/supabase/server.ts`** (service-role, server-only, env direto — fallback null) + **`SupabaseCacheStore`**
  (tabela `market_cache`) com `getMarketCache()` (Supabase se houver env, senão in-memory). `@supabase/supabase-js` instalado.
- **`lib/analysis/full.ts`** — DTO serializável `FullAnalysis` compondo runAnalysis + Monte Carlo + cenários +
  backtest + selo + equity curve (R acumulado). Puro/determinístico (6 testes). `lib/analysis/service.ts` (`analyzeSymbol`).
- **`POST /api/analyze`** (Zod → getCandles[providers+cache] → composição → DTO; `generatedAt` na borda) e
  **`GET /api/quotes`** (preço+variação multi-mercado p/ tickers) + **`lib/market/catalog.ts`**.
- **Tela de Análise** religada (RSC + `AnalyzeForm` client que empurra `?symbol&type&tf`): verdito/gauge/níveis/
  selo/backtest+IC/momentum/Monte Carlo/cenários renderizando **números reais com n+IC+período**. **Dashboard** com
  `TickerRail` (client, refresh 60s) em dados reais.
- **Verificação ponta-a-ponta (dev :3001):** `/api/analyze` BTCUSDT 4h → STRONG_SELL, regime trending, **selo grey
  "amostra insuficiente (98 trades; mín. 100)"** — a tese funcionando (recusa selo em amostra fina). `/api/quotes` →
  6 tickers reais (cripto Binance; forex/ouro/índice via fallback Yahoo). type-check/lint/test verdes; **134 testes** (99 engine + 35 web).

### M5 — Estágio B (auth + persistência + histórico) — 04/06/2026

Método de login escolhido: **email + senha** (config padrão do Supabase) + botão Google (OAuth, funciona quando o
provider for habilitado no painel). `@supabase/ssr` instalado.
- **Clients:** `lib/supabase/browser.ts` (anon, client) + `lib/supabase/server-ssr.ts` (anon + cookies, respeita RLS) +
  `lib/supabase/auth.ts` (`getCurrentUser` = user+profile+créditos, `planLabel`, `initialsOf`). Convivem com o service-role do Estágio A.
- **`middleware.ts`:** refresh de sessão + proteção — `/analise` PÚBLICA (try-before-signup); `/dashboard`, `/historico`,
  `/alertas` exigem login (redirect `/login?next=`); sem env Supabase, não bloqueia (dev/CI).
- **Login:** `components/login-form.tsx` (entrar + cadastrar + Google) + `app/auth/callback/route.ts` (troca code→sessão PKCE).
  `components/user-menu.tsx` (avatar + logout). AppBar parametrizado (créditos/plano/email reais ou link "Entrar").
- **Persistência + histórico:** `lib/history.ts` — `recordAnalysisView` (best-effort, **deduplicado** 10 min, sem cobrança),
  `listAnalyses`/`recentAnalyses` (RLS; select rico via JSON path c/ fallback scalar). A tela de Análise persiste ao
  visualizar (logado); **`GET /api/history`** (RLS) + página de **Histórico** reconstruída (busca + paginação reais) +
  "análises recentes" do **dashboard** ligadas. `lib/analysis/display.ts` (mapeadores puros, 6 testes).
- **Decisão de billing (honesta):** viewing é grátis e não cobra crédito (evita cobrar em refresh/prefetch). O saldo é
  exibido real; o consumo via `consume_credits` fica como gancho deliberado p/ uma ação premium futura, não no GET.
- **Verificado (dev :3007):** `/login` 200 (form), `/dashboard` 307→`/login?next=`, `/api/history` anônimo `{items:[],total:0}`.
  type-check/lint verdes; **140 testes** (99 engine + 41 web). Fluxo autenticado completo (login real → sessão → histórico
  populado) precisa de verificação no navegador com uma conta — passo do usuário.

### M5c — Histórico profundo (selo decisivo) — 04/06/2026

Provider Binance passou a **paginar** quando `limit > 1000` (reusa `fetchBinanceHistory`); Yahoo usa `range=10y` em
TFs altos; `CANDLE_LIMIT` 1000→**3000** no service (o motor ainda recorta pela janela 24-36m internamente).
**Efeito medido (dev):** BTCUSDT 4h passou de 98 → **313 trades decisivos** → amostra **suficiente** → selo **VERMELHO**
("Fraco: PF 0.99 · WR 41%"). Isso é a tese funcionando: com amostra decisiva o selo emite **veredito honesto** — e o
veredito do timing per-asset 4h é "fraco" (consistente com EDGE.1–6). **M5c.2:** TFs de baixa frequência (1d/1w/1M)
ganharam janela maior (`backtest.targetMonthsLowFreq = 72m`; intraday segue 24/36m da classe). Efeito: BTCUSDT 1d
passou de 80 (cinza) → **257 trades decisivos → selo AMARELO** ("in-sample positivo, OOS enfraquece") — veredito
honesto destravado no daily. Sem regressão nos TFs altos (teste de teto de calendário reescrito p/ a nova política).
type-check/lint/test verdes (140 testes).

### M5d — Watchlist real + M6 — Checklist de cutover — 04/06/2026

- **M5d.1 (watchlist):** `GET/POST/DELETE /api/watchlist` (RLS via SSR client; upsert por `unique(user,symbol,tf)`).
  `components/watchlist-button.tsx` (★ Acompanhar, na statusbar da Análise; 401 → "Entrar p/ acompanhar") +
  `components/watchlist-panel.tsx` (dashboard: lista/remove reais + link analisar). Verificado: GET anônimo
  `{items:[]}`, POST anônimo 401. (Alertas/cron sobre a watchlist = lacuna conhecida, RPC `process_watchlist_alert` pronto.)
- **M6.1 (cutover):** `docs/M6-CUTOVER.md` — checklist honesto de produção: env (🔴), Supabase/migration/Auth,
  segurança (RLS/segredos/**rate-limit a plugar nas rotas**), build/deploy (transpilePackages, Node runtime),
  critérios de aceite vs v1, passos de cutover + rollback, e lacunas (alertas/cron, consumo de crédito, catálogo 143,
  narrativa IA, webhooks HUBLA/Telegram, geo da Binance). Bloqueadores reais p/ tráfego público: rate-limit nas rotas
  + build/deploy no host + config de Auth no Supabase.

### M7 — Lacunas pós-cutover (catálogo, narrativa IA, alertas/cron) — 04/06/2026

- **SMC no DTO:** `FullAnalysis` agora compõe `analyzeSmc(candles, atr14)` → campo `smc?: SmcResult`
  (qualitativo, `kind:"qualitative"` + disclaimer; não é probabilidade). `full.test` cobre.
- **M7.1 catálogo:** `lib/market/catalog.ts` 16 → **84 ativos** fetcháveis (34 cripto Binance, 12 forex incl. BRL,
  5 commodities + 6 índices mapeados no Yahoo, 26 ações US) + `catalogByClass()` + `ASSET_CLASS_PT`. Alimenta seletor + quotes.
- **M7.2 narrativa IA:** `lib/analysis/narrative-facts.ts` (`toNarrativeFacts`, só números medidos) + **`POST /api/narrative`**
  (recomputa no servidor, não confia no cliente; OpenAI `gpt-4o-mini` via fetch + `withTimeout`; **prompt honesto** que
  explica o selo, cita n+IC, proíbe promessa de lucro; **503** sem `OPENAI_API_KEY`) + `components/ai-narrative.tsx`
  (sob demanda, com disclaimer "análise, não recomendação"). Painel "Leitura do analista · IA" na Análise.
- **M7.3 alertas/cron:** **`/api/cron/check-watchlist`** (auth `CRON_SECRET`; service-role itera a watchlist de todos,
  reanalisa `simple`, dispara via RPC `process_watchlist_alert` quando o sinal de compra ≥ limiar — RPC deduplica +
  marca `last_checked_at`) + **`GET/PATCH /api/alerts`** (RLS) + página **`/alertas`** (lista + marca lido no mount) +
  **badge** de não-lidos no nav (`AlertsNavBadge`, self-fetch) + href do nav corrigido p/ `/alertas`.
- **Verificação:** type-check/lint/**140 testes** verdes; `/alertas` anônimo → 307 (protegido). Smoke das 2 rotas novas
  (cron/alerts) ficou bloqueado pelo **EPERM `.next/trace`** (lock de múltiplos `next dev` — ambiental, recorrente; não
  é defeito de código). As rotas espelham padrões já validados (history/watchlist).

**140 testes** no total (99 engine + 41 web). **Lacunas restantes:** rate-limit nas rotas (tarefa separada),
scheduler real do cron (Vercel Cron / skill schedule), pagamentos HUBLA, narrativa só quando OPENAI_API_KEY presente.

---

## 13. M1 — Motor puro (plano detalhado)

**Objetivo:** entregar `runAnalysis(input, config) → AnalysisResult` como uma
biblioteca **pura** (sem I/O, sem rede, sem DB, sem `Date.now()` interno),
**testada contra referência externa** e **100% dirigida pelo `EngineConfig`**
(zero parâmetro mágico solto no código). É o coração do "auditável".

Tudo acontece em `packages/engine`. Verificável com `pnpm --filter @tradeai/engine test`
— **não precisa do servidor web, nem `.env`, nem Supabase**.

### Decisões de design do M1

1. **Indicador ≠ voto.** No v1, o cálculo e a regra de voto (ex.: `RSI > 60 → BUY`)
   viviam juntos em `engine.ts`. No v2: `indicators/` só **calcula valores puros**;
   `signal/votes.ts` converte valor → voto usando **thresholds do `config`**. Isso tira
   os números mágicos (60/40, ±100, etc.) do código.
2. **Pureza determinística.** `generatedAt` é injetado pela borda (API route), nunca
   `Date.now()` dentro do motor — senão os testes golden não são reprodutíveis.
3. **Sem O(n²).** O ATR-médio do regime (que no v1 refatiava o array a cada candle)
   vira **ATR rolling incremental**.
4. **Bug do v1 corrigido de saída:** a explicação dizia "X/6 gates" com 8 gates → passa
   a usar `gates.length`.
5. **Calibração NÃO é M1.** Mudar os valores do `config` com base em evidência exige
   backtest (M2). No M1 os valores ficam herdados e marcados `[NÃO CALIBRADO]`; o que
   entregamos é **correção + estrutura + testes**, não os números finais.

### Tarefas

| Tarefa | Detalhe | Pronto quando |
|--------|---------|---------------|
| **M1.1 — `stats/`** (fundação da credibilidade) | IC de proporção (Wilson), IC de média (t-Student), teste binomial/p-valor, bootstrap, normal CDF/PDF, percentil, média/desvio. Produz o tipo `Estimate`. | Testes batem com valores conhecidos (ex.: Wilson de 8/10 ≈ [0,49; 0,94]); `Estimate` gerado por helper |
| **M1.2 — primitivos numéricos** | SMA, EMA (seed Wilder), desvio rolling, True Range, rolling windows — base reusada pelos indicadores. | Testes unitários verdes |
| **M1.3 — indicadores puros** (`indicators/`) | Portar os 20: RSI, MACD, EMA 20/50/200, SMA 50, VWMA, Stoch, CCI, Williams %R, Awesome, MFI, ROC, ADX/±DI, Supertrend, TRIX, Bollinger, ATR, OBV, CMF. **Só valores** (sem voto). | Cada indicador compila e roda sobre a fixture |
| **M1.4 — fixtures golden** | Dataset fixo de candles (fatia real conhecida) + valores esperados extraídos do TradingView, em JSON versionado. | Fixture commitada; testes a referenciam |
| **M1.5 — testes golden** | Comparar RSI, MACD, ATR, ADX, Bollinger (no mínimo) com a referência, tolerância pequena. | Diferença < tolerância p/ os indicadores-âncora |
| **M1.6 — votação → sinal** (`signal/`) | valor→voto por thresholds do config; agregação ponderada por categoria + multiplicadores de regime (config); `ratio→7 níveis`; força; confluência. | Testes de fronteira do `ratioToSignal` + determinismo da ponderação |
| **M1.7 — regime** (`regime/`) | Classificação trending/ranging/transitional/explosive via ADX + ATR-ratio (config), **ATR rolling** (sem O(n²)). | Testes dos 4 regimes; sem refatiamento por candle |
| **M1.8 — risco** (`risk/`) | Entry/SL/TP1-3 por múltiplos de ATR (config) + `rr1`. | Testes p/ buy, sell e neutral |
| **M1.9 — gates** (`gates/`) | 8 gates dirigidos pelo config; contagem consistente (corrige o "/6"). Cada gate marcado se está calibrado ou não. | Testes por gate; `passed/total` coerente |
| **M1.10 — `runAnalysis`** (pipeline) | Compõe tudo + lógica de downgrade quando gates críticos falham. Puro; `generatedAt` injetado. | Teste e2e sobre a fixture devolve `AnalysisResult` completo e **determinístico** |

### Estratégia de testes
- **Golden** (M1.4/M1.5): a prova de "auditável" — números batem com fonte externa.
- **Propriedade/fronteira**: thresholds (ratio→sinal), monotonicidade (mais votos BUY → ratio maior), determinismo (mesma entrada → mesma saída).
- **Cobertura mínima** dos módulos centrais antes de fechar o M1.

### Explicitamente FORA do M1 (vai para o M2)
Monte Carlo + **probabilidade de TP por simulação**, **backtest honesto ≥12 meses**
(train/test, walk-forward), **sazonalidade com IC**, e o **selo de confiança** na UI.
As camadas qualitativas (SMC, harmônicos, WEGD) ficam no **M3** com parâmetros endurecidos.

---

*Decisões da seção 11 resolvidas. M0 concluído e verificado. M1 detalhado acima.
Próximo passo: aprovar/iniciar o M1 — começando por `stats/` (M1.1) e os primitivos
(M1.2), que são pura matemática testável e destravam todo o resto.*

---

## 14. M3 — Camadas qualitativas (plano detalhado)

**Objetivo:** portar SMC, Harmônicos e WEGD do v1 para `packages/engine`, **endurecendo
os parâmetros mágicos** (todos no `EngineConfig`) e **rotulando honestamente** como
*contexto qualitativo* — não probabilidade dura. Puro, determinístico, testável.

**Princípio do M3:** estas camadas são interpretativas/discricionárias por natureza
(SMC, ondas de Elliott, Gann). O fosso não é fingir precisão — é ser explícito de que
são heurísticas, com os parâmetros abertos no config. "Strength 50" e "quality 92" são
escores de match/heurística, **não** probabilidades; a UI e o resumo deixam isso claro.

| Tarefa | Arquivo(s) | Conteúdo | Hardening vs v1 |
|--------|-----------|----------|-----------------|
| **M3.1** | `math/swings.ts` | `findSwingPoints` + `findAlternatingSwings` (lookback configurável) | Dedup: estava copiado em 3 módulos |
| **M3.2** | `smc/index.ts` | Order Blocks, FVG, Liquidity, BOS/CHoCH, bias, summary | Params no config; BOS/CHoCH **por fechamento**; `kind:"qualitative"` + disclaimer |
| **M3.3** | `harmonics/index.ts` | 6 padrões XABCD via Fibonacci | **Tolerância 0.04** (era 0.08) no config; **rejeita padrão quando PRZ não converge** (sem hack 2%); rótulo qualitativo |
| **M3.4** | `wegd/index.ts` | Wyckoff/Elliott/Gann/Dow | Params no config; marcado como **heurística** (não probabilidade calibrada); summary diz "contexto qualitativo" |
| **M3.5** | `config.ts`, `index.ts`, testes | Seções smc/harmonics/wegd no config; tipos co-locados; exports; 3 suites | — |

**Reuso:** `math/series` (sma), `indicators/volatility` (atr), `math/swings` (novo).

**Fora do M3:** Multi-Timeframe Confluence é composto na **borda (M4)** — exige buscar
candles de outros TFs (I/O), então não é função pura do motor.

### Estado do M3 — ✅ CONCLUÍDO (03/06/2026)

`packages/engine` ganhou `math/swings` (detector único, antes triplicado), `smc/`,
`harmonics/` e `wegd/`, todos puros e config-driven, rotulados `kind: "qualitative"` +
disclaimer. Hardening aplicado: tolerância harmônica 0.08→**0.04**, **PRZ inválida é
rejeitada** (sem o hack de 2% do v1), BOS/CHoCH por fechamento. Bônus: corrigido um bug
de contagem do Dow/Elliott do v1 (comparava swings por paridade de índice → em séries
alternadas só capturava um tipo; agora compara swings consecutivos do mesmo tipo via
`countStructure`). **76 testes** no total; `pnpm run ci` verde.

Atualizar M3 no roadmap (seção 10): ✅.
