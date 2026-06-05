# Contexto do projeto TradeAI (para o especialista)

Snapshot para dar parecer ancorado no que existe — não em suposições.

## Produto
- Plataforma BR de análise de trading com IA. Pitch: **"a IA que prova antes de prometer"**.
- Audiência: trader BR 25–45, intermediário/avançado, **cético de IA "mágica"**, quer prova com dado.
- Concorrente direto: **Vortex Trade IA** — caixa-preta, sem backtest público, IA que "afirma".
- Planos: Free (3 análises vitalícias) · PRO R$50/mês anual · PRO+ R$78/mês anual. 143 ativos, 6 timeframes.

## Reescrita v2 (em andamento) — monorepo em `v2/`
- **`packages/engine`** — motor PURO (sem I/O), testável. Coração do produto.
- **`packages/shared`** — timeframes, níveis de sinal, mercado, planos, catálogo.
- **`apps/web`** — Next.js 15 (App Router).
- Decisões: monorepo pnpm; rate-limit em tabela Supabase; escopo v2 inclui modo Simples×Avançado, base i18n, MFA admin.

## Estado dos marcos (blueprint M0–M6 em `docs/REESCRITA-BLUEPRINT.md`)
- **M0 ✅** scaffold (monorepo, CI, schema Supabase consolidado com RLS/audit_log/rate_limits/RPCs atômicos).
- **M1 ✅** motor puro: `stats/` (Wilson, t-Student, bootstrap, tipo `Estimate`), 20 indicadores puros, signal/regime/risk/gates **config-driven**, `runAnalysis` determinístico. ~30 testes.
- **M2 ✅** camadas probabilísticas honestas: Monte Carlo (GBM determinístico, winRate com IC, **probabilidade de toque por first-passage**), cenários (prob TP/SL com IC + **R esperado**, sem reflection principle nem score mágico), sazonalidade (retorno médio com t-CI, winRate Wilson, flag `sufficient`, janela `recentYears`), backtest (walk-forward sem lookahead, janela por timeframe, métricas com IC, cobertura sem cap silencioso), **selo de qualidade** (verde só com limite inferior do IC + amostra suficiente). 65 testes; `pnpm run ci` verde.
- **M3 ⏳** SMC / harmônicos / WEGD com parâmetros endurecidos + rótulo "contexto qualitativo".
- **M4 ⏳** dados (providers, fetch de histórico longo, rate-limit, RPCs) + catálogo completo dos 143 ativos.
- **M5 ⏳** frontend (ConfidenceBadge, gauges, equity curve, grid colapsável, Simples×Avançado).
- **M6 ⏳** paridade + cutover (v1 segue no ar até lá).

## Tipo central da credibilidade
`Estimate { value: number; ci95: [number, number]; n: number; period?: string }` — toda métrica estatística deveria sair assim. A UI mostra via `ConfidenceBadge` (M5).

## Parâmetros e calibração
Todos os números que afetam decisão de trade vivem em `EngineConfig` (`packages/engine/src/config.ts`), marcados `[NÃO CALIBRADO]` enquanto herdados do v1 sem estudo empírico. Calibração real depende de backtest (M2+).

## Achados da revisão quant do v1 (o que NÃO repetir)
Detalhe em `docs/REVISAO-E-ESTRATEGIA.md`. Resumo dos pecados que o especialista deve caçar:
- Backtest curto (~300 candles ≈ 4h de BTC 1h) → sem amostra.
- PF 3.82 como headline sem IC → cheira a cherry-pick.
- Sazonalidade "win rate 100%" sobre n≤16 sem incerteza.
- Probabilidade de TP por reflection principle `2·(1−Φ)` (válido só com drift≈0) e score com multiplicadores mágicos.
- `stepsPerYear` fixo (2160, cripto) anualizando volatilidade de forex/ações.
- Dezenas de parâmetros mágicos hardcoded (pesos, "impulso=2×ATR", tolerância Fibonacci ±8%).
- Sem rate-limit em webhooks/admin; `console.*` solto sem observabilidade.
