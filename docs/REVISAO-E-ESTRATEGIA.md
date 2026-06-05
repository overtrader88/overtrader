# Revisão Técnica + Estratégia para Desbancar o Concorrente

> Análise feita em 03/06/2026 sobre o código real (raiz do projeto, não a pasta
> vazia `novo-sistema-trading/`). Cobre: motor de análise (quant), camada de
> dados/API/segurança, frontend/UX — e uma proposta de "refazer o código" +
> inovações para superar o Vortex Trade IA.
>
> Leitura recomendada junto de [`PROJECT.md`](./PROJECT.md) e [`VORTEX-ANALYSIS.md`](./VORTEX-ANALYSIS.md).

---

## 0. Diagnóstico central — o paradoxo da credibilidade

O posicionamento do TradeAI é **"A IA que prova antes de prometer"**. É o único
diferencial que o Vortex não consegue copiar rápido (eles são caixa-preta).

**O problema:** a revisão quant do motor mostrou que *as próprias provas são
estatisticamente frágeis*. Hoje o produto:

- Roda **backtest em ~300 candles** (200 de warmup + ~100 de validação) → para BTC 1h isso é **~4h de mercado**. Um trader sério olha e diz "cadê 6–12 meses?".
- Mostra **PF 3.82 em ouro 4h** como headline — exatamente o tipo de número que parece *cherry-pick* sem intervalo de confiança ao lado.
- Exibe **sazonalidade com "win rate 100%"** sobre amostras minúsculas (≤16 anos), sem comunicar incerteza.
- Calcula **probabilidades de TP** (dual-scenarios) com uma simplificação do GBM que ignora o drift → números sistematicamente enviesados, apresentados como se fossem precisos.
- Usa **dezenas de parâmetros mágicos** hardcoded (peso 1.3 em trending, "impulso = 2× ATR", "strength = move/atr × 25", tolerância Fibonacci de ±8%, score = `1.5·TP1 + 2.5·TP2 + 3.75·TP3 − 3·SL`) sem nenhuma calibração.

> **Conclusão estratégica:** não dá pra "desbancar o Vortex sendo mais transparente"
> se a transparência expõe números que não se sustentam. **A maior inovação possível
> não é adicionar a 16ª camada — é tornar as 15 atuais estatisticamente honestas e
> defensáveis.** Isso vira o fosso competitivo real: "somos a única plataforma BR
> que mostra o intervalo de confiança e o tamanho de amostra de cada afirmação."

Esse princípio guia todas as prioridades abaixo.

---

## 1. Bugs e inconsistências concretas (quick wins — corrigir já)

Achados de primeira mão, com arquivo:linha. São baratos e alguns são visíveis ao usuário.

| # | Onde | Problema | Correção |
|---|------|----------|----------|
| 1 | [`engine.ts:807`](../lib/analysis/engine.ts), [`types.ts:145`](../lib/analysis/types.ts) | Campo `enginVersion` (typo, falta o "e" de "engine") | Renomear para `engineVersion` |
| 2 | [`engine.ts:652`](../lib/analysis/engine.ts), [`engine.ts:688`](../lib/analysis/engine.ts) | Texto mostra **"X/6 gates aprovados"** mas existem **8 gates** (A–H) | Trocar `/6` por `/${gates.length}` |
| 3 | [`engine.ts:11`](../lib/analysis/engine.ts) | Comentário de cabeçalho diz "GATES (6)" e "EXPLICAÇÃO heurística (será trocada por LLM no Sprint 4)" — doc-drift, já são 8 gates e o LLM já existe | Atualizar comentários |
| 4 | [`analyze-form.tsx:84`](../components/analysis/analyze-form.tsx) | `const cost = analysisType === "simple" ? 1 : 1;` — custo idêntico nos dois ramos | Usar os créditos reais por tipo |
| 5 | [`live-chart.tsx:196`](../components/analysis/live-chart.tsx) | `useEffect` sem `assetType`/`signal` nas deps → forex herda WebSocket de cripto | Corrigir array de dependências |
| 6 | [`webhooks/hubla/route.ts`](../app/api/webhooks/hubla/route.ts), [`admin/credit/route.ts`](../app/api/admin/credit/route.ts) | Chamam RPC `get_user_id_by_email` — confirmar se a migration existe (há duas migrations `..._credit_rpc(s)` suspeitas de duplicata) | Validar RPC + remover migration duplicada |
| 7 | [`news/summarize.ts`](../lib/news/summarize.ts) | `JSON.parse` do retorno do LLM sem try/catch nem schema → derruba a análise se o LLM responder malformado | Envolver em try/catch + validar com Zod |
| 8 | [`monte-carlo.ts`](../lib/analysis/monte-carlo.ts) | Volatilidade anualizada usa `stepsPerYear` fixo de cripto (24×90) p/ todos os ativos → errada para forex/ações (fim de semana) | Ajustar por `assetType` |

