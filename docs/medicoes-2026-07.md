# Medições custo-zero — Pacote B (06/07/2026)

Execução da seção **B** do plano da revisão dos 17 motores
([revisao-motores-2026-07-05.md](revisao-motores-2026-07-05.md)), seguindo os
**ajustes dos céticos** (lentes Quant e Risco). Tudo aqui é **read-only sobre os
motores**: nenhuma regra de emissão/resolução mudou; o que shipou de código são
instrumentos de medição (scripts offline, heat no Ringue do /admin e o modo
sombra k=3, que só grava metadado).

**Como reproduzir** (de `v2/apps/web`; os scripts carregam `.env.local` sozinhos):

```
pnpm run measure:concordance   # matriz de concordância dos 20 votos
pnpm run measure:gates         # bind-rate dos 8 gates (replay histórico)
pnpm run measure:regime        # run-length do regime (série de ADX)
pnpm run measure:breakeven     # contrafactual do BE pós-TP1 + heat (lê o banco)
```

Dados: Binance (cripto 4h/1d, até 11.000 candles ≈ 5 anos) e TwelveData
(XAUUSD/EURUSD/SPX 4h/1d, 2-3.000 candles). Replay incremental do próprio motor
(`precomputeBase`/`runAnalysisAt`, paridade garantida por `test/parity.test.ts`).

---

## 1) Matriz de concordância par-a-par dos 20 votos (achado 2, FASE 1)

**Amostra:** 9 casos (6 cripto 4h × 10.800 análises + 3 cripto 1d), ~72.500
análises; pares contados só onde AMBOS os votos são direcionais (n≥500).

**Resultado: a redundância é PIOR que a alegada.** 31 pares com concordância
≥90%; 6 pares em ~100%:

| Par | Concordância | n |
|---|---|---|
| EMA20 × RSI | 100.0% | 29.599 |
| EMA50 × RSI | 100.0% | 29.599 |
| RSI × CCI | 100.0% | 20.153 |
| VWMA20 × CCI | 100.0% | 28.220 |
| Stoch × W%R | 100.0% | 6.930 |
| W%R × Bollinger | 100.0% | 7.791 |
| RSI × ADX | 99.7% | 20.417 |
| CCI × ROC / CCI × MFI | 99.3% / 99.1% | 28.215 / 21.425 |

- **RSI (threshold 60/40) é indistinguível das médias móveis**: 100% de
  concordância com EMA20/EMA50/SMA50/VWMA20 quando opina. O rótulo
  'mean-reversion' dele no `TYPE_BY_NAME` está empiricamente errado (confirma o
  achado 1: vota momentum).
- **O grupo "mean-reversion" se auto-cancela por construção**: W%R e Bollinger
  concordam ~0% com RSI/CCI/MFI (semânticas opostas no MESMO grupo) e 100%
  ENTRE SI (fade). Há dois sub-blocos antagônicos dentro do mesmo multiplicador
  de regime.
- **Taxa de opinião**: 9 indicadores opinam ~100% do tempo (5 médias + MACD +
  AO + SuperT + TRIX + ROC); ATR opina 0% (só engorda o denominador da
  confluência — teto prático ~9, como o achado 6 apontou).
- Informação efetiva ≈ **3 blocos**: (i) drift de preço (médias + RSI/CCI/MFI/
  ROC/AO/MACD/ADX/TRIX, ~13 votos), (ii) fade de extremos (W%R + Boll + Stoch
  parcial), (iii) volume (OBV/CMF, concordância ~70% com o bloco 1).

**Decisão pré-registrada:** redundância confirmada ⇒ FASE 2 (achado 2) fica
habilitada — `familyConfluence` como CAMPO NOVO em shadow (sem mexer em gate).
Fica para o Pacote C.

## 2) Bind-rate dos 8 gates (achado 6, FASE 1)

**Amostra:** 49.000 análises em 11 casos (cripto 4h/1d + XAUUSD/EURUSD/SPX
4h/1d); "acionável" = BUY/SELL antes do downgrade (78,9% das análises).

