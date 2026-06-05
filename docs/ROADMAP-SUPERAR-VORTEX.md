# Roadmap — Superar o Vortex (TradeAI v2)

> Plano de desenvolvimento para entregar **paridade total** com o Vortex Trade IA +
> **superioridade em credibilidade** + a **conformidade que eles não têm**. Organizado
> em fases (A–G) sobre o **v2** (`v2/`), que é onde todo desenvolvimento novo acontece
> (v1 segue no ar até o cutover).
>
> Criado em 04/06/2026. Pré-leitura: [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md) ·
> [`REESCRITA-BLUEPRINT.md`](./REESCRITA-BLUEPRINT.md) · [`PROJECT.md`](./PROJECT.md).

---

## 0. Princípio-guia

> **"Igualar tudo que o Vortex faz, vencer no que ele não consegue provar, e ser tudo
> aquilo que ele não é (transparente e em conformidade)."**

Três frentes simultâneas, nenhuma deixada para trás:
1. **Paridade de features** — toda capacidade do Vortex tem equivalente nosso (Fases A, C, D).
2. **Superioridade de credibilidade** — todo número com `n` + `IC` + período; backtest honesto; selo que recusa amostra fraca; track record *forward* real (Fases B, C).
3. **Conformidade como diferencial** — CNPJ, aviso de risco, termos, reembolso dentro dos 7 dias, identificação da empresa. É exatamente o flanco aberto deles no Reclame Aqui (Fase E).

---

## 1. Guardrails — o que NÃO copiar (inviolável)

O Vortex está classificado **"Não Recomendada"** no Reclame Aqui (30 reclamações, 0%
respondidas, acusações de **propaganda enganosa**, **lucros falsos** e **recusa de
reembolso** no prazo legal). Copiar o marketing deles = herdar o problema deles e
**destruir** o posicionamento "prova antes de prometer".

| ❌ Anti-padrão do Vortex | ✅ Nossa alternativa honesta |
|---|---|
| "83% Win Rate", "+$472.910", "66–95% assertividade" sem metodologia | Métricas com `n` + IC + período; selo cinza quando amostra é fraca |
| Contadores "ao vivo" fabricados (mudam a cada reload, *caem* durante o dia) | Sem contador falso. Se mostrar número de usuários, é real ou nada |
| Testimonials "+156% em 6 meses" não verificáveis | Cases reais pós-beta, anonimizados, sem cravar % mágico |
| Sem CNPJ, sem aviso de risco, sem termos, sem contato | Tudo visível e em conformidade (Fase E) |
| Não-reembolso mesmo no prazo de arrependimento | Reembolso de 7 dias respeitado e automatizado |
| **Robôs / auto-execução** (foco das reclamações + risco CVM) | **Não fazer agora.** Somos ferramenta de *análise*, não execução |
| "Motor IA V5.0" (versão de marketing vazia) | Versão do motor = `engineVersion` real, auditável no código |

---

## 2. Checklist completo — "nada para trás" (Vortex → TradeAI)

Mapa de **toda** feature do Vortex e onde ela é coberta. Legenda: ✅ pronto · ⚠️ parcial/portar · ❌ falta · 🚫 guardrail.

