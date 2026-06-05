# Checklists de validação por camada

Use o checklist da camada relevante. Para cada item, prefira um **caso analítico ou invariante** que comprove (independente da implementação) em vez de "li o código e parece certo".

## Indicadores técnicos
- Fórmula bate com a definição padrão (Wilder para RSI/ATR/ADX; EMA com seed = SMA dos N primeiros)?
- Invariantes: RSI de série estritamente crescente = 100; decrescente = 0. ATR de candles com range constante = esse range. Bollinger de série constante → bandwidth 0. MACD de série constante → histograma 0. Osciladores em faixa válida (Williams %R em [-100,0], Stoch em [0,100]).
- Divisão por zero protegida (high==low, volume 0, prev 0)?
- Voto separado do cálculo? Thresholds (RSI>60 etc.) no `config`, não hardcoded no cálculo?

## Monte Carlo
- GBM discretizado certo (log-returns; `price = current·exp(Σ(drift + σ·N(0,1)))`)?
- Ruído gaussiano correto (Box-Muller) e **determinístico via seed**?
- Volatilidade anualizada usa `periodsPerYear(assetType, timeframe)` — NÃO um `stepsPerYear` fixo?
- `winRateUp` sai com IC (Wilson)? Percentis P10/P50/P90 ordenados?
- Probabilidade de toque por **first-passage simulado** (não fórmula fechada)? Monótona (P(TP1) ≥ P(TP2) ≥ P(TP3))? Nível inalcançável → ~0?

## Backtest
- **Walk-forward sem lookahead**: o sinal em i usa só `candles[0..i]`? Saída sempre após a entrada?
- Janela suficiente (dimensionada por timeframe; mira meses de dados, não candles soltos)?
- Métricas com IC: winRate (Wilson), avgR (t-Student), profitFactor (bootstrap)?
- Win rate exclui BE/EXPIRED do denominador (só desfechos decisivos)?
- Cobertura reportada **sem cap silencioso** (candlesAvailable/Scanned/targetCandles/truncated)?
- `sampleSufficient` honesto? Determinístico (seed do bootstrap)?

## Sazonalidade
- Retorno médio com **t-CI** e winRate com **Wilson**, por mês?
- Flag `sufficient` (n ≥ mínimo)? Abaixo disso, diz "amostra insuficiente" em vez de cravar?
- Janela `recentYears` disponível (cripto antigo tem regime diferente)?
- `currentMonth` derivado do último candle (puro/determinístico), não de `Date.now()`?

## Cenários (compra/venda)
- Probabilidades vêm da simulação (com IC), não de reflection principle?
- **R esperado** substitui qualquer "score" com multiplicadores arbitrários?
- `recommended` = maior R esperado; `edge` ≥ 0; distância % com sinal correto por lado?

## SMC / Harmônicos / WEGD (M3)
- Parâmetros endurecidos e justificados (tolerância Fibonacci ≤ ~4%, não ±8%)?
- BOS/CHoCH confirmado por **fechamento**, não spike intraday?
- Rotulado como **"contexto qualitativo"** (não probabilidade dura)? Sem "strength 50" que o trader confunda com 50% de chance?
- Elliott/Gann/Wyckoff: afirmações com probabilidade/ressalva, não cravadas?

## Gates e sinal
- Thresholds no `config`, com nota se calibrados ou `[NÃO CALIBRADO]`?
- Contagem de gates consistente na explicação (usa `gates.length`, sem "/6" fixo)?
- Downgrade de sinal quando gates críticos falham é coerente?
- Confluência mínima é seletiva o suficiente (lembrar: 6/20 ≈ 58% por acaso num teste binomial)?

---

## Template — Parecer de feature (Modo 2)

```
## Parecer: <feature>
**Recomendação:** Fazer agora | Fazer depois | Não fazer | Fazer diferente
**Impacto no fosso (transparência/credibilidade):** alto/médio/baixo — porquê
**Aderência à audiência (trader cético BR):** alto/médio/baixo
**Esforço:** baixo/médio/alto
**Risco:** <regulatório / manutenção / overpromise>
**Como entregar com credibilidade:** <o jeito honesto>
**Métrica de validação:** <como saber se funcionou>
```