**Duplicação de migration:** há `20260520000002_credit_rpc.sql` **e** `20260520000002_credit_rpcs.sql` com o mesmo prefixo de timestamp — risco de ordem/conflito de migração. Resolver antes do deploy de produção.

---

## 2. Motor de análise (quant) — o coração do produto

### O que está correto e sólido ✅
RSI (Wilder), MACD, ATR (Wilder), ADX/+DI/−DI, Bollinger, OBV, CMF, Awesome,
Williams %R, CCI — **implementações padrão e corretas**. O GBM do Monte Carlo está
discretizado certo, e o Box-Muller está correto. A arquitetura em camadas é limpa.

### Riscos críticos de credibilidade 🔴

**2.1 Backtest com amostra insuficiente** — [`backtest.ts`](../lib/analysis/backtest.ts)
- `maxCandlesToScan` default 500, com 200 de warmup → ~100–300 trades.
- **Ação:** subir para ≥2.000 candles; adicionar *train/test split*; rotular explicitamente o que é "amostra educacional" vs "validado".

**2.2 Probabilidades de TP infladas** — [`dual-scenarios.ts`](../lib/analysis/dual-scenarios.ts)
- `probabilityOfTouching` usa `2·(1−Φ(d))` (reflection principle), válido só com drift≈0. Com drift ≠ 0 enviesa de forma sistemática.
- O `score` (`1.5·TP1 + 2.5·TP2 + 3.75·TP3 − 3·SL`) tem multiplicadores mágicos sem significado estatístico.
- **Ação:** usar a fórmula de barreira do GBM completa (Merton) **ou** estimar a probabilidade por Monte Carlo (já temos o motor!) — contando em quantas das 5.000 trajetórias o preço toca cada nível. Isso é mais honesto e reaproveita código. Reportar com IC.

**2.3 Sazonalidade sem intervalo de confiança** — [`seasonality.ts`](../lib/analysis/seasonality.ts)
- "Win rate 100% / +8%" sobre n≤16 é estatística de brincadeira.
- **Ação:** mostrar **"+2,5% ±1,2% (95% IC, n=16 anos)"**; cortar amostras com n<5; usar janela recente (3–5 anos) para cripto. Vira diferencial honesto vs Vortex (que mostra só o mês atual cravado).

### Riscos importantes (parâmetros mágicos) 🟡
- **SMC** ([`smc.ts`](../lib/analysis/smc.ts)): "impulso = 2× ATR", `strength = (move/atr)·25`, bias `> 1.3×`. BOS/CHoCH usa close intraday sem confirmação → falsos sinais em alta volatilidade.
- **Harmônicos** ([`harmonics.ts`](../lib/analysis/harmonics.ts)): tolerância de **±8%** nos ratios de Fibonacci é larga demais (0.618 ±8% cobre quase tudo) → muitos falsos positivos. Há um *hack* que cria PRZ artificial de 2% quando os ranges não convergem (deveria rejeitar o padrão).
- **WEGD** ([`wegd.ts`](../lib/analysis/wegd.ts)): Elliott é contagem simplificada (não valida as regras oficiais); Gann usa ATR como escala (não padrão); Wyckoff sem spread (não é VSA real).
- **Gates** ([`engine.ts:519+`](../lib/analysis/engine.ts)): Confluência ≥6 de 20 = 30% (binomial diz que ≥6 votos acontece ~58% do tempo por acaso → threshold pouco seletivo); ADX>20 (indústria usa 25); multiplicadores de SL/TP **fixos** apesar do nome "v1.1-adaptive".