| # | Feature do Vortex | Status v2 | Fase |
|---|---|---|---|
| 1 | Análise multi-mercado (Forex/Cripto/B3/Índices/Commodities) | ✅ motor · ⚠️ catálogo 143 incompleto | A · F |
| 2 | Multi-timeframe (1m–1w) | ✅ motor (combiner) · ❌ orquestração borda + card | A |
| 3 | 20+ indicadores técnicos | ✅ motor + gauge | — |
| 4 | Análise fundamentalista (balanços, valuation, earnings) | ⚠️ **cripto on-chain feito (04/06)** — card TVL DefiLlama (chain/protocolo) + convergência viés×TVL, gated p/ cripto, observado-não-probabilístico (não toca o selo); 17 testes. **Ações (balanços/valuation/earnings) ainda ❌** | G (avaliar) |
| 5 | Notícias em tempo real + calendário econômico | ⚠️ v1 tinha · portar p/ v2 + card | A |
| 6 | Heatmap de horários ideais | ❌ | D |
| 7 | Entry / Stop / Multi-TP (3 alvos) | ✅ motor | — |
| 8 | Gestão de risco (R:R, breakeven auto) | ✅ R:R · ❌ breakeven no ciclo do sinal | C |
| 9 | Grau de assertividade / score de confiança | ✅ força+confluência+**selo com IC** (melhor) | — |
| 10 | Smart Money Concepts | ✅ motor · ❌ card | A |
| 11 | Padrões Harmônicos | ✅ motor · ❌ card | A |
| 12 | Análise Wyckoff | ✅ motor (WEGD) · ❌ card | A |
| 13 | Análise Visual com IA | ✅ narrativa LLM · ❌ chart+overlays (o "visual") | A |
| 14 | Análise Probabilística (Monte Carlo) | ✅ motor + números · ❌ cone de distribuição | A |
| 15 | Fear & Greed Index | ⚠️ v1 tinha · ❌ v2 | A |
| 16 | Relatório Executivo (12 seções) | ⚠️ peças existem · ❌ montagem + export PDF | A |
| 17 | Live Trading 24/7 (IA narrando) | ❌ → **monitor ao vivo honesto** | D |
| 18 | Sinais em tempo real (push/email, multi-ativo) | ⚠️ watchlist ✅ · ❌ engine de alertas (cron+RPC) | C |
| 19 | Performance "auditada" de sinais | ❌ → **track record *forward* com IC (moat)** | C |
| 20 | Robôs / trading automático | 🚫 guardrail | — |
| 21 | Testimonials / prova social | ❌ (pós-beta, reais) | E |
| 22 | Roadmap público | ❌ | E |
| 23 | Planos / sistema de créditos | ✅ 3 planos · modelo/preço a decidir | E |
| 24 | Trial sem cartão | ✅ 3 análises vitalícias (melhor que o deles) | — |
| 25 | Comparativo "Manual vs Vortex" | ⚠️ v1 tinha · refazer no v2 | E |
| 26 | Seção "dores do trader" | ⚠️ landing v2 | E |
| 27 | Auth / login | ✅ v2 (email+senha + Google) | — |
| 28 | Pagamento (Stripe/HUBLA) | ⚠️ webhooks HUBLA a plugar + fluxo de reembolso | F |

**Diferenciais nossos que o Vortex NÃO tem** (o fosso): selo de confiança `n`+IC+período ✅ · "por que NÃO operar" (selo vermelho/cinza) ✅ · backtest honesto walk-forward/OOS/por-regime ✅ motor · algoritmos abertos ✅ · backtest sob demanda parametrizável (Fase B) · modo Simples×Avançado (Fase B) · journal de performance (Fase G) · versão EN (Fase G) · conformidade visível (Fase E).

---

## 3. Estado atual do v2 (ponto de partida)

- **Motor (`packages/engine`) — COMPLETO** (M1–M4 motor): 20 indicadores, sinal 7 níveis, regime, risco, gates, `stats/` (Wilson/t-Student/bootstrap), Monte Carlo (prob. por simulação), backtest honesto (walk-forward, OOS, por-regime, janela dirigida por amostra), sazonalidade com IC, dual-scenarios, SMC, harmônicos, WEGD, multi-TF combiner, estratégia condicional por regime. 128 testes verdes.
- **Frontend (`apps/web`) — M5 parcial:** design system instrument-grade pronto; `analysis-shell` exibe veredito/gauge/níveis/selo/backtest+IC/momentum/Monte Carlo/cenários + narrativa IA. Auth (email+Google), dashboard, histórico, watchlist, planos ligados a dados reais. APIs: analyze, quotes, narrative, history, watchlist.
- **Lacuna-chave:** o **motor está à frente do frontend** — várias camadas (SMC, harmônicos, WEGD, sazonalidade, multi-TF) existem no motor mas **ainda não aparecem na tela**. Por isso a Fase A é a de maior retorno e menor risco.

---

## 4. As fases

### FASE A — Paridade de análise *(surface o motor que já existe)*
**Meta:** uma única análise mostra **tudo** que o "Relatório Executivo" do Vortex mostra — com selo de confiança em cada número. Risco baixo (motor já validado).

