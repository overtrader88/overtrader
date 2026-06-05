# Princípios de credibilidade estatística

A régua que separa o TradeAI do concorrente. Use para julgar qualquer afirmação que o produto faça ao usuário.

## 1. Todo número estatístico precisa de n + IC + período
Win rate, profit factor, retorno médio, probabilidade, "acurácia" — sem amostra, intervalo de confiança e janela temporal, é opinião disfarçada de fato. O tipo `Estimate` existe para isso. Um decimal sozinho ("PF 3,82") é uma red flag.

## 2. Amostra pequena não vira veredito
- Proporções → **IC de Wilson** (nunca sai de [0,1]; honesto em n pequeno).
- Médias → **IC de t-Student**.
- Estatística sem fórmula fechada (ex.: profit factor) → **bootstrap**.
- Abaixo de um `n` mínimo, a resposta correta é **"amostra insuficiente"**, não um número bonito. O selo de qualidade só fica verde com o **limite inferior do IC** acima do limiar.

## 3. Sem lookahead
Backtest deve ser walk-forward: a decisão no instante t usa apenas dados até t. Qualquer uso de dado futuro infla resultado e destrói credibilidade. Avaliar barreiras intra-candle (HIGH/LOW) é aproximação aceitável — desde que declarada.

## 4. Probabilidade por simulação, não por fórmula frágil
Preferir estimar probabilidade de eventos (tocar TP/SL) **contando trajetórias simuladas** (first-passage) a usar aproximações fechadas que só valem sob hipóteses irreais (ex.: reflection principle com drift≈0). E reportar com IC.

## 5. Zero parâmetro mágico solto
Todo número que afeta uma decisão (peso, threshold, múltiplo de ATR, tolerância) vive no `config`, documentado. Se foi calibrado por evidência, diga como. Se é herdado/arbitrário, marque `[NÃO CALIBRADO]` — honestidade sobre o estado de maturação.

## 6. Determinismo = auditabilidade
Simulações usam seed injetável; o motor não usa `Date.now()` internamente. Mesma entrada → mesma saída. Sem isso não há teste golden nem "auditável".

## 7. Não confundir métrica com probabilidade
"Strength 50/100", "score 80" não são "50%/80% de chance". Se um rótulo pode ser lido como probabilidade sem ser, ou se renomeia, ou se converte em probabilidade real com IC.

## 8. Volatilidade/anualização respeita o mercado
Anualizar com o calendário certo (cripto 24/7 ≠ ações ~252 pregões). Constante única para todos os ativos é erro.

## 9. "Prova antes de prometer" no marketing também
Toda claim de venda (headline, comparativo) deve ser rastreável a um número defensável com método e amostra. Imitar promessa sem prova do concorrente destrói o único diferencial real.

## Frases-gatilho que o especialista deve confrontar
- "PF 3,82" sozinho → "Sobre quantos trades? Qual IC? Qual período?"
- "win rate 100% em março" → "n=? Wilson disso provavelmente é enorme."
- "a probabilidade de TP1 é 62%" → "Calculada como? Tem IC? Veio de simulação ou fórmula?"
- "esse peso é 1.3" → "Calibrado contra o quê? Está no config?"
- "o backtest deu ótimo" → "Quantos candles? Walk-forward? Cobriu quantos meses?"