### "Adaptive" é overselling
Os multiplicadores por regime (1.3 / 0.5 / 1.4 / 0.3…) são **fixos**, não calibrados
por ativo/timeframe/dados. Chamar de "adaptive" é defensável só se houver calibração
real (rodar backtest periódico p/ ajustar pesos). Ou se calibra, ou se renomeia.

### Performance
`computeMarketRegime` recalcula ATR numa janela fatiando o array a cada iteração →
**O(n²)**. No request único é tolerável, mas o backtest recalcula os 20 indicadores
candle a candle (~250k cálculos). Vale memoizar séries (EMA/ATR/ADX incrementais).

**Score quant honesto:** correção matemática **7/10**, rigor estatístico **5/10**,
qualidade de código **8/10**, credibilidade p/ trader experiente **4/10**. É exatamente
o 4/10 que precisa virar 8/10 para o pitch "prova antes de prometer" se sustentar.

---

## 3. Dados, API e segurança

### Pontos fortes ✅
RLS bem usado, `service_role` só onde precisa, HMAC com `timingSafeEqual` no webhook
HUBLA (anti-timing-attack), fallback de mercado (Binance → TwelveData → Yahoo), cache
compartilhado, Zod nas rotas principais, LLM com *fail-safe* (análise continua sem a narrativa).

### Críticos 🔴
- **Sem rate limiting** em `webhooks/hubla`, `webhooks/telegram` e `admin/credit`. Com a chave/HMAC, dá pra disparar ativações/análises ilimitadas → custo de API descontrolado e fraude. **Ação:** rate limit por email/chatId + por IP.
- **`admin/credit` protegido só por checagem de email** ([`admin/credit/route.ts`](../app/api/admin/credit/route.ts)): se um email admin vazar, dá pra creditar/ativar à vontade. **Ação:** rate limit + audit trail + idealmente MFA.

### Importantes 🟡
- **`consume_credits`** sem retry/backoff → erro genérico em concorrência (dois requests simultâneos). Risco do usuário não saber se o crédito foi consumido.
- **Job `check-alerts`** ([`jobs/check-alerts/route.ts`](../app/api/jobs/check-alerts/route.ts)): updates não-atômicos (race condition) → alertas duplicados ou watchlist "stale". **Ação:** mover para um RPC atômico.
- **Sem timeout** em `getCandles` dentro de [`analyze/route.ts`](../app/api/analyze/route.ts) → request pendurado se o provider travar.
- **OpenAI client** sem retry em 429 ([`openai-client.ts`](../lib/llm/openai-client.ts)).
- **Observabilidade:** erros logados com `console.warn` solto, sem estrutura. Sem Sentry/log estruturado, falhas silenciosas (ex.: email com typo no HUBLA → usuário nunca ativado) passam batido.

### Menores
- Lista de timeframes `["15m","1h",...]` hardcoded em 3 lugares (analyze, watchlist, telegram) → centralizar em `lib/market/types.ts` como `const` + `enum` Zod.

---

## 4. Frontend / UX — onde a conversão é ganha ou perdida

### Pontos fortes ✅
Design system robusto (HSL, Inter + JetBrains Mono, `tabular-nums`), Server/Client
components bem separados, a11y de base (roles, aria, alvos de 44px), microcopy com
disclaimers honestos (ex.: Monte Carlo avisa que ignora cisnes negros).