| Item | Entrega | Status | Esforço |
|---|---|---|---|
| A1 | Card **SMC** (Order Blocks, FVG, Liquidity, BOS/CHoCH, viés) | ✅ **feito (04/06)** — DTO + card + CSS; type-check/lint/test verdes | M |
| A2 | Card **Harmônicos** (6 padrões, PRZ, completion%) | ✅ **feito (04/06)** — DTO + card (barra de completude) + CSS; verificado ao vivo (ETHUSDT 1d → 2 padrões) | S |
| A3 | Card **WEGD** (Wyckoff/Elliott/Gann/Dow, com probabilidade) | ✅ **feito (04/06)** — DTO + card (4 leituras) + CSS; verificado ao vivo (200, 4 células) | S |
| A4 | **Heatmap de sazonalidade** (12 meses, com IC e `n`) | ✅ **feito (04/06)** — DTO + heatmap (cinza p/ amostra fraca) + CSS; verificado ao vivo (12 células). 🔧 **bug corrigido (04/06):** dava "amostra insuficiente (2 anos)" em TFs intraday porque reusava os candles do TF (4h ≈ só ~1-2 anos). Agora a borda busca uma **série diária dedicada e profunda** (`SEASONALITY_TF="1d"`, ~3000 candles ≈ 8-9 anos) → BTCUSDT 4h: n=9 por mês, todos os meses suficientes | M |
| A5 | Card **Multi-TF** + orquestração na borda (fetch TFs adjacentes) | ✅ **feito (04/06)** — borda busca higher/highest em paralelo + card (score/100 + chips); verificado ao vivo (4h+1d+1w) | M |
| A6 | **Cone de distribuição** do Monte Carlo (Recharts) | ✅ **já feito** — `MonteCarloPanel` desenha o cone P10–mediana–P90 (CSS, sem Recharts) | M |
| A7 | Card **Notícias + sentimento** | ✅ **feito + verificado ao vivo (04/06)** — 2 provedores selecionáveis (`NEWS_PROVIDER`): **NewsData.io = default** (free, comercial-OK, `qInTitle` → manchetes específicas do ativo) + World News API fallback ($39/mês). **Sentimento via LLM** (gpt-4o-mini, PT-BR, ~R$0,003) com resumo macro + fallback nos scores do provedor. `/api/news` + card + perfis X curados. **22 testes.** Verificado: BTC e PETR4 retornam manchetes relevantes + resumo PT-BR honesto. ⚠️ licença: exibir aos assinantes OK, cota por servidor (não per-user), não persistir conteúdo. | M |
| A8 | **Fear & Greed Index** (portar do v1) | ✅ **feito (04/06)** — fetcher alternative.me (free) + KPI do dashboard ligado a dado real; parser testado (5) + API real confirmada | S |
| A9 | **Gráfico candlestick + overlays** (OB/FVG/PRZ/SL-TP no lightweight-charts) | ✅ **feito + verificado (04/06)** — lightweight-charts v5 + `/api/candles` + overlays puros (entrada/stop/TPs + OB/FVG/PRZ como linhas de preço); chart client (import dinâmico). Verificado: candles 200 (240 reais) + /analise 200 c/ painel. ⚠️ `.next` corrompe intermitente nessa máquina (Desktop/OneDrive?) → rebuild limpo resolve | L |
| A10 | **Relatório Executivo** montado + **export PDF** | ✅ **feito + verificado (04/06)** — **PDF DESENHADO server-side** via `@react-pdf/renderer` (não a tela impressa; v1 foi `window.print()` e foi rejeitada por baixa qualidade). Documento A4 próprio: capa (recomendação+força+selo+disclaimer), **10 seções numeradas** (visão geral, plano operacional, selo+backtest c/ IC, Monte Carlo, cenários, sazonalidade, SMC, harmônicos, WEGD, multi-TF), tabelas/cartões, cabeçalho+rodapé fixos com **paginação e aviso de risco** em toda página. Rota `POST /api/report` recebe o DTO já calculado (PDF = exatamente o que o usuário vê) → busca **candles (gráfico)** + **narrativa IA** (lib `generateNarrative` compartilhada) em paralelo → `renderToBuffer` → download. **v2 (04/06):** adicionados **gráfico de candles com níveis** (SVG: candles + entrada/stop/TPs + OB/FVG/PRZ + legenda), **leitura da IA**, **logo vetorial** (header+capa), tipografia/espaçamento refinados (12 seções numeradas). **v3 (04/06):** **fonte embutida** (LiberationSans/OFL em `lib/report/fonts`, via `Font.register` + `outputFileTracingIncludes`) — elimina a substituição de fonte do visualizador que transbordava e sobrepunha texto; o layout do react-pdf passa a bater com o render em qualquer visualizador. Removido `wrap={false}` das seções (causava páginas com grandes vãos) + espaçamento comprimido → **4 páginas** sem buracos. Verificado rasterizando **página a página**: capa/gráfico/cenários/sazonalidade/WEGD/multi-TF limpos, zero overlaps, fecha natural na pg4. `POST /api/report 200`, **83KB**. 🔧 de quebra: corrigido warning de **key duplicada** nas zonas SMC | M |

