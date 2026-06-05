# `/docs` — Documentação TradeAI

Diretório com a documentação master do projeto pra abrir no Claude Code e
retomar o contexto a qualquer momento.

## Arquivos

### 📘 [`PROJECT.md`](./PROJECT.md) — Documento mestre

Visão completa do projeto:
- O que é o produto + audiência + posicionamento
- Estado atual (sprints 1-9 ✅ / sprint 10 ⏳)
- Stack técnico + estrutura de pastas + migrations + env vars
- Engine v1.1-adaptive com as 15 camadas analíticas
- Modelo de planos (Free vitalício + PRO R$ 50/mês anual + PRO+ R$ 78/mês anual)
- Resultados de backtests (PF 3.82 ouro 4h, PF médio 1.89)
- Diferenciais vs concorrência
- Compliance LGPD
- Skills Cowork criadas (tradeai-copywriter + tradeai-brainstorm)
- Pendências completas pra lançamento
- Decisões estratégicas pendentes

### 🔬 [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md) — Análise do concorrente

Análise detalhada do Vortex Trade IA a partir de:
- 10 screenshots do "Relatório Executivo Completo" do BTC Diário deles
- Screenshot da landing vortextradeia.com

Inclui:
- Estrutura das 12 seções do relatório deles
- Comparativo seção a seção (o que eles têm × o que nós temos)
- Análise da landing page deles + oportunidades de copy
- 5 gaps que vale copiar (RSI gauge, heatmap horários, regras de ouro, roadmap público, testimonials)
- 8 vantagens nossas pra destacar em material de venda
- Decisões estratégicas tomadas

### 🔧 [`REVISAO-E-ESTRATEGIA.md`](./REVISAO-E-ESTRATEGIA.md) — Revisão técnica + estratégia

Revisão do código real (motor quant + dados/segurança + frontend/UX) com achados
priorizados, bugs concretos (arquivo:linha) e um plano de inovações para desbancar o
Vortex. Achado central: o pitch "prova antes de prometer" exige tornar as 15 camadas
**estatisticamente honestas** — esse é o fosso competitivo real.

### 🏗️ [`REESCRITA-BLUEPRINT.md`](./REESCRITA-BLUEPRINT.md) — Planta da reescrita (v2)

Blueprint da reescrita do zero: princípios (credibilidade-first), o que
reaproveitar × reescrever × descartar, stack-alvo (monorepo + motor puro testável),
estrutura de pastas, modelo de dados, estratégia de cutover sem derrubar o v1, plano de
build em 7 marcos (M0–M6) e 6 decisões em aberto. **Em fase de planejamento — sem código novo.**

## Como retomar o projeto

1. **Abrir `PROJECT.md` primeiro** — visão geral + estado atual
2. **Abrir `VORTEX-ANALYSIS.md`** — contexto competitivo
3. **Decidir o próximo passo** olhando a seção "Pendências" do PROJECT.md
4. **Pedir no Claude:** *"vamos retomar o projeto"* — task list completa já carregada

## Estado do projeto em 1 frase

> **Produto 100% pronto tecnicamente. Falta configurar infraestrutura de
> produção (Vercel + Supabase prod + HUBLA + Telegram), validar
> funcionalmente (50+ testes) e fazer marketing inicial.**