### O problema central de UX 🔴: sobrecarga linear
A análise empilha as 15 camadas em **scroll vertical de ~4.500px**. O "Relatório
Executivo" do Vortex usa **grid de cards + seções colapsáveis** — parece mais
profissional e é mais rápido de escanear. Hoje:
- `SignalCard` (o mais importante) é pequeno e **rola pra fora da tela**.
- 20+ badges por análise competindo por atenção → o olho não sabe onde pousar.
- Heatmap de sazonalidade quebra no mobile (6 colunas).

### O gap visual vs Vortex 🔴: falta de visualização quantitativa
Temos dados riquíssimos apresentados como **texto/tabela**. O Vortex ganha em
percepção com **gauges e gráficos**:

| Camada | Hoje (TradeAI) | Vortex | O que falta |
|--------|----------------|--------|-------------|
| RSI/osciladores | só o número | barra/gauge 0–100 com zonas | **gauge radial** |
| Monte Carlo | 3 cards de texto | cone de projeção | **gráfico de distribuição/cone** |
| Backtest | métricas tabulares | equity curve + drawdown | **equity curve** |
| SMC / Harmônicos | lista textual | zonas/padrão desenhados no chart | **overlay no gráfico** |
| Sazonalidade | heatmap (ok) | heatmap | empate ✅ |

### Ações de UX priorizadas
1. **Redesenhar a análise em grid 2 colunas + seções colapsáveis** (sinal + filtros no topo, juntos, sem scroll).
2. **`SignalCard` sticky** no topo ao rolar (modo `compact`).
3. **Gauge de RSI/Stoch/MFI** (componente novo `RadialGauge`).
4. **Equity curve** no backtest (o dado já existe).
5. **Mobile:** heatmap 4 col, cenários lado-a-lado, indicadores colapsáveis por categoria.
6. **Navegação por teclado** nas tabs (←/→) — [`tabs.tsx`](../components/analysis/tabs.tsx) é custom e não suporta.

---

## 5. Proposta para "refazer o código" — arquitetura-alvo

Não recomendo reescrever do zero (o produto está 100% funcional e a base é boa).
Recomendo uma **refatoração cirúrgica em camadas**, na ordem de maior risco/retorno:

### 5.1 Camada de motor — separar "cálculo" de "calibração"
- Extrair **todos os parâmetros mágicos** para um único `lib/analysis/config.ts` versionado e documentado (cada número com a justificativa ou marcado como "a calibrar").
- Criar uma **suíte de testes unitários** comparando RSI/MACD/ATR/ADX com valores de referência (TradingView) — hoje não há testes. É o que dá direito de dizer "auditável".
- Trocar probabilidades fechadas frágeis por **estimativa via Monte Carlo** (reaproveita o motor, mais honesto).
- Substituir cálculos O(n²) por **séries incrementais** memoizadas.

### 5.2 Camada de dados — robustez
- `lib/http/withRetry.ts` + `withTimeout.ts` genéricos, aplicados a OpenAI, TwelveData, Binance, news.
- **Rate limiting** (Upstash Redis ou tabela Supabase) em webhooks e admin.
- Mover jobs e consumo de crédito para **RPCs atômicos**.
- **Log estruturado + Sentry** (substituir `console.*`).

### 5.3 Camada de apresentação — componentização
- `components/charts/` com primitivos reutilizáveis: `RadialGauge`, `EquityCurve`, `DistributionCone`, `ProbabilityBar`, `ConfidenceBadge` (mostra n e IC).
- `AnalysisLayout` em grid colapsável; `SignalCard` com prop `compact`/`sticky`.
- Centralizar tokens (timeframes, níveis de sinal, locale) — hoje há `pt-BR` hardcoded e listas repetidas.

### 5.4 Saúde do repositório
- Resolver a pasta vazia `novo-sistema-trading/` (confunde) e a migration duplicada.
- Adicionar `vitest` + CI (type-check + lint + testes do motor) antes do go-live.

---

## 6. Inovações para desbancar o Vortex

Ordenadas por **impacto no fosso competitivo** (não por esforço):