### FASE B — Diferenciais de credibilidade *(o que eles não copiam)*
**Meta:** transformar a transparência em features visíveis e vendáveis.

| Item | Entrega | Status | Esforço |
|---|---|---|---|
| B1 | **ConfidenceBadge em 100% dos números** (auditar cobertura) | ✅ **auditado (04/06)** — todos os números ESTATÍSTICOS já carregam n+IC+método: backtest (PF/win rate/R médio, ConfidenceBadge), Monte Carlo (prob. alta c/ IC), cenários (prob. TP1/2/3 c/ IC), sazonalidade (retorno mensal c/ IC+n). Scores (força/confluência) e valores determinísticos (preços, R:R) não levam IC por definição | S |
| B2 | **"Por que NÃO operar"** — selo vermelho/cinza como feature explícita + copy | ✅ **feito + verificado (04/06)** — `buildTradeGuard` (puro, 10 testes) agrega motivos OBJETIVOS p/ não operar (sinal neutro/fraco, selo cinza/vermelho/amarelo, R médio negativo, R:R<1, stop>TP1, sazonalidade contra, TFs divergentes) + prós. Painel "Decisão · operar ou não" na tela (verde/amarelo/vermelho/cinza) + seção no PDF. Verificado ao vivo: BTC 4h = **VENDA FORTE mas NÃO OPERAR** (backtest reprovado + expectativa negativa) — confronta o "sempre opere" do Vortex | S |
| B3 | **Backtest sob demanda parametrizável** (usuário escolhe período/R:R/estratégia) | ✅ **feito + verificado (04/06)** — painel **"Backtest sob demanda"** (`BacktestLab`): selects de **estratégia** (TP1/breakeven/parcial), **período** (12/24/36/60m) e **perfil de R:R** (curto 1:1 / padrão 1,5 / largo 2,5, via override dos multiplicadores ATR). Rota `POST /api/backtest` busca candles cacheados + roda `runBacktest` (CPU puro, sem LLM) + **recomputa o selo honesto**. Helpers puros `backtest-params` (4 testes) + `backtest-view` (refatorado de full.ts). Verificado ao vivo: mudar parâmetros troca os números e o selo (exit-tp1/24m→vermelho, partial/12m/largo→amarelo, breakeven/60m/curto→cinza "sem veredito") | L |
| B4 | **Modo Simples × Avançado** (toggle persistido) — ataca o público iniciante | ✅ **no ar + verificado (04/06)** — toggle no AnalysisShell (localStorage) esconde `.adv-only`; no modo Simples ficam veredito + **Decisão** + gráfico + leitura + níveis/selo; avançado mostra todas as 15 camadas | M |

### FASE C — Sinais em tempo real *(paridade + o moat do track record)*
**Meta:** igualar o "Vortex Signals" e **vencer** com performance *forward-testada* honesta.