| Gate | Pass geral | Pass acionável | Veredito |
|---|---|---|---|
| A Confluência mínima | 53.9% | 68.1% | **morde de verdade** (o downgrade é quase todo dele) |
| B Tendência (ADX) | 70.7% | 74.6% | morde |
| C Volume saudável | 70.8% | 72.2% | **artefato de dados** (ver abaixo) |
| D R:R mínimo | **100.0%** | **100.0%** | **tautologia CONFIRMADA em 49k análises** — nunca reprovou |
| E Volatilidade ativa | 95.4% | 96.1% | >95% — não filtra (exceto EURUSD 4h: 44%) |
| F Força mínima | 83.2% | 78.7% | reprova ~21% dos acionáveis (a faixa BUY 0.66–0.75 nasce reprovada — achado 6b) |
| G Regime adequado | 80.3% | 81.1% | morde (bloqueia transitional) |
| H Vol. não explosiva | 99.5% | 99.4% | >95% — decorativo (explosive é código ~morto, ver §3) |

- **Downgrade por gate crítico (A/D) em acionáveis: 31,9%** — e como D passa
  100%, o downgrade é ~100% do gate A. Com o epsilon do Pacote A o D deixou de
  rebaixar por ruído de float; esta medição confirma que ele nunca reprovaria
  por mérito (rr1 = tp1Mult/slMult = 1.5 por identidade).
- **Achado NOVO (gate C):** pass-rate **0%** em XAUUSD e EURUSD (4h e 1d) — o
  TwelveData não entrega volume para forex/metais spot (volume=0, e `0 > 0×0.7`
  é falso). Em SPX é ~100%. Ou seja: hoje o gate C não mede "volume saudável",
  mede "o provedor manda volume". Qualquer recalibração futura do C precisa
  tratar volume ausente como N/A, não como reprovação.
- E é ~100% em tudo menos EURUSD 4h (44%) — bandwidth mínimo 0.01 é grande
  demais para FX de vol baixa e irrelevante para cripto.

**Decisão pré-registrada:** D, E e H estouram o critério ">95% pass". A ação
(remover D de `CRITICAL_GATE_IDS`/da UI, RR estrutural como variante ~achado 12,
recalibrar E/H) fica para os Pacotes C/D — nada foi alterado agora.

## 3) Run-length do regime — série de ADX (achado 4, "medir antes de mudar")

**Amostra:** 7 casos (BTC/ETH/SOL 4h, BTC 1d, XAUUSD/EURUSD/SPX 4h), 2.906 runs.

| Regra | Run médio | Mediana | p90 | Runs <3 candles |
|---|---|---|---|---|
| Atual (ADX pontual 25/20) | **14.2 candles** | **7** | 38 | 15% |
| Histerese 25/20 (simulada) | 42.4 candles | 32 | 91 | 0% |

