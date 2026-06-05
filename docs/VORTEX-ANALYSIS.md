# Análise do concorrente — Vortex Trade IA

> Análise feita a partir de 10 screenshots de um Relatório Executivo
> Completo do Vortex (BTC Diário, 25/05/2026) + página inicial do site
> vortextradeia.com.

**Última atualização:** 28 de maio de 2026
**Fonte:** documento `quantidade de analises que a vortex faz na pro.docx` enviado pelo usuário + screenshot da landing.

---

## Índice

1. [Visão geral do concorrente](#1-visão-geral-do-concorrente)
2. [Estrutura do relatório (12 seções)](#2-estrutura-do-relatório-do-vortex)
3. [Análise da landing page](#3-análise-da-landing-page-do-vortex)
4. [Gaps identificados (o que copiar)](#4-gaps-identificados--o-que-copiar)
5. [Vantagens nossas (o que destacar)](#5-vantagens-nossas--o-que-destacar)
6. [Decisões estratégicas tomadas](#6-decisões-estratégicas-tomadas)

---

## 1. Visão geral do concorrente

**Nome:** Vortex Trade IA
**Site:** vortextradeia.com (analisado)
**Posicionamento:** "Opere com Precisão de IA"
**Diferencial declarado:** análise institucional completa (SMC + harmônicos + Monte Carlo + WEGD + notícias)

**Pontos fortes:**
- 12 seções analíticas estruturadas por relatório
- Cobertura ampla (SMC, harmônicos, WEGD, Monte Carlo)
- Dados visuais bem apresentados (cards, barras, badges)
- Posicionamento profissional

**Pontos fracos (oportunidades nossas):**
- **Caixa-preta:** não mostra backtest público das análises
- Sem dashboard de preços ao vivo
- IA "afirma" em vez de explicar
- 3 níveis de sinal apenas (vs nossos 7)
- Sem trial vitalício gratuito

---

## 2. Estrutura do relatório do Vortex

Análise das 10 screenshots do "Relatório Executivo Completo" do BTC Diário:

### Imagem 1 — Cabeçalho + Visão Geral

**O que mostra:**
- Título: "Relatório Executivo Completo"
- Sub: "BTC · Diário · segunda-feira, 25 de maio de 2026"
- **Recomendação Final:** VENDA · **Força do Sinal:** 66%
- Seção "1. Visão Geral da Análise"
- Resumo de fatores: 1 Alta (14.3%) · 4 Neutros (57.1%) · 2 Baixa (28.6%)
- Lista do que a análise considera:
  - Indicadores Técnicos (RSI, MACD, MAs, Bollinger, ADX, ATR, Stoch + "mais de 20")
  - Smart Money Concepts (SMC)
  - Análise Multi-Timeframe
  - Notícias e Eventos

**Nosso equivalente:**
- SignalCard com 7 níveis + força + confluência (mais granular)
- Resumo de fatores: vem da votação dos 20 indicadores no nosso engine
- Lista do que consideramos: temos 15 camadas explícitas

---

### Imagem 2 — Análise Técnica Completa

**O que mostra:**
- Título: "2. Análise Técnica Completa"
- **RSI (14):** valor 34.6 com **barra visual** indo de 0 (Sobrevendido) → 100 (Sobrecomprado), zonas 30/50/70 marcadas
- Explicação textual do que o RSI significa naquele momento
- "Tendência Identificada: BAIXA" — sequência de topos e fundos descendentes

**Nosso equivalente:**
- Aba "Técnica" com 20 indicadores (vs deles "mais de 20")
- Cada indicador com voto BUY/SELL/NEUTRAL + nota explicativa
- ❗ **GAP NOSSO:** não temos barra visual do RSI. Só o número.

**Decisão:** considerar adicionar visualização tipo "barra de gauge" pros osciladores principais (RSI, Stoch, MFI).

---

### Imagem 3 — Smart Money Concepts (SMC)

**O que mostra:**
- Título: "3. Smart Money Concepts (Análise Institucional)"
- Definição do SMC (institucionais vs varejo)
- **Viés Institucional:** NEUTRO (com explicação)
- **Order Blocks (Blocos de Ordem):**
  - 2 OBs Alta com força 66.82% e 100%
  - Zonas de preço: 100919-104120 e 98225-103470
  - Badge "⚠️ Já mitigado"

**Nosso equivalente (Sprint 9.1):**
- Aba "SMC" com:
  - Viés institucional (bullish/bearish/neutral)
  - Order Blocks (até 5, com strength 0-100% e mitigation status)
  - Fair Value Gaps (até 8, com status active/filled)
  - Liquidity Zones (até 5, com cluster count e swept status)
  - Market Structure (BOS bullish/bearish / CHoCH / consolidating)

**Status:** ✅ **Já temos paridade total.** Algoritmos abertos em `lib/analysis/smc.ts`.

---

### Imagem 4 — Fair Value Gaps (FVGs)

**O que mostra:**
- Lista de FVGs com:
  - Direção (Alta/Baixa)
  - Zonas de preço
  - Status "Ativo" ou "Preenchido"

Exemplos do screenshot:
- FVG Baixa 84759-88706 (Ativo)
- FVG Baixa 65094-67132 (Preenchido)
- FVG Alta 92493-94387 (Preenchido)

**Nosso equivalente:**
- Mesma estrutura, mesma lógica. Implementado em `lib/analysis/smc.ts` função `findFairValueGaps()`.

**Status:** ✅ **Paridade total.**

---

### Imagem 5 — Zonas de Liquidez + WEGD

**O que mostra:**
- "Zonas de Liquidez" — definição (institucionais "caçam" stops de outros traders)
- "Estrutura de Mercado" — tendência estrutural (Indefinida no caso)
- **NOVA SEÇÃO 4: WEGD (Wyckoff, Elliott, Gann, Dow)**
  - **Wyckoff:** ACUMULAÇÃO · COMPRANDO
  - **Elliott:** Onda B · CORRETIVA
  - **Gann:** 1×1 · NEUTRO
  - **Dow Theory:** BAIXA · Não Confirmado

**Nosso equivalente (Sprint 9.10):**
- Aba "Resumo" tem o card `WegdCard` com 4 mini-cards:
  - **Wyckoff:** phase + confidence %
  - **Elliott:** currentWave + probability + type
  - **Gann:** angle1x1 + position (above/below/on)
  - **Dow:** primaryTrend + confirmed

**Diferencial nosso:** mostramos **probabilidade** (75% provável onda 3), eles **afirmam** (Onda B). Mais honesto.

**Status:** ✅ **Paridade + diferencial.**

---

### Imagem 6 — Análise Probabilística (Monte Carlo)

**O que mostra:**
- "5. Análise Probabilística (Monte Carlo)"
- "Simulação Monte Carlo com **15.000 cenários**"
- 3 cenários:
  - **Cenário Otimista:** 81.682,62
  - **Mediana:** 76.488,09
  - **Cenário Pessimista:** 71.476,20
- **Win Rate Geral:** 49.0% · **Win Rate Long:** 49.0% · **Win Rate Short:** 51.0%
- **Sazonalidade (Mês Atual):** Mai · +8.03% (Win: 100%)

**Nosso equivalente (Sprint 9.3 + 9.4):**
- Monte Carlo (`MonteCarloCard`) com:
  - 5.000 simulações (vs 15k deles — mas 5k já é estatisticamente suficiente, CI 95%)
  - 3 cenários (Otimista P90 / Mediana P50 / Pessimista P10)
  - Win Rate Up + Win Rate Down
  - Volatilidade anualizada
- Sazonalidade (`SeasonalityCard`) separada com **heatmap dos 12 meses** (vs deles apenas o mês atual)

**Diferencial nosso:** heatmap 12 meses + volatilidade anualizada explícita.

**Status:** ✅ **Paridade + diferencial.**

---

### Imagem 7 — Padrões Harmônicos

**O que mostra:**
- "6. Padrões Harmônicos"
- Definição (Fibonacci + zonas de reversão)
- 3 padrões detectados:
  - **Bat** (Padrão de Baixa) · 75% Completude · PRZ 75992-82450
  - **Butterfly** (Padrão de Alta) · 75% Completude · PRZ 74027-78243
  - **Butterfly** (Padrão de Baixa) · 50% Completude · PRZ 75992-82450

**Nosso equivalente (Sprint 9.6):**
- `HarmonicsCard` com 6 padrões: Bat, Butterfly, Gartley, Crab, Cypher, Shark
- Cada um com PRZ, completion %, qualidade do match, status (active/completed)
- Pontos XABCD visíveis

**Diferencial nosso:** detectamos 6 padrões (vs 2 nas screenshots dele — Bat e Butterfly). Algoritmo open em `lib/analysis/harmonics.ts`.

**Status:** ✅ **Paridade + diferencial.**

---

### Imagem 8 — Cenários de Probabilidade

**O que mostra:**
- "7. Cenários de Probabilidade"
- "Análise de confluência baseada em 7 fatores"
- **COMPRA: 42%** | **VENDA: 58%**
- Para cada lado, mostra:
  - Entrada
  - Stop Loss
  - TP1, TP2, TP3 com **probabilidade individual** (ex: TP1 53% / TP2 37% / TP3 17%)

**Nosso equivalente (Sprint 9.5):**
- `DualScenariosCard` mostra ambos os lados (Compra E Venda) lado a lado
- TP1, TP2, TP3 com **probabilidade calculada via CDF normal (GBM)**
- Stop probability calculado também
- Score por lado + recomendação fundamentada

**Diferencial nosso:** mostramos **lado a lado** (split UI) em vez de scroll. Mais fácil de comparar.

**Status:** ✅ **Paridade total.**

---

### Imagem 9 — Notícias + Gestão de Risco

**O que mostra:**
- "8. Notícias, Sentimento e Eventos Econômicos"
- No screenshot: "Nenhuma notícia ou evento econômico relevante identificado no momento"
- "9. Gestão de Risco e Recomendações Finais"
- Texto educativo sobre R:R
- **Relação Risco/Retorno: 1:1.1** · BAIXA · "exige alta taxa de acerto"

**Nosso equivalente (Sprint 9.11):**
- `NewsCard` com:
  - Sentimento agregado (bullish/bearish/neutral/mixed) com score -1 a +1
  - Resumo IA das notícias em PT-BR (3 frases)
  - Lista das 5 notícias mais relevantes com fonte + tempo + sentiment
  - Lista curada de perfis X relevantes (Augusto Backes, Will Clemente, etc)

**Diferencial nosso:** sentimento gerado por LLM real (GPT-4o-mini) + lista X curada. Vortex parece ter sentiment "estatico".

**Status:** ✅ **Paridade + diferencial.**

---

### Imagem 10 — Níveis Operacionais + Regras de Ouro

**O que mostra:**
- "Níveis Operacionais Sugeridos"
- 4 cards visuais: Entrada / Stop Loss / TP1 / TP2 (sem TP3 nesse exemplo)
- "Regras de Ouro da Gestão de Risco":
  1. Nunca arrisque mais de 1-2% do capital
  2. Sempre use Stop Loss
  3. Realize parcial no TP1 (50-70%) e deixe restante correr
  4. Não opere contra a tendência principal

**Nosso equivalente:**
- `SignalCard` mostra Entry/SL/TP1/TP2/TP3 em cards horizontais (mais limpo)
- `BacktestTab` valida a regra "realizar parcial no TP1" com nossa estratégia "Saída Parcial"
- Não temos seção dedicada "Regras de Ouro" — está implícito no design

**Status:** ✅ **Paridade no operacional.** Regras de ouro: podemos adicionar como rodapé educativo na análise.

---

## 3. Análise da landing page do Vortex

Screenshot recebida da home do vortextradeia.com:

### Seções identificadas (top → bottom)

1. **Hero**
   - Headline: "Opere com Precisão de IA"
   - 4 stats (provavelmente: usuários, acurácia, ativos, etc)
   - 2 CTAs principais

2. **"Tudo que você precisa para operar melhor"** — 6 features grid

3. **"Como Funciona"** — process steps (provavelmente 4)

4. **"Live Trading com Inteligência Artificial"** — widget de demonstração

5. **"Análise Gráfica em Tempo Real com IA"** — chart visualization mockup

6. **"Sinais de Trading em Tempo Real"** — lista de sinais

7. **"Trader Manual vs Trader com Vortex"** — tabela comparativa

8. **"As 5 Maiores Dores do Trader Iniciante"** — pain points

9. **"Resultados Reais de Traders Reais"** — testimonials com 5 estrelas (3 reviews visíveis)

10. **"Heatmap de Horários Ideais"** — heatmap visualization

11. **Mockup de app mobile** — "Invista decisões melhores"

12. **"Tire Suas Dúvidas"** — FAQ

13. **"Roadmap Vortex"** — timeline de features futuras

14. **CTA final** — "Pronto para operar com inteligência?"

### Análise crítica da landing

| Elemento | Como eles fazem | Nossa abordagem |
|---|---|---|
| Hero | Headline genérica "Precisão de IA" | "A IA que prova antes de prometer" (mais específico) |
| Stats | Números sem contexto (acurácia X%) | Métricas concretas (PF 3.82 em ouro 4h, contexto explícito) |
| Comparativo | "Manual vs Vortex" (binário) | Tabela 13 linhas TradeAI vs Vortex direta |
| Testimonials | 3 reviews com estrelas | (a fazer — Bloco 6) |
| Heatmap horários | Tem | Não temos ainda (oportunidade futura) |
| FAQ | Estilo expansível | Mesmo padrão (5 perguntas em /planos) |
| Roadmap público | Mostra futuras | (a fazer — pode ser diferencial) |

### Oportunidades de copywriting

1. **"Heatmap de Horários Ideais"** — interessante, podemos adicionar no Sprint 11 (heatmap de quando cada ativo tem melhor PF historicamente)
2. **Testimonials** — ainda não temos. Beta privado dos 20 usuários gera material
3. **Roadmap público** — transparência também aqui (mostra que continuamos evoluindo)

---

## 4. Gaps identificados — o que copiar

### 4.1 Visualização do RSI (e outros osciladores)
**O quê:** barra horizontal com zonas marcadas (0-30 sobrevendido, 30-70 neutro, 70-100 sobrecomprado).
**Por quê:** muito mais visual que só o número.
**Onde implementar:** `components/analysis/indicators-tab.tsx`.
**Esforço:** ~2h.

### 4.2 Heatmap de horários ideais (Sprint 11+)
**O quê:** matriz dia-da-semana × hora mostrando quando o padrão tem melhor PF historicamente.
**Por quê:** insight acionável para day-trader.
**Onde implementar:** novo card na aba Resumo.
**Esforço:** ~1 semana (precisa rodar backtest por janela horária).

### 4.3 "Regras de Ouro" educacionais
**O quê:** rodapé com 4 regras de gestão de risco em toda análise.
**Por quê:** reforça posicionamento educativo + protege juridicamente.
**Onde implementar:** novo componente `RiskRules` no fim do `AnalysisView`.
**Esforço:** ~30min.

### 4.4 Roadmap público
**O quê:** página `/roadmap` mostrando o que está sendo desenvolvido.
**Por quê:** transparência + diferencial vs caixa-preta.
**Onde implementar:** nova página estática.
**Esforço:** ~1h.

### 4.5 Testimonials reais (após beta)
**O quê:** seção na landing com 3-5 cases reais (anonimizados se preciso).
**Por quê:** prova social.
**Onde implementar:** novo componente `Testimonials` na landing.
**Esforço:** ~2h (recrutamento + componente).

---

## 5. Vantagens nossas — o que destacar

### 5.1 Backtest público
**Vortex não tem.** Em produção, em `BacktestTab` com 3 estratégias comparadas.
**Como destacar:** já está no comparativo de 13 linhas + reforçar em todo material.

### 5.2 Dashboard de preços ao vivo (5 mercados)
**Vortex não tem.** Em produção, em `MultiMarketTickers`.
**Como destacar:** mostrar screenshot do dashboard em material de venda.

### 5.3 IA narrativa real
**Vortex tem "texto" mas não fica claro se é LLM real.** Nossa IA usa GPT-4o-mini com prompt rico de 15 camadas de contexto.
**Como destacar:** mostrar exemplos de IA narrativa no material de venda. Comparar lado a lado.

### 5.4 7 níveis de sinal vs 3
**Vortex tem 3 (Compra/Venda/Neutro).** Nós temos 7 (Compra Forte/Compra/Compra Fraca/Neutro/Venda Fraca/Venda/Venda Forte).
**Como destacar:** "granularidade que respeita a realidade do mercado".

### 5.5 Banner de qualidade automático
**Vortex não tem.** Cada análise nossa mostra semáforo (verde/amarelo/vermelho/cinza) baseado no backtest histórico.
**Como destacar:** "o único sistema que te avisa quando NÃO operar".

### 5.6 Trial vitalício sem cartão
**Vortex tem só trial pago.** Nós: 3 análises completas vitalícias.
**Como destacar:** "Teste sem cadastrar cartão. Sem expiração."

### 5.7 Algoritmos abertos
**Vortex é caixa-preta.** Nossos algoritmos (SMC, harmônicos, WEGD) estão em código TypeScript público no repo.
**Como destacar:** "Auditável. Você pode ler o código se quiser."

### 5.8 Probabilidade vs afirmação (em WEGD)
**Vortex afirma:** "Onda B · CORRETIVA"
**Nós dizemos:** "75% provável Onda 3"
**Como destacar:** "Honestidade técnica > afirmação confiante."

---

## 6. Decisões estratégicas tomadas

Durante a análise comparativa, estas decisões foram registradas:

### ✅ Implementar tudo que Vortex tem (paridade)
- SMC (Order Blocks, FVG, Liquidity, BOS/CHoCH) — Sprint 9.1
- Monte Carlo — Sprint 9.3
- Padrões Harmônicos — Sprint 9.6
- WEGD — Sprint 9.10
- Notícias + Sentimento — Sprint 9.11
- Sazonalidade — Sprint 9.4
- Multi-Timeframe — Sprint 9.2
- Dual Scenarios (compra E venda) — Sprint 9.5

### ✅ Manter os 8 diferenciais nossos
- Backtest público
- Dashboard preços ao vivo
- IA narrativa real (GPT-4o-mini)
- 7 níveis de sinal
- Banner de qualidade
- Trial vitalício
- Algoritmos abertos
- Probabilidade em WEGD

### ⏳ Considerar adicionar (Sprint 11+)
- Visualização gráfica RSI/Stoch (~2h)
- Heatmap horários ideais (~1 semana)
- Regras de Ouro educativas (~30min)
- Roadmap público (~1h)
- Testimonials após beta (~2h)

### ❌ Não copiar
- Promessas sem dado ("Acurácia 99%" sem contexto)
- Posicionamento "Precisão de IA" (vago)
- Caixa-preta — manter algoritmos abertos é nosso diferencial

---

## Próximos passos relacionados

Após o lançamento (Sprint 10 completo), considerar:

1. **Sprint 11.A:** adicionar as 5 melhorias visuais identificadas (RSI gauge, heatmap horários, regras de ouro, roadmap, testimonials).
2. **Sprint 11.B:** análise contínua do Vortex (mensal) pra capturar novas features e responder rapidamente.
3. **Sprint 11.C:** material de marketing comparativo (post de blog "TradeAI vs Vortex — 13 features").

---

*Análise gerada a partir do docx `quantidade de analises que a vortex faz na pro.docx` com 10 screenshots + screenshot da landing vortextradeia.com.*