| Item | Entrega | Status | Esforço |
|---|---|---|---|
| C1 | **Engine de alertas** — cron + RPC atômico `process_watchlist_alert` | ✅ **já no ar** (cron `check-watchlist` + RPC; reusado) | M |
| C2 | Monitoramento multi-ativo + canais **push / e-mail / Telegram** | ⚠️ **e-mail + Telegram feitos (05/06)** — camada `lib/notify` (Telegram Bot API + Resend, fetch injetável, 5 testes); **broadcast dos sinais oficiais → canal Telegram** (ligado ao `emit-signals`); **alerta de watchlist → canais do usuário** (Telegram via vínculo + e-mail opt-in, ligado ao `check-watchlist`); migration `0004` (opt-in `notify_email`); no-op gracioso sem credenciais. **Canal Telegram ATIVADO + verificado ao vivo (05/06):** bot @Overtraderia_bot admin do canal "Over Trader IA"; `emit-signals` carimbou 6 sinais e **publicou os 6** pelo próprio app (`emitted:6, broadcast:6`). 🔧 e-mail ainda requer `RESEND_API_KEY`+`EMAIL_FROM` + migration `0004`. **Web push (VAPID) ❌** — adiado (precisa service worker). De quebra: alias `@/` no vitest do web | M |
| C3 | **Ciclo de vida do sinal** — breakeven auto + multi-TP (até 3 alvos) | ✅ **feito (05/06)** — `resolveLifecycle` no motor (puro, 7 testes): saída escalonada 1/3 em cada alvo + **stop sobe sozinho** (→ breakeven após TP1, → TP1 após TP2); R ponderado realizado. Cron de resolução usa o ciclo e grava o progresso (mesmo em abertos); migration `0003` (colunas tp1/2/3_hit, stop_stage, current_stop); seção **"Em andamento · ciclo de vida ao vivo"** na `/track-record` (chips TP1/2/3 + estágio do stop). ⚠️ aplicar migration `0003` no Supabase p/ ativar (página degrada gracioso sem ela) | M |
| C4 | **🥇 Track record público *forward*** | ✅ **feito + verificado (04/06)** — primitivo puro `resolveOutcome` + `aggregateTrackRecord` no motor (10 testes); migration `0002_signals.sql` (tabela pública + RPC `record_signal` com dedup); libs de emissão (`emitSignal`, mercados curados) + crons `emit-signals`/`resolve-signals`; agregação (win rate/PF/R médio com **IC + n**, por regime) + **página pública `/track-record`** (honesta: selo cinza "em construção" se amostra fraca); `vercel.json` agenda os 3 crons. Página degrada gracioso sem DB. ⚠️ **1 passo manual:** aplicar a migration no Supabase (sem CLI/conn neste ambiente) → aí os crons populam | L |
| C5 | **Bot Telegram** (portar esqueleto v1 + endurecer) | ✅ **feito + verificado ao vivo (05/06)** — webhook `/api/telegram/webhook` (valida `X-Telegram-Bot-Api-Secret-Token`) trata `/start <token>` (vincula chat_id à conta), `/stop` (desvincula); parser puro (5 testes); geração de pair_token `/api/telegram/link` (autenticado) + deep link `t.me/bot?start=`; UI **"Conectar Telegram"** na página de Alertas. Verificado com usuário de teste: secret 401/200, /start vincula, /stop limpa. 🔧 deploy: registrar o webhook (`setWebhook` apontando p/ a URL pública + secret) — Telegram não alcança localhost | M |

### FASE D — Engajamento "ao vivo" *(equivalente honesto ao Live Trading 24/7)*
| Item | Entrega | Esforço |
| Item | Entrega | Status | Esforço |
|---|---|---|---|
| D1 | **Monitor ao vivo** — preços + regime + detecção de setup; surge com a narrativa IA. **Sem "tagarelice" falsa** | ✅ **feito + verificado (05/06)** — página `/monitor` (client, polling 45s) com grid AO VIVO dos mercados (modo simples = barato: preço/regime/sinal) + seção "setups de qualidade ativos" (sinais abertos da tabela `signals` = os de selo verde/amarelo) com níveis, ciclo de vida e **narrativa IA gerada 1× na emissão e guardada** (migration `0005`); estado honesto "monitorando" quando não há setup. `/api/monitor` (público) + link "Ao vivo" no nav. Verificado: 6 mercados + 6 sinais ativos renderizando. 🔧 aplicar `0005` p/ narrativa | L |
| D2 | **Heatmap de horários ideais** — hora×dia-da-semana; só com amostra suficiente (honesto) | ✅ **feito + verificado (05/06)** — `analyzeSessionHeatmap` no motor (puro, 3 testes): retorno médio + win rate + n por janela (hora×dia, UTC), `sufficient` quando n≥10, melhor/pior janela + marginais por hora/dia com IC. Borda busca série **1h dedicada profunda** (`SESSION_TF`); painel "Horários ideais" (grade 7×24, cinza tracejado p/ amostra fraca, melhor janela destacada) na análise. Verificado ao vivo: BTC 4h → 2000 candles 1h, 168 células, melhor = terça 20h UTC | L |
| D3 | Alertas da watchlist plugados no monitor | ✅ **feito + verificado (05/06)** — o grid ao vivo inclui os ativos da watchlist do usuário (marcados ★, via `?watch=` em `/api/monitor`) + seção "Seus alertas recentes" na página do monitor (logado). Verificado: watchlist (BNB/ADA) mescla aos 6 curados | S |