### 🥇 Tier 1 — viram o jogo (alinhadas ao posicionamento)
1. **"Selo de Confiança Estatística"** em cada número: amostra (n), intervalo de confiança e período. Nenhum concorrente BR faz. Transforma a fraqueza atual no maior diferencial. *Ex.: "PF 3.82 — n=142 trades, IC 95% [2,1–5,3], jan/24–mai/26".*
2. **Probabilidades via Monte Carlo, não fórmula fechada** — defensável, e dá pra mostrar o "leque" de trajetórias.
3. **Backtest robusto de verdade** (≥12 meses, train/test, walk-forward honesto) + **selo verde só quando a amostra é suficiente**. Hoje o banner pode ficar verde com 100 trades.
4. **Modo Simples × Avançado** (decisão #6 do PROJECT.md): iniciante vê 1 sinal + 1 motivo; avançado abre as 15 camadas. Reduz o overload que hoje afasta o trader iniciante — público maior que o do Vortex.

### 🥈 Tier 2 — paridade visual + features que o Vortex tem
5. **Overlay no gráfico**: desenhar Order Blocks, FVGs, PRZ dos harmônicos e níveis SL/TP **no próprio chart** (lightweight-charts já está no projeto).
6. **Gauges e equity curve** (seção 4).
7. **Heatmap de horários ideais** (gap citado na VORTEX-ANALYSIS) — quando cada ativo tem melhor PF histórico.
8. **Roadmap público** — transparência também no produto.

### 🥉 Tier 3 — diferenciais que o Vortex não tem como copiar rápido
9. **Backtest sob demanda parametrizável** pelo usuário (escolher período, R:R, estratégia) — leva "transparência" ao extremo.
10. **Alertas inteligentes via Telegram** com a narrativa IA + o selo de confiança (PRO+ já tem o esqueleto).
11. **"Por que NÃO operar"**: explicitar quando o sistema recomenda ficar de fora (o Vortex sempre dá um sinal). Marketing: *"o único que te avisa quando não operar"*.
12. **Diário/journal de performance** do usuário casado com os sinais — retenção e prova social orgânica (alimenta os testimonials que faltam).

---

## 7. Roadmap sugerido (ordem de execução)

| Fase | Foco | Itens | Por quê primeiro |
|------|------|-------|------------------|
| **F0 — Higiene (1–2 dias)** | Bugs + segurança barata | Seção 1 inteira; rate limit webhooks/admin; timeout em getCandles; resolver migration duplicada | Risco/custo, visível ao usuário, baixo esforço |
| **F1 — Credibilidade (1–2 sem)** | Motor honesto | Backtest robusto; IC na sazonalidade; prob via Monte Carlo; selo de confiança; testes do motor | É o fosso competitivo real |
| **F2 — Conversão (1–2 sem)** | UX que vende | Grid colapsável + sticky signal; gauges; equity curve; modo Simples×Avançado | Aumenta conversão e reduz bounce |
| **F3 — Ataque (contínuo)** | Diferenciais | Overlay no chart; heatmap horários; "por que não operar"; roadmap público; journal | Distancia do Vortex |

> Sugestão: rodar **F0 + F1 antes de qualquer marketing pago**. Lançar com PF 3.82
> "pelado" (sem IC, backtest curto) é o maior risco reputacional do projeto — um
> único trader técnico postando "isso é cherry-pick" no Twitter neutraliza o pitch.

---

## 8. Decisões que preciso de você

1. **Refatorar incremental (recomendado) ou reescrever do zero?** A base é boa; reescrever joga fora valor.
2. **Por onde começo a executar?** Sugiro F0 (bugs + segurança) já, pois é barato e alguns são visíveis.
3. **Calibrar de verdade ou renomear "adaptive"?** Definir antes de prometer "adaptativo" no marketing.
4. **Modo Simples×Avançado entra no MVP de lançamento ou Sprint 11?**

---

*Documento gerado a partir de leitura direta de `engine.ts`/`types.ts` + três revisões
paralelas (quant, dados/segurança, frontend/UX). Próxima atualização após decisão de F0/F1.*