- **Benchmark de decisão: duração média do trade ≈ 38 candles.** O regime
  atual troca de rótulo ~2,7× dentro da vida de um trade típico (mediana 7!).
  O critério do cético ("só implementar se o run médio for materialmente menor
  que a duração do trade") é **atingido com folga** ⇒ a histerese só-entrada-
  25/saída-20 está empiricamente justificada (implementação = Pacote C, com
  era versionada).
- A histerese simulada triplica a persistência (42 candles) e zera os runs <3.
- **Explosive é código morto, confirmado**: 0,0–0,6% dos candles por mercado
  (0% em EURUSD 4h). Consistente com o gate H passando 99,5%.

## 4) Contrafactual do breakeven pós-TP1 (achado 7)

**Fonte:** tabela `signals` de produção (215 sinais, 61 resolvidos) + replay
com candles reais (cobertura: 33/61 — 28 não fecham a janela no replay porque
são recentes; 0 sem candles no provider).

- **Parte 1 (dados já gravados):** só **1** sinal com outcome TP1 até aqui — e
  ele morreu no breakeven (exit == entry, +0.5R). 100% dos TP1, mas n=1.
- **Parte 2 (replay pareado, regra atual vs "BE só após TP2"** — variante
  estrutural sem parâmetro novo, a menos overfitável):
  - avgR atual (replay): **−1.107R** · contrafactual: **−1.127R**
  - **ΔavgR = −0.020R · IC95 bootstrap [−0.061, 0.000] · n=33** — na amostra
    atual, TIRAR o breakeven seria (marginalmente) PIOR, não melhor.
  - Morte no BE coberta: 1 — não teria alcançado TP2 (viraria 1/3 TP1 + 2/3 SL).
- **Gate de amostra pré-registrado (≥30 mortes-no-BE): NÃO atingido (1).**
  Conclusão honesta: **não mexer na regra de breakeven agora** — o script fica
  no repo para repetir quando o forward acumular (o dado preliminar até defende
  a regra atual).

## 5) maxConcurrentHeat — exposição simultânea real (achado 9, camada 1)

**Shipped:** `computeHeat()` (sweep-line pura sobre `emitted_at`/`resolved_at`,
fonte única em `lib/signals/survival.ts`, com testes) + exposição no card do
Ringue do /admin (`Heat máx` / `Heat agora` por motor). **SEM regra de teto** —
diagnóstico apenas, nada é injetado no prompt dos `*_surv`.

**Medição em produção (06/07):**

| Motor | Heat máx | Posições no pico | Heat agora |
|---|---|---|---|
| classe_b | **120%** | 12 | 120% |
| classe | **110%** | 12 | 110% |
| padrao / padrao_b / consenso / contrario | 60% | 10 | 60% |
| llm_ds / llm_vsf | 45–55% | 9–11 | 45–55% |
| demais LLM/evo | 35–50% | 7–10 | 30–50% |

- **Gate pré-registrado: heat <15% mataria o achado; ≥20-40% ativa a camada 2.
  Observado: 35–120% — o gate ESTOUROU em todos os motores.** O motor classe
  chegou a ter 12 posições simultâneas = 110–120% da banca em risco aberto
  (aposta do gestor era 40–60%; a realidade é pior).
- Implicação: as "mortes" do Ringue medem cluster de correlação, não (só)
  habilidade — a **camada 2 (teto de heat)** deve entrar em pauta no próximo
  pacote, preferindo curva paralela 'equity com teto' ou corte por timestamp
  (nunca reescrever o replay canônico retroativamente).

## 6) Self-consistency k=3 em MODO SOMBRA (achado 18a)

**Shipped (instrumentação; dados chegam com o forward):**

- A emissão dos motores `llm` e `llm_ds` **não muda** (1 chamada, temp 0).
  Quando (e só quando) um sinal É emitido, k=3 amostras extras a **temp 0.7**
  são colhidas em paralelo (latência ≈ 1 chamada; custo ~centavos) com o MESMO
  system+fatos, e a concordância/dispersão vira metadado do sinal:
  `sc_k`, `sc_agree` (quantas concordam com o lado emitido), `sc_sides`
  (ex.: "BBN"), `sc_conv_spread` (máx−mín de convicção).
- **Migration 0017** (`0017_shadow_consistency.sql`) — best-effort: sem as
  colunas o update falha silencioso e nada quebra.
- **Hipótese pré-registrada:** sinais com convicção 60-65 E dissenso interno
  (`sc_agree < sc_k`) têm WR pior que os sem dissenso. Só vira filtro de
  emissão se confirmar com **≥100 resolvidos com metadado**. Escopo restrito a
  llm/llm_ds (controle limpo + custo mínimo); famílias surv/vsf/evo intocadas.

---

## Consolidação — o que as medições decidem

| Medição | Gate pré-registrado | Resultado | Próximo passo (fora deste pacote) |
|---|---|---|---|
| Concordância de votos | pares >90-95% ⇒ redundância real | **31 pares ≥90%, 6 em ~100%** | FASE 2: familyConfluence em shadow (Pacote C) |
| Bind-rate gates | pass >95% ⇒ gate não filtra | **D=100%, H=99.5%, E=95.4%** | tirar D dos críticos/UI + RR estrutural como variante (achado 12) |
| Run-length regime | run ≪ 38 candles ⇒ histerese | **14.2 (mediana 7) ≪ 38** | histerese 25/20 versionada como era (Pacote C) |
| BE pós-TP1 | ≥30 mortes-no-BE p/ decidir | **1 morte coberta; Δ=−0.02R [−0.06, 0.00]** | NÃO mexer; re-rodar o script com mais forward |
| Heat simultâneo | <15% mata / ≥20-40% ativa teto | **35–120% por motor** | camada 2 (teto) em pauta; curva paralela no Ringue |
| k=3 sombra | ≥100 resolvidos c/ metadado | instrumentado (migration 0017) | avaliar dissenso × WR quando acumular |

**Ressalvas honestas:** (a) cripto domina a amostra dos replays históricos —
XAUUSD/EURUSD/SPX têm 2-3k candles (limite do provider); (b) o gate C em
forex/metais mede ausência de volume do provider, não liquidez; (c) o
contrafactual do BE usa a janela por timeframe NOVA ({4h:60, 1d:25}) nos dois
braços — comparação interna consistente, mas não reproduz o outcome gravado sob
a janela antiga; (d) heat calculado na aproximação aditiva do sizing de entrada
(5%/10% por posição), a mesma pergunta que a camada 2 responderia.