### FASE E — Conversão + conformidade *(atacar o flanco deles)*
**Meta:** landing que converte E uma base de confiança que o Vortex não tem.

| Item | Entrega | Status | Esforço |
|---|---|---|---|
| E1 | **Conformidade visível:** CNPJ, aviso de risco em todas as telas, Termos/Privacidade, reembolso 7 dias, DPO | ⚠️ **parcial (05/06):** **faixa de aviso de risco em todas as telas** (no AppBar: "não é recomendação · risco de perda · Termos · Privacidade") + páginas **`/termos`** (com reembolso 7 dias/art.49 CDC + limitação) e **`/privacidade`** (LGPD, direitos, DPO) + caixa de risco destacada. ⏳ CNPJ/razão social/e-mail DPO como **[a definir]** (faltam os dados reais) | M |
| E2 | **Reembolso automatizado** no fluxo de pagamento | ❌ (depende do fluxo de pagamento/HUBLA — Fase F) | M |
| E3 | Landing v2: **comparativo honesto** Overtrader×Vortex (transparência/conformidade), "dores do trader" | ✅ **feito (05/06):** comparativo reforçado com conformidade (CNPJ/Termos/reembolso · sem robôs) + seção **"Dores do trader"** (6 pares dor→resposta honesta, anti-hype) com âncora no nav | M |
| E4 | **Roadmap público** (transparência também aqui) | ✅ **feito (05/06):** página `/roadmap` pública (entregue/em progresso/planejado, sem cravar datas) + link no rodapé | S |
| E5 | **Testimonials reais** (após beta de 20 usuários) | ❌ | S |
| E6 | **Decisão de pricing** (ver §5) implementada na página de planos | ✅ **decidido + feito (05/06):** estratégia confirmada pelo dono = **acessível**: PRO **R$97** / PRO+ **R$197** (mensal) + **anual com 2 meses grátis** (R$970 / R$1.970) + âncora de valor vs Vortex (R$337–749). Landing e `/planos` consistentes | S |

### FASE F — Robustez, segurança e lançamento *(M6 cutover)*
**Meta:** ir para produção sem os buracos do Bloco 4 do v1.

| Item | Entrega | Esforço |
|---|---|---|
| F1 | **Rate-limit em todas as rotas** + webhooks idempotentes + `audit_log` | M |
| F2 | **Sentry + log estruturado (pino)** ativos | S |
| F3 | **Webhooks HUBLA** (HMAC + idempotência + ativação atômica) | M |
| F4 | **Catálogo completo dos 143 ativos** | S |
| F5 | **Supabase prod** (migration consolidada aplicada, RLS verificada tabela a tabela, **MFA admin**) | M |
| F6 | **Consumo de crédito** plugado (gancho `consume_credits` numa ação premium) | S |
| F7 | **Build/deploy** (Vercel, `transpilePackages`, env via Zod, domínio+SSL) | M |
| F8 | **50+ testes funcionais** (Bloco 2 do PROJECT) + verificação LGPD + e2e Playwright | L |
| F9 | **Cutover v1→v2** atrás dos critérios de aceite + plano de rollback | S |

### FASE G — Fosso de longo prazo *(o que distancia, contínuo)*
| Item | Entrega | Esforço |
|---|---|---|
| G1 | **i18n / versão EN** (audiência ~25× maior) | L |
| G2 | **Journal de performance do usuário** (retenção + prova social orgânica → alimenta testimonials) | L |
| G3 | **Backtest segmentado por regime** exposto ao usuário ("funciona em mercado X") | M |
| G4 | **Análise fundamentalista** — ⚠️ cripto on-chain (TVL DefiLlama) **feito (04/06)**; falta **ações** (balanços/valuation/earnings) se houver demanda. ✅ **endpoint leve resolvido (04/06):** protocolos agora usam `/tvl/{slug}` (~18 bytes, ~185ms) em vez do histórico `/protocol/{slug}` de ~9,7 MB — trade honesto: protocolos exibem só TVL atual (tendência 30d indisponível barata na fonte free), chains mantêm tendência 30d (`/v2/historicalChainTvl`, leve) | L |
| G5 | **Monitoramento contínuo do Vortex** (mensal) + atualização desta doc | S |
| G6 | Pesquisa de **edge melhor** (meta-labeling/ML) — incerto, alto esforço; só se o swing 4h honesto não bastar | XL |

---

## 5. Decisões em aberto (precisam de você)

1. ✅ **Pricing — DECIDIDO (05/06):** estratégia **acessível** — PRO R$97 / PRO+ R$197 (mensal) + anual com 2 meses grátis. Posicionamento "mais honesto E mais barato" vs Vortex (R$337–749).
2. **Modelo de cobrança:** confirmado **assinatura** (não créditos). Mensal + anual.
3. **Sequência:** atacar **A → B → C** (produto primeiro, lançar com paridade+credibilidade) ou intercalar **F** (infra) mais cedo para lançar um MVP menor antes?
4. **Beta privado de 20 usuários** antes do público? (gera os testimonials reais da Fase E).
5. **Análise fundamentalista (G4):** entra no escopo ou ficamos puramente em análise técnica/quant?

---

## 6. Definição de "melhor" — critérios de aceite

O v2 só é "melhor que o Vortex" quando, simultaneamente:
- [ ] **Paridade:** todo item ✅/⚠️ do checklist (§2) está ✅, exceto os 🚫 guardrails.
- [ ] **Credibilidade:** todo número exibido tem `n` + IC + período; o selo fica cinza/vermelho quando a amostra é fraca (e isso é vendido como feature, não escondido).
- [ ] **Track record:** existe um log público *forward* de sinais com win rate + PF + IC — não um número cravado.
- [ ] **Conformidade:** CNPJ, aviso de risco, termos, reembolso de 7 dias e contato visíveis (tudo que falta no Vortex).
- [ ] **Robustez:** rate-limit, webhooks idempotentes, Sentry, RLS verificada, 50+ testes verdes.

---

## 7. Sequência recomendada

```
A (paridade de análise)  →  B (credibilidade visível)  →  C (sinais + track record)
                                                              │
        F (infra/segurança) corre em paralelo a partir de B ──┤
                                                              ▼
   D (engajamento ao vivo)  →  E (conversão + conformidade)  →  CUTOVER  →  G (fosso)
```

**Começar por A1** (card SMC) — maior retorno imediato, risco mínimo (o motor já entrega
os dados), e cada card novo aproxima a análise do "Relatório Executivo" completo do Vortex.

---

*Documento vivo. Atualizar ao fim de cada fase. **Fase A — CONCLUÍDA (04/06):** A1–A10 ✅
(paridade de análise + Relatório Executivo PDF). **Fase B — CONCLUÍDA (04/06):** B1–B4 ✅
(ConfidenceBadge auditado · "por que NÃO operar" como feature · backtest sob demanda
parametrizável · modo Simples×Avançado). **Pendências de ativação/validação** (deploy, credenciais, validação ao vivo) consolidadas em
[`PENDENTES.md`](./PENDENTES.md) — destaque: validar Telegram+webhook na Vercel.
**Fase C — CONCLUÍDA (05/06):** C1–C5 ✅
(engine de alertas · canais e-mail+Telegram · ciclo de vida do sinal · **track record forward — o moat** ·
bot Telegram). Canal Telegram dos sinais ATIVO. Rebrand **TradeAI → Overtrader** aplicado.
**Fase D — CONCLUÍDA (05/06):** D1–D3 ✅ (monitor ao vivo `/monitor` + heatmap de horários + watchlist
plugada). Próximo passo: **Fase E** (conversão + conformidade: CNPJ, termos, reembolso 7d, landing/comparativo)
ou **Fase F** (infra/segurança: rate-limit, Sentry, HUBLA, catálogo 143, RLS, testes) rumo ao cutover.*
