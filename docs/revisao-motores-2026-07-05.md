# Revisão de especialista dos 17 motores — 05/07/2026

**Método:** 5 revisores especialistas (quant, risco, prompts, execução, evolutivo) leram o
código real em paralelo; cada achado foi atacado por 2 céticos (anti-overfit + realista de
implementação). 30 achados → **22 confirmados** (com os ajustes dos céticos) + **8 plausíveis
não-verificados** (limite de sessão derrubou os céticos das lentes darwin/execução — o CONTEÚDO
está completo, falta só o ataque adversarial). Workflow run `wf_34b135bf-15b`; vereditos
integrais no transcript da sessão.

**Dados de contexto na época:** era nova (stop ×1.4) com ~30 resolvidos; era anterior: padrão
−8.84R E contrário −5.00R (whipsaw de geometria); EXPIRED ~20%; VSF ~lvl disparou 3/22;
régua de convicção zerou os STRONG.

**Plano recomendado:** A) consertar o JUIZ (bugs 1–7, afetam todos os motores igualmente);
B) medições de custo zero; C) experimentos como variantes novas; D) Darwin 2.0.

---

## 22 achados CONFIRMADOS (verificação adversarial completa)

### 1. [Quant/Estatístico] Incoerência semântica: RSI/CCI/MFI votam MOMENTUM mas são classificados como mean-reversion — o boost de regime amplifica a lógica errada

**Problema:** No motor de votação default (o que emite 'padrao'), RSI vota BUY quando >60 e SELL quando <40 (semântica de momentum/força), idem CCI (> +100 = BUY) e MFI. Mas o aggregate.ts classifica os três como 'mean-reversion' e multiplica por 1.4 em ranging e 0.5 em trending. Resultado: em LATERAL, o sistema dá peso 1.4 a votos de momentum (comprar força no topo do range — exatamente o que perde em ranging), e em TENDÊNCIA corta pela metade votos que estão alinhados à tendência. Pior: dentro do mesmo grupo 'mean-reversion' convivem semânticas opostas — quando RSI=65 (vota BUY), Williams %R está tipicamente > -20 (vota SELL) e Bollinger vota fade também: o grupo se auto-cancela por construção, puxando o ratio pra 0.5. A camada de regime é incoerente com a camada de voto — o multiplicador não escolhe 'a lógica certa por regime', só reescala ruído.

**Evidência:** votes.ts:68 (`vote: v.rsi14 > t.rsi.buyAbove ? "BUY"` com buyAbove=60 — momentum), votes.ts:86 (CCI > +100 = BUY), votes.ts:90 (Williams %R > -20 = SELL — fade, semântica oposta no MESMO grupo), aggregate.ts:29-34 (RSI/stoch/CCI/W%R/MFI/Bollinger todos 'mean-reversion'), config.ts:210-211 (ranging: meanReversion ×1.4). O conditional.ts:49 mostra que o time SABE a semântica certa (RSI<35 = BUY em ranging) — mas está desligado em produção (config.ts:227 `conditionalByRegime: false`).

**Proposta:** Tornar o voto sensível ao regime, não só o peso: em ranging, inverter os thresholds de RSI/CCI/MFI para semântica de fade (reusar os limiares do conditional.ts: oversold=35 compra, overbought=65 vende); em trending, manter momentum e reclassificá-los como 'trend' no TYPE_BY_NAME. Falsificável via runParamSweep: variante 'votos-por-regime' vs default, métrica PF OOS mediano + PF por regime (byRegime já existe no BacktestSummary).

**Ajuste dos céticos:** Ajuste mínimo: (a) NÃO tocar no motor padrao em produção — ele é o controle; testar apenas como variantes de backtest com gate e geometria idênticos. (b) Dividir em DUAS variantes separadamente falsificáveis: V1 = só reclassificar RSI/CCI/MFI (e Stoch, que vota crossover) como 'trend' no TYPE_BY_NAME (zero thresholds novos, corrige o rótulo para a semântica como implementada); V2 = V1 + inverter para fade em ranging reusando os limiares já existentes do conditional.ts (35/65) — proibido sweepar limiares novos. (c) Pré-registrar o critério de sucesso: PF OOS mediano ≥ default E PF em ranging (byRegime) melhorado, senão descarta. (d) Antes de implementar, olhar o forward do motor 'condicional' já vivo entre os 17 — ele usa exatamente a semântica de fade proposta e é evidência grátis a favor ou contra. (e) Reescrever o impacto alegado: coerência voto×regime é pré-condição para calibração de pesos fazer sentido, mas a causa dos −8.84R da era anterior era primariamente stop dentro do ruído (já mitigado com ×1.4) — não prometer que isso sozinho vira o WR.

---

### 2. [Quant/Estatístico] Pseudo-confluência: 11 dos 20 'votos' são a mesma transformação defasada do preço — confluência 6/10 é só um detector de tendência disfarçado

**Problema:** EMA20, EMA50, EMA200, SMA50, VWMA20 votam TODAS 'preço acima/abaixo da média' (5 votos de uma única informação: drift recente). Somando Supertrend, TRIX, MACD, ROC, Awesome e ADX direcional, são ~11 votos derivados do mesmo close series com lags diferentes. A métrica de confluência (aligned/20) e o gate A (mínimo 6/10 = 12 votos alinhados) tratam isso como evidência independente — qualquer tendência modesta passa o gate com folga, e o forward provou que isso não discrimina nada (padrão −8.84R com confluência 'suficiente' em todos). Um quant profissional riria: a informação efetiva aqui são ~3 fontes (momentum de preço, volume, volatilidade), não 20.

**Evidência:** votes.ts:59-63 (5 médias, todas `priceVote(last, ma)`), aggregate.ts:15-28 (13 indicadores classificados 'trend'), aggregate.ts:76-79 (confluence = contagem crua aligned/indicators.length), config.ts:234 (`minConfluence: 6`).

**Proposta:** Agrupar indicadores em FAMÍLIAS de informação (tendência-preço, oscilador-preço, volume, volatilidade) e computar 1 voto agregado por família (maioria interna), com confluência = famílias alinhadas / famílias com opinião. Alternativa mínima: cap de contribuição por família no ratio (ex.: máx 2.0 de peso somado). Validar comparando a correlação histórica entre votos (matriz de concordância par-a-par nos backtests — se EMA20 e SMA50 concordam >95% do tempo, são 1 indicador).

**Ajuste dos céticos:** Faseamento que preserva o desenho de experimento: FASE 1 (medição pura, zero mudança de produto) — rodar a matriz de concordância par-a-par entre os 20 votos nos backtests históricos; se EMA20/SMA50/VWMA20 concordam >95%, o diagnóstico fica quantificado. FASE 2 (shadow metric) — computar a confluência-por-família em paralelo e LOGAR em cada sinal emitido sem alterar gate nem ratio; após acumular resolvidos, medir se ela separa vencedores de perdedores no forward. FASE 3 (condicional ao poder discriminante comprovado na fase 2) — promover como variante de motor '_c' (mesmo padrão do padrao_b para stops) ou como mudança de era explícita e versionada, nunca como troca silenciosa da métrica compartilhada. Rejeitar a 'alternativa mínima' original (cap 2.0 de peso por família no ratio): muda o sinal de todos os motores de uma vez, com parâmetro arbitrário e sem shadow period.

---

### 3. [Quant/Estatístico] Gates sem dente na emissão: sinal que FALHA gate crítico é rebaixado para WEAK mas é carimbado no track record do mesmo jeito

**Problema:** Quando gate A (confluência) ou D (R:R mínimo) falha, run.ts rebaixa BUY→WEAK_BUY. Mas emitSignal só filtra por `signalSide()` (WEAK_BUY → 'buy') + selo verde/amarelo — não checa `isActionable()`. Ou seja: um sinal cujo próprio motor declarou 'R:R abaixo do mínimo' ou 'confluência insuficiente' entra no forward record com o MESMO plano ruim que motivou o rebaixamento. Agrava: gate D tem `!actionable ||` — sinal já-WEAK passa o gate D automaticamente, então a falha de R:R nunca é reavaliada. Os 8 gates viram narrativa de UI, não controle de risco: dos 8, só 2 são 'críticos' e mesmo esses não bloqueiam a emissão.

**Evidência:** analysis/run.ts:62-66 (downgrade para WEAK_*, mantém risk original), signal-levels.ts:26 (`signalSide(WEAK_BUY) === 'buy'`), signal-levels.ts:33 (isActionable exclui WEAK), emit.ts:32-36 (emitSignal checa só `side === 'neutral'` e selo — nunca isActionable), gates/index.ts:62 (`const rrOk = !actionable || risk.rr1 >= g.minRr1`).

**Proposta:** No emitSignal (e emitSignalB/contrario, que herdam a direção), exigir `isActionable(dto.analysis.signal.signal)` além do selo. Logar os bloqueados com reason='critical-gate' para medir quanto sinal é filtrado (honestidade estatística: o denominador importa). Verificar na base forward quantos dos 180 resolvidos da era anterior eram WEAK_* — se a fração for relevante, parte do −8.84R nem deveria ter sido emitida pelas próprias regras do motor.

**Ajuste dos céticos:** Ajuste mínimo em 4 pontos: (1) Marcar a era — bump de ENGINE_VERSION ou tag equivalente no registro, para que o forward pré/pós-filtro nunca se misture na mesma estatística (senão o denominador da família padrão muda no meio dos ~30 resolvidos da era nova e polui a comparação entre motores). (2) Aplicar simultaneamente a padrão, padrão-B e contrário no MESMO deploy — o contrário é controle pareado; filtrar um lado e não o outro quebra o pareamento (checar isActionable na direção ORIGINAL antes da inversão). Não tocar nos demais motores (classe, LLM, VSF, sobrevivência), que têm gates próprios de emissão. (3) Não apenas logar reason='critical-gate': gravar também um snapshot do plano bloqueado (shadow record fora do dedup, ou log estruturado com entry/stop/tp) — é a única forma de, daqui a 3-6 meses, medir se os gates A/D de fato têm poder preditivo em vez de só acreditar neles. (4) A verificação retroativa nos 180 da era anterior (direction é gravado como p_direction, então a query é viável) deve ser tratada como descritiva: reportar a fração WEAK_* e seu R, mas NÃO usar o resultado para recalibrar minRr1/minConfluence agora — recalibração de threshold com 180 resolvidos de uma era com stop já reconhecidamente quebrado (whipsaw dos dois lados) seria exatamente o overfit que o produto diz evitar.

---

### 4. [Quant/Estatístico] Regime: ADX(14) pontual sem histerese faz o regime chavear a cada run de 4h, e o ramo 'explosive' é praticamente inalcançável

**Problema:** O regime é decidido por UM valor de ADX no último candle contra limiares 25/20. ADX oscila em torno da fronteira por natureza (lag ~2×período), então mercados na zona 19-26 alternam trending/transitional/ranging entre runs consecutivos de 4h — e com isso o multiplicador de pesos (e o motor 'condicional' forward, que troca a lógica INTEIRA de momentum para fade) flipa junto. Já o ramo 'explosive' exige atrRatio ≥ 2.0, mas o numerador é ATR Wilder-suavizado (α=1/14) comparado à média dos últimos 50 valores DELE MESMO (o valor atual entra na média): dobrar isso exige explosão de vol sustentada por vários candles — na prática o ramo e seus multiplicadores {0.8, 0.3} são código morto, e o gate H quase sempre passa.

**Evidência:** regime/index.ts:22 (`adx(candles, 14)` — só o último valor), regime/index.ts:40-44 (cascata de limiares sem histerese nem confirmação), regime/index.ts:31-37 (atrAvg inclui o atrCurrent na janela de 50), config.ts:215-218 (adxTrending 25 / adxRanging 20 / atrExplosiveRatio 2.0, tudo [NÃO CALIBRADO]).

**Proposta:** 1) Histerese: entra em trending com ADX≥25 e só sai com ADX<20 (persistir o regime anterior no input ou derivá-lo da série de ADX dos últimos N candles — a série já é computada). 2) Confirmação: exigir 2-3 candles consecutivos no novo regime antes de trocar. 3) Explosive: usar percentil do True Range cru (ex.: TR atual > p95 dos últimos 100) em vez de razão de duas médias, ou deletar o ramo e o multiplicador morto. Falsificar medindo persistência: comprimento médio de run de regime por mercado antes/depois (se hoje for <3 candles em 4h, o regime atual é ruído).

**Ajuste dos céticos:** 1) MEDIR ANTES DE MUDAR: rodar primeiro a métrica de falsificação em dados históricos (comprimento médio de run de regime por mercado, sobre a série de ADX já computada) — custo zero, sem tocar na amostra forward. Só implementar se o run médio for materialmente menor que a duração média do trade (~38 candles é o benchmark relevante, não 3). 2) SÓ HISTERESE, SEM CONFIRMAÇÃO: implementar apenas a histerese (entra trending com ADX≥25, sai com ADX<20), derivada da série de ADX dos últimos N candles — mantém computeMarketRegime pura e determinística. Descartar a confirmação de 2-3 candles: é um segundo mecanismo anti-flip redundante com um parâmetro livre extra impossível de calibrar honestamente. 3) EXPLOSIVE: deletar o ramo e os multiplicadores mortos em vez de introduzir percentil de TR (p95 de 100 = dois novos parâmetros não calibrados). Atenção ao efeito colateral não mencionado na proposta: sem o ramo explosive, o gate H (gates/index.ts:104) fica decorativo — remover ou documentar explicitamente junto. 4) DESENHO DE EXPERIMENTO: versionar como nova era (flag/timestamp), aplicar simultaneamente a todos os 17 motores, e logar o rótulo de regime em cada sinal emitido para permitir a auditoria antes/depois da persistência do rótulo. Não recalibrar os limiares 25/20 agora — são padrão de literatura e qualquer ajuste com 30 resolvidos seria overfit.

---

### 5. [Quant/Estatístico] Harness de calibração pronto mas produção roda 100% com números herdados do v1 — e o runParamSweep, quando rodar, seleciona por argmax de PF OOS (receita de overfitting)

**Problema:** Existe infraestrutura séria (runCalibrationSweep, runParamSweep, split OOS, IC de PF, scripts calibrate-*.ts) — mas o DEFAULT_ENGINE_CONFIG inteiro segue marcado [NÃO CALIBRADO], conditionalByRegime=false e os 3 filtros de confluência DESLIGADOS (macroAlign:false, volumeConfirm:false, minAgree:1) enquanto o forward sangra. E a metodologia do sweep tem um vício: ordena variantes por mediana de PF OOS e implicitamente convida a escolher a melhor — com dezenas de variantes sobre o MESMO split OOS único (30% final), o vencedor é em parte sorte e vai regredir no forward (multiple comparisons; o próprio DeepSeek inflando convicção já mostrou como métrica única engana). Não há penalidade por nº de trades, dispersão entre casos, nem walk-forward.

**Evidência:** config.ts:10 ('Não trate nenhum número aqui como final' — escrito no M0, ainda verdade), config.ts:226-231 (filters todos off), calibration/index.ts:163-191 (runParamSweep: `results.sort((a,b) => b.oosPfMedian - a.oosPfMedian)`, split OOS único via oosFraction, sem correção de multiplicidade), config.ts:121 (`oosFraction: 0.3` — um único holdout).

**Proposta:** 1) Regra de seleção '1 erro-padrão': entre variantes cujo PF OOS mediano fica a 1 SE do melhor, escolher a de MENOS parâmetros alterados / mais trades decisivos (adicionar `oosPfIqr` e `totalDecisive` ao ParamVariantResult). 2) Walk-forward com 3+ janelas OOS em vez de 1 holdout. 3) Pré-registrar no repo (arquivo versionado) as variantes ANTES de rodar — mesma disciplina do forward A/B que vocês já praticam. 4) Quando um vencedor sobreviver, promovê-lo ao config com bump de ENGINE_VERSION para o track record segmentar eras.

**Ajuste dos céticos:** 1) Sequenciar: primeiro os itens baratos — adicionar oosPfIqr e totalDecisive ao ParamVariantResult, formalizar NA BIBLIOTECA (runParamSweep) o filtro de robustez que hoje só existe nos scripts (positivo em todos os casos cobertos), e pré-registro versionado das variantes antes de rodar. 2) Definir a regra 1-SE concretamente: SE da mediana estimado via IQR/1.35/sqrt(n_casos) ou bootstrap sobre os casos; empate dentro de 1 SE resolve por menos parâmetros alterados e maior totalDecisive. 3) Walk-forward só com gate de suficiência por janela: exigir mínimo de trades decisivos por janela OOS (ex.: >=30); se o histórico não sustenta 3 janelas, cair para 2 janelas ou holdout único com a exigência extra de PF OOS positivo em ambas as metades do próprio holdout — nunca reportar PF de janela subamostrada. 4) Manter o item 4 como está (promoção com bump de ENGINE_VERSION).

---

### 6. [Quant/Estatístico] Métricas internas inconsistentes: confluência crua vs ratio ponderado, gate F incoerente com a escala de níveis, gate C que passa quase sempre

**Problema:** Três incoerências que corroem a leitura quantitativa: (a) a DIREÇÃO vem do ratio PONDERADO, mas a confluência conta votos CRUS e inclui no denominador indicadores estruturalmente neutros (ATR vota NEUTRAL sempre; ADX vota neutro sob 25) — o teto prático de confluência é ~9, e o número que o gate A compara não mede a mesma coisa que decidiu o sinal; (b) gate F exige strength ≥ 50, que implica ratio ≥ 0.75, mas 'BUY' começa em ratio 0.655 — todo BUY na faixa 0.66-0.75 nasce reprovado no gate F por construção (gate que reprova uma classe inteira de sinais válidos da própria escala não é gate, é bug de threshold); (c) gate C ('volume saudável') passa com volume recente até 30% ABAIXO da média (avg10 > avg30×0.7) — um gate que quase nunca falha é ruído na UI e falsa sensação de checagem.

**Evidência:** aggregate.ts:70-79 (ratio ponderado decide, confluence = aligned/indicators.length cru), votes.ts:130 (ATR: `vote: "NEUTRAL"` sempre no denominador), levels.ts:13-14 (BUY em ratio >0.65) vs aggregate.ts:73 + config.ts:237 (strength=|ratio-0.5|×200, minStrength 50 ⇒ ratio 0.75), gates/index.ts:53 (`avg10 > avg30 * 0.7`).

**Proposta:** 1) Confluência ponderada: aligned_weight / total_directional_weight, excluindo indicadores sem opinião do denominador. 2) Alinhar minStrength à fronteira de BUY (strength ≥ 30 ⇔ ratio ≥ 0.65) ou redefinir a régua — decidir e documentar. 3) Auditar bind-rate de TODOS os gates no histórico forward (query simples: % de análises em que cada gate falhou); gate com pass-rate >95% é recalibrado ou removido. Falsificável: publicar a tabela de bind-rates no /admin.

**Ajuste dos céticos:** Ordem obrigatória: (1) rodar o audit de bind-rate PRIMEIRO (read-only, zero risco), medindo o critério '>95% pass' sobre o histórico completo de análises, não sobre os 30 resolvidos; (2) só então trocar a fórmula da confluência (aligned_weight/total_directional_weight, excluindo indicadores estruturalmente neutros do denominador), gravando spec_version/era em cada sinal emitido para nenhuma agregação forward misturar eras silenciosamente; (3) gate F: tratar como consistência definicional — alinhar minStrength à fronteira da própria escala (30 ⇔ ratio 0.65) — com proibição explícita de escolher o valor consultando o WR da amostra forward atual (senão vira fitting em n=30); atenção à interação com o downgrade que seta strength=min(strength,50) em run.ts:64, hoje colado acidentalmente ao limiar de F; (4) não remover/recalibrar gate C antes do bind-rate medido; (5) corrigir a retórica do item (b) na documentação: F é não-crítico e hoje não reprova sinal na prática — o problema é honestidade da régua exibida, não sinais bloqueados.

---

### 7. [Gestor de Risco] Geometria do ciclo de vida: o ganho modal é +0.5R contra perda cheia de −1R — o breakeven após TP1 recria o whipsaw um andar acima

**Problema:** Com terços e RRs da casa (slMult 1.2 / tp 1.8-3.0-4.5 → RR 1.5/2.5/3.75), os desfechos possíveis são: SL = −1.00R, TP1→stop breakeven = +0.50R, TP2→stop no TP1 = +1.83R, TP3 = +2.58R. O desfecho 'vencedor' mais provável (TP1 e reversão ao entry) paga METADE do que a perda cheia custa: precisa de >66% de acerto só para empatar se a maioria dos wins morrer no breakeven. Pior: mover o stop para o entry exato assim que TP1 bate (1.8×ATR, ou 2.52×ATR nos motores ×1.4) em cripto 4h é convidar o retest do entry a fechar os 2/3 restantes em zero — é a mesma doença da era 1 (stop dentro do ruído), só que no segundo estágio. E o placar rotula esse +0.5R como 'TP1' (win), inflando WR sem inflar R.

**Evidência:** C:/dev/tradeai/t_a_der/v2/packages/engine/src/track-record/index.ts:169-173 (`stage = 1; stop = entry; stopStage = "breakeven"`) + config.ts:220-225 (slMult 1.2, tp1 1.8 → RR1=1.5, logo 1/3×1.5 = +0.5R travado).

**Proposta:** Falsificável com dados que você já grava: os sinais fechados como TP1 com exit_price == entry são exatamente as mortes no breakeven (stop_stage='breakeven'). Meça a fração deles e o MFE posterior (quantos teriam chegado ao TP2 se o stop fosse entry − 0.25×risco). Se >40% dos TP1 morrem no BE e uma fração relevante alcançaria TP2, troque a regra: breakeven só após TP2, ou BE com folga (entry − 0.25R para compra), versionado no engineVersion como as mudanças anteriores.

**Ajuste dos céticos:** Ajuste mínimo em 4 pontos: (1) O critério de decisão deve ser a expectância contrafactual COMPLETA (ΔavgR com IC via bootstrap, como já se faz em aggregateTrackRecord), não apenas ">40% dos TP1 morrem no BE + fração alcançaria TP2" — afrouxar o stop também converte alguns +0.5R em +0.333R (2/3 stopados a entry−0.25R) e reabre parcialmente o whipsaw da era 1; medir os dois lados. (2) Rodar o replay contrafactual sobre TODO o histórico de sinais (incluindo os 180 da era anterior, recomputados), segmentando EXPIRED fora — a amostra do diagnóstico deixa de ser 30. (3) Não tunar o buffer 0.25R nos mesmos dados: pré-registrar o valor OU preferir a variante estrutural sem parâmetro novo (breakeven só após TP2), que é a menos overfitável das duas. (4) Aplicar a mudança engine-wide (todos os motores, geometria idêntica) com bump de engineVersion, preservando o desenho controlado; e, independente do resultado, passar a reportar WR/avgR quebrados por outcome (TP1-BE vs TP1-cheio) — a correção de leitura vale sozinha. Nota: a citação correta dos multiplicadores é v2/packages/engine/src/config.ts:220-225, não track-record/config.ts.

---

### 8. [Gestor de Risco] buildVsfPlan rejeita o plano quando o nível MAIS PRÓXIMO falha o guarda-corpo, mesmo existindo nível válido mais fundo — por isso só 3/22 dispararam

**Problema:** O código escolhe primeiro o nível protegido mais próximo do preço (`Math.max(...levels)` para compra) e SÓ DEPOIS valida a distância em [0.6, 2.5] ATR. Se o suporte mais próximo está a 0.3 ATR (comum: VAL ou order block colado no preço), o plano inteiro é descartado e cai no fallback ATR — mesmo quando há um segundo nível a 1.2 ATR que passaria no guarda-corpo. O guarda-corpo não está 'apertado demais'; ele está sendo aplicado ao candidato errado. Resultado: o stop por nível — a única inovação estrutural da era nova — quase nunca roda (3/22), e o experimento ~lvl vs ~a14fb não acumula amostra.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:266-271 — `const stopLoss = side === "buy" ? Math.max(...levels) - buffer : ...; const dist = Math.abs(entry - stopLoss); if (dist < atrVal * 0.6 || dist > atrVal * 2.5) return null;`

**Proposta:** Inverta a ordem: primeiro filtre `levels` para os que, com o buffer de 0.25 ATR, caem em [0.6, 2.5] ATR do entry; depois escolha o mais próximo entre os VÁLIDOS. Três linhas: `const valid = levels.filter(l => { const d = Math.abs(entry - (side==='buy' ? l - buffer : l + buffer)); return d >= atrVal*0.6 && d <= atrVal*2.5; })`. Versione como ~lvl2 para não contaminar a amostra ~lvl.

**Ajuste dos céticos:** Três ajustes mínimos: (1) Instrumentar o motivo da rejeição — distinguir no fallback 'sem nível' (linha 266) de 'guarda-corpo rejeitou tudo' (pós-filtro), ex.: tags ~a14fb-nolvl vs ~a14fb-gc no engineVersion ou log estruturado. Isso valida (ou refuta) o mecanismo alegado com os próprios dados forward. (2) Pré-registrar a predição antes do deploy: se a causa dominante for o guarda-corpo aplicado ao candidato errado, a taxa de disparo do ~lvl2 deve subir materialmente (ex.: >50% dos VSF); se não subir, a hipótese estava errada e não se mexe nos bounds como 'segunda tentativa'. (3) No filtro, computar a distância exatamente como o stop final será computado (nível ± buffer, mesmo sinal por lado) — o snippet proposto já faz isso; manter, e escolher o mais próximo entre os válidos (minimiza distância do stop e portanto dos alvos, mitigando o risco de EXPIRED). Versionar como ~lvl2 conforme proposto e comparar ~lvl2 vs ~a14fb daqui pra frente; a amostra ~lvl (n=3) é descartável.

---

### 9. [Gestor de Risco] replayBank finge que os trades são sequenciais: 12 mercados correlacionados abertos ao mesmo tempo = heat de até 60% da banca, e o risco de ruína está subestimado por um fator grande

**Problema:** A banca aplica 5%/10% por trade em ordem de resolved_at, como se um trade fechasse antes do próximo abrir. Na prática o motor pode ter até 12 posições simultâneas (dedup é 1 por mercado+motor, e são 12 mercados), e os mercados NÃO são independentes: os pares cripto 4h/1d são quase o mesmo trade (beta BTC), e um dia risk-off derruba cripto, SPX e XAUUSD juntos. Heat simultâneo de 8 posições correlacionadas a 5% = ~34% de queda num único evento (0.95^8), a um passo do piso 33. As 'mortes' da banca vão medir clusters de correlação, não habilidade do motor — e o feedback injetado no prompt dos motores *_surv vai ensinar a LLM a reagir a um risco que o próprio sistema calculou errado.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/survival.ts:29-46 — `replayBank` itera `trades` resolvidos um a um (`equity = equity * (1 + t.pnlR * survFraction(...))`) sem noção de sobreposição temporal; RISK_NORMAL=0.05 na linha 11 é por trade, sem teto de exposição agregada.

**Proposta:** Duas camadas: (1) diagnóstico — o replay já tem emitted_at/resolved_at no banco; compute o heat máximo simultâneo (soma dos riscos das posições abertas em cada instante) e exponha em BankState como `maxConcurrentHeat`; (2) regra — teto de heat de carteira (ex.: 20% da banca em risco aberto por motor): quando estourar, o sinal novo é emitido para o track record mas com risco 0 na banca (ou reduzido pro rata). Falsificável: se o heat máximo observado for <15%, o achado morre; se for 40-60% (aposto que é, com 12 mercados e onda a cada 4h), a probabilidade de morte por cluster domina.

**Ajuste dos céticos:** Fatiar: (1) SHIP AGORA só a camada 1 — computar maxConcurrentHeat (soma dos riscos abertos por instante, usando emitted_at/resolved_at; calcular também a variante aditiva no sizing de entrada) e expor em BankState/Ringue como diagnóstico, SEM injetar no prompt dos *_surv ainda (não ensinar a LLM a reagir a um número que ainda não foi validado). (2) Camada 2 fica GATED no resultado do diagnóstico (só se heat máximo observado ≥ ~30%) e, se ativada: pro rata (escalar as frações dos trades sobrepostos para a soma ≤ teto) em vez de risco-0, aplicada identicamente aos 17 motores, com marcador de era/versão de regra da banca para que vidas antigas e novas nunca sejam comparadas na mesma série. (3) Corrigir o framing: o achado honesto é "atribuição de morte (cluster vs habilidade) + sizing irrealista", não "ruína escondida por fator grande" — o replay já registra as perdas do cluster no ponto final. Bônus barato dentro da camada 1: registrar se o piso 33 é violado intra-cluster em mark-to-market (hoje invisível ao replayBank).

---

### 10. [Gestor de Risco] EXPIRED a 20% é aritmética, não mistério: o ×1.4 esticou os alvos junto com o stop (TP3 = 6.3 ATR) mas a janela ficou em 60 candles — e é a MESMA janela para 4h e 1d

**Problema:** buildClassPlan multiplica o ATR inteiro (`atrVal = atrBase * atrScale`) antes do computeRiskFrom, então o ×1.4 não alargou só o stop: TP1 foi de 1.8→2.52 ATR e TP3 de 4.5→6.3 ATR. Tempo até alvo cresce ~quadraticamente com a distância; a janela de expiração continuou 60 candles. Duração média 38 candles com teto 60 significa que a cauda da distribuição está sendo decapitada — EXPIRED elevado é o plano não caber na janela, por construção. Agravante: MAX_DURATION=60 é fixo por candle, não por tempo — 60 candles em 4h são 10 dias, em 1d são ~3 MESES, e o dedup (1 sinal aberto por mercado+motor) deixa o slot do mercado sequestrado esse tempo todo.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/analysis/engines.ts:36 (`atrVal = atrBase * atrScale` escala stop E alvos) + emit.ts:218 (LLM_ATR_SCALE=1.4) + app/api/cron/resolve-signals/route.ts:25 (`const MAX_DURATION = 60` único, sem distinção de timeframe).

**Proposta:** Com os ~30 resolvidos + os 180 da era anterior, plote tempo-até-TP1/TP2 em candles: fixe a janela no p90 do tempo-até-TP2 por timeframe (mapa `{ '4h': 60, '1d': 25 }` no route.ts é mudança de 3 linhas). Em paralelo, encolha o plano para caber: tp3Mult 4.5→3.5 (TP3 vira 4.9 ATR com ×1.4). O ponto de gestor: tempo-stop é decisão de trade — o mark-to-market no close que vocês já fazem está certo, mas 20% dos desfechos decididos pelo relógio arbitrário (e não pela tese) é o relógio operando o sistema.

**Ajuste dos céticos:** Implementar SOMENTE a janela por timeframe (mapa { '4h': 60, '1d': N } no route.ts), com três guardas: (a) derivar N do equivalente em tempo de parede e/ou do backtest histórico já existente no repo (tempo-até-TP2 em candles de 1d sobre anos de dados), NÃO do p90 dos ~30 resolvidos forward — algo entre 15 (equivalência ~10 dias + folga) e 25 é defensável a priori; (b) aplicar só prospectivamente: sinais já emitidos resolvem pela regra antiga (ou marcar era/resolver_version na linha do sinal) para não redefinir outcome retroativamente e preservar comparabilidade; (c) NÃO mexer em tp3Mult agora — registrar como hipótese separada e só testá-la depois de ~100 resolvidos na era nova, se o EXPIRED residual pós-janela continuar alto. Assim muda-se uma variável por vez, o EXPIRED que sobrar vira sinal limpo, e os slots de dedup do 1d são liberados sem tocar na geometria em R que o experimento atual mede.

---

### 11. [Gestor de Risco] Preenchimentos de fantasia: saída sempre ao preço exato do stop/alvo e entrada sempre ao preço de emissão — gaps de fim de semana em SPX/XAUUSD/EURUSD e pavios de cripto pagam melhor no modelo que na vida real

**Problema:** resolveLifecycle assume execução perfeita: se o candle cruzou o stop, o exit é registrado NO stop (−1.00R exato), mesmo que o candle tenha ABERTO abaixo dele (gap through) — na vida real a perda é maior que 1R. Simetricamente, a entrada é assumida no preço de emissão (s.entry) mesmo que o primeiro candle futuro abra longe. Para SPX/XAUUSD/EURUSD (fecham no fim de semana, 3 dos 12 mercados) e para cripto em movimento violento, isso enviesa o track record para cima exatamente nos piores momentos — o produto que jura 'prova antes de prometer' está publicando Rs que ninguém conseguiria executar. Um profissional olha o −1.00R cravado em série e sabe na hora que não há slippage no modelo.

**Evidência:** C:/dev/tradeai/t_a_der/v2/packages/engine/src/track-record/index.ts:151-154 — `if (hitStop(c, stop)) { realizedR += (1 - closed) * rOf(stop); ... return finish(outcome, j, stop); }` usa sempre o preço do stop, nunca `c.open`; route.ts:70-75 monta o plano com `entry: s.entry` sem checar o open do primeiro candle futuro.

**Proposta:** Gap-aware fill, ~6 linhas no resolveLifecycle: no início de cada candle, se `c.open` já está além do stop (compra: open < stop), sair a `c.open` e não a `stop`; idem para alvos (sair a open quando open > tp, o que REDUZE o R do alvo? não — melhora; o conservador é: gaps contra pagam pior, gaps a favor pagam o alvo, não o open). Backfill é auditável: dá para reprocessar os resolvidos e publicar o delta de R ('nosso modelo antigo superestimava X R').

**Ajuste dos céticos:** Implementar apenas o lado da SAÍDA: no início de cada candle, se c.open já ultrapassou o stop vigente (inicial OU elevado), sair a c.open; se c.open já ultrapassou um TP, pagar o preço do TP (nunca o open — sem crédito de gap a favor). Aplicar em resolveLifecycle E resolveOutcome para manter o pacote consistente (simulador/monitor/digest/paper herdam automaticamente). Adiar o fill de entrada: nesta mudança só registrar o gap de entrada (open do 1º candle futuro vs s.entry) como coluna/métrica diagnóstica e decidir depois, com dados, em experimento separado. Backfill único e determinístico dos resolvidos, mesmo modelo para todos os motores, publicando o delta de R e rotulando a era (sem misturar com a mudança do stop ×1.4 nem com a régua do DeepSeek). Adicionar testes em track-record.test.ts: gap através do stop inicial, gap através do stop elevado (breakeven e tp1), open além do tp3, e o caso sell simétrico — nenhum coberto hoje.

---

### 12. [Gestor de Risco] O gate minRr1 é uma tautologia: rr1 = tp1Mult/slMult = 1.5 por construção, então o 'filtro de qualidade' nunca reprovou um sinal na vida

**Problema:** computeRiskFrom deriva stop e alvos do MESMO ATR pelos MESMOS múltiplos fixos: rr1 = 1.8/1.2 = 1.5 sempre, para qualquer ativo, regime ou volatilidade. O gate `minRr1: 1.5` compara 1.5 >= 1.5 — passa 100% das vezes, por identidade algébrica. E o buildVsfPlan preserva os ratios por construção (`k = dist / slMult`), então também lá o RR é constante. Ou seja: o sistema não tem NENHUMA medida de RR real — a pergunta 'há espaço até a próxima resistência antes do meu alvo?' nunca é feita. O TP1 pode estar 0.1 ATR além do VAH/order block oposto e o sinal sai igual, com 'RR 1.5' carimbado.

**Evidência:** C:/dev/tradeai/t_a_der/v2/packages/engine/src/risk/index.ts:51-53 (`rr1 = distTP1 / distSL` com ambos derivados do mesmo atrVal × múltiplos fixos) vs config.ts:236 (`minRr1: 1.5`) — razão constante 1.8/1.2 = 1.5 comparada a limiar 1.5.

**Proposta:** Defina RR estrutural: distância do entry até o primeiro nível OPOSTO relevante (order block contrário / liquidez / VAH-VAL — os mesmos dados que buildVsfPlan já lê do dto) dividida pela distância do stop. Gate real: RR_estrutural >= 1.5 ou o sinal não sai (ou sai com alvos encolhidos até o nível). Falsificável imediatamente: rode retroativo nos 180+30 resolvidos e compare avgR dos sinais que passariam vs os que seriam vetados.

**Ajuste dos céticos:** Três passos, nessa ordem: (a) Corrigir JÁ o bug do gate D — a comparação risk.rr1 >= minRr1 com rr1 sujeito a float noise rebaixa ~33% dos sinais aleatoriamente; fix mínimo: comparar com epsilon (rr1 >= minRr1 - 1e-9) ou computar rr1 como tp1Mult/slMult direto. Isso sozinho muda o comportamento observado dos motores padrão/classe e deve ser registrado como marco de era. (b) Implementar RR estrutural em MODO SOMBRA: calcular a distância entry→primeiro nível oposto (order block contrário/liquidez/VAH-VAL do dto, mesmos dados do buildVsfPlan) dividida por distSL, e apenas LOGAR o valor em cada sinal emitido, sem vetar nada. Definir explicitamente: sem nível oposto no dto ⇒ RR_estrutural = null (não bloqueia, não conta). (c) Rodar o retroativo nos 180+30 resolvidos (recomputando níveis no candle de emissão, sem lookahead) E acumular forward em sombra; só promover a veto ativo quando avgR(passaria) − avgR(seria vetado) for material com n razoável (≥50 resolvidos com nível disponível de cada lado). DESCARTAR a variante 'alvos encolhidos até o nível' — muda a geometria por sinal e destrói a comparabilidade de R entre motores. Se promovido, o veto deve ser uniforme em todos os motores para preservar o experimento controlado.

---

### 13. [Engenharia de Prompts/LLM] O JSON força a decisão ANTES do raciocínio — o 'racional de 1 frase' vem tarde demais para ajudar

**Problema:** O schema exigido é {"lado","conviccao","racional"} nessa ordem. Num modelo autoregressivo, os tokens de 'lado' e 'conviccao' são emitidos ANTES de qualquer token de raciocínio — o racional vira justificativa post-hoc, não deliberação. Com max_tokens 200, response_format json_object e thinking DESLIGADO na DeepSeek, nenhum dos 8 motores LLM tem um único token de espaço para pesar prós e contras antes de cravar direção e número. É o clássico erro de pedir a resposta antes do raciocínio.

**Evidência:** narrative.ts:112 ('Responda EXCLUSIVAMENTE em JSON válido: {"lado":...,"conviccao":...,"racional":"1 frase curta"}'), narrative.ts:185-187 (temperature 0, max_tokens 200, json_object), narrative.ts:92-98 (DeepSeek: thinking disabled explicitamente para caber nos 200 tokens).

**Proposta:** Inverter a ordem dos campos e abrir espaço de deliberação: {"analise":"3-5 frases pesando confluências a favor e CONTRA","lado":...,"conviccao":...} com max_tokens ~400. O campo 'analise' vira o rationale persistido (hoje truncado em 240 chars mesmo). Na DeepSeek, alternativa equivalente: reabilitar thinking com budget e max_tokens maiores. Custo marginal: centavos. Falsificável: A/B forward llm vs llm com analise-first, mesmos gates.

**Ajuste dos céticos:** Ajuste mínimo: (1) implementar como VARIANTE nova ao lado da atual (ex.: llm_cot vs llm, mesmo provider, mesmos gates/geometria/dedup), sem tocar os 8 motores existentes — preserva a baseline da era nova; (2) uma variável por vez: manter thinking da DeepSeek desligado no primeiro A/B (analise-first via prompt nos dois providers, simetria de protocolo); (3) guardar contra truncamento: checar finish_reason === 'length' e logar/contar falhas de parse por motor em vez do null silencioso, com max_tokens ~450-500 de folga; (4) pré-registrar o critério de decisão do A/B (ex.: avaliar só após ≥100 resolvidos por braço, comparar expectancy em R e calibração de convicção, não WR isolado) e tratar o rationale-para-autópsia como o entregável imediato, não a assertividade.

---

### 14. [Engenharia de Prompts/LLM] toDecisionFacts não tem NENHUM candle recente nem contexto de horário — o motor decide sem ver o gráfico

**Problema:** Os fatos entregam votos de indicadores, viés SMC, score multi-TF e macro — tudo OPINIÃO derivada — mas zero price action bruto: nenhum OHLC dos últimos candles, nenhuma medida de chop (ex.: range dos últimos 20 candles em ATR), nenhum timestamp/sessão (Ásia/Londres/NY, fim de semana em cripto, véspera de payroll). A era anterior provou que o regime dominante era whipsaw (padrão −8.84R E contrário −5.00R): serrote é exatamente o que indicadores agregados escondem e que 15 candles crus mostrariam. O dto tem sessions/seasonality calculados (full.ts:38-39) e nada disso chega ao prompt.

**Evidência:** narrative.ts:151-172 (toDecisionFacts: só indicadores/votos, smc.bias, mtf.score, macro — sem candles, sem hora, sem data); full.ts:22-52 (FullAnalysis nem carrega OHLC recente no DTO, então o gap é estrutural).

**Proposta:** Adicionar aos fatos: (a) candles_recentes — últimos 12-20 OHLC normalizados em ATR ou % vs close (compacto, ~300 tokens); (b) compressao: range dos últimos 20 candles ÷ ATR (número único que denuncia serrote); (c) contexto_tempo: hora UTC, sessão ativa, dia da semana. Instruir: 'range comprimido e sem rompimento confirmado → neutro'. Requer threadar os candles até toDecisionFacts (a borda já os tem).

**Ajuste dos céticos:** Ajuste mínimo, em ordem de prioridade: (1) Adicionar SÓ os escalares objetivos primeiro: compressao_range20_atr (número único) e contexto_tempo (hora UTC, sessão, dia da semana) — baratos, não-opinativos, sem risco de parsing. (2) OMITIR a regra 'comprimido → neutro' do prompt na primeira iteração: deixe o dado falar; se quiser a regra, ela é uma segunda mudança a ser testada separadamente (senão você nunca sabe se o edge veio do dado ou da regra). (3) Candles crus: opcional e enxuto — máx. 12, normalizados em ATR e arredondados a 2 casas; medir custo/latência antes de expandir. (4) OBRIGATÓRIO: versionar os fatos — gravar facts_version (ou prompt_hash) na linha do sinal e tratar a mudança como nova era no dashboard forward, como já foi feito na troca de stop ×1.0→×1.4; sem isso a mudança quebra o desenho controlado. (5) Aplicar de uma vez a todos os consumidores de toDecisionFacts (inclusive evo_ e Conselho) na mesma data; NÃO tocar toLevelsFacts — o VSF é por desenho um motor só-níveis e serve de contraste. (6) Não esperar milagre nos ~30 resolvidos atuais: o veredito real vem com ~100+ resolvidos na nova versão de fatos.

---

### 15. [Engenharia de Prompts/LLM] Régua de convicção sobre-corrigiu: convicção virou constante, STRONG está morto e o experimento de sizing 5%/10% degenerou

**Problema:** A régua manda 'a maioria deve cair em 60-69' e o gate corta <60: a faixa útil colapsou em ~10 pontos, com 0 sinais ≥80 na era nova (antes eram 95-100%). Consequências: STRONG_BUY/SELL nunca dispara; nos motores de sobrevivência a aposta de 10% nunca ativa (o experimento 5% vs 10% não produz dado); e 'conviccao' deixou de carregar informação — foi de enviesada para não-informativa, que é trocar um defeito por outro. Pior: a régua é ancorada em vibes ('você apostaria pesado'), não em nada mensurável — impossível verificar calibração.

**Evidência:** narrative.ts:103-108 (CONVICTION_RUBRIC: '60-69 ... a maioria dos seus sinais deve cair AQUI'; '80-89 ... rare — poucas por semana'); emit.ts:300 e 306-307 (gate ≥60, STRONG ≥80 fixos). Forward: 0 sinais ≥80 desde a régua.

**Proposta:** Redefinir conviccao como PROBABILIDADE operacional: 'estimativa (%) de o preço tocar TP1 antes do SL dentro da janela' — aí calibração vira métrica objetiva (Brier score / reliability por bucket contra os desfechos forward, que já são gravados). E desacoplar o rótulo STRONG do número absoluto: STRONG = convicção no quantil superior (ex.: top 20% das últimas 50 do próprio motor), rolling por motor. Isso torna STRONG imune tanto à inflação (DeepSeek antiga) quanto à deflação (agora).

**Ajuste dos céticos:** Ajuste mínimo: (1) Adotar convicção = P(%) de tocar TP1 antes do SL na janela de expiração, MAS computar o plano determinístico ANTES da chamada à LLM e injetar entry/SL/TP1/janela nos fatos do prompt — a geometria continua determinística e idêntica por família, a LLM só estima a probabilidade do plano fixo (pergunta bem-posta, desenho controlado preservado). (2) Manter gate e STRONG como thresholds ABSOLUTOS e idênticos entre motores, redeclarados na nova semântica: gate = P≥60, STRONG = P≥70 (não 80 — com TP1 ~1R o base rate é ~50%, exigir 80% de probabilidade real é quase impossível e mataria STRONG de novo). Descartar o quantil rolling. (3) Reescrever a régua sem prescrever a distribuição ('a maioria deve cair em 60-69' sai): ancorar em frequências verificáveis — 'sua estimativa será auditada contra os desfechos reais; P=70 deve acertar ~70% das vezes'. (4) Instalar o Brier/reliability por bucket por motor já (os dados existem), mas congelar qualquer decisão baseada nele até ~100 resolvidos por motor na nova semântica; marcar a troca como nova era nos dados forward (não comparável com a era da régua atual). Se após 100+ resolvidos a distribuição ainda colapsar em 60-70, aí sim revisitar quantis — com dado, não com vibes.

---

### 16. [Engenharia de Prompts/LLM] O motor decide cego à geometria do trade: não sabe que o stop é 1.4 ATR, qual o RR nem que o sinal expira em 60 candles

**Problema:** A LLM escolhe direção/convicção e SÓ DEPOIS o emit constrói o plano (ATR ×1.4 ou nível). O prompt não contém stop, alvos nem horizonte. Resultado visível no forward: ~20% EXPIRED com duração média 38 candles — o motor aprova teses (ex.: reversão lenta em PRZ) cuja resolução não cabe na janela de 60 candles de 4h (~10 dias), e avalia 'edge' sem saber se o stop de 1.4 ATR sobrevive ao pullback normal da própria tese. Nenhum trader define convicção sem saber onde está o stop.

**Evidência:** emit.ts:297-304 (decide() primeiro; buildVsfPlan/buildClassPlan depois, invisíveis ao prompt); narrative.ts:151-172 e 253-277 (nenhum campo de stop/TP/expiração nos fatos). Forward: EXPIRED ~20%, duração média 38/60 candles.

**Proposta:** Injetar nos fatos o plano que SERÁ usado: plano_execucao: { stop_dist_atr: 1.4, tp1_rr, tp2_rr, expira_em_candles: 60, candle_horas: 4 } e instruir: 'compra/venda SOMENTE se a tese tipicamente se resolve dentro do horizonte e tolera um stop a essa distância; tese lenta ou que precisa de stop mais largo → neutro'. Zero mudança de arquitetura — é um objeto a mais no JSON de fatos.

**Ajuste dos céticos:** 1) Injetar as RESTRIÇÕES invariantes, não 'o plano': { stop_dist_atr: 1.4, tp1_rr/tp2_rr da casa, expira_em_candles: 60, candle_horas } — e para VSF anotar que o stop pode ser ancorado em nível dentro de 0.6–2.5 ATR (ou computar buildVsfPlan para os dois lados e injetar ambos). Nunca prometer no prompt um stop que o emit pode não usar. 2) Suavizar a instrução: 'considere se a resolução da tese cabe no horizonte e se o stop tolera o pullback normal; se claramente não, prefira neutro' — sem mandato absoluto; monitorar taxa de emissão nas 2 primeiras semanas para detectar sobre-supressão. 3) Versionar: sufixo no engineVersion (ex.: +geo) em TODOS os motores LLM simultaneamente, marcando nova era no forward — não misturar amostras pré/pós. 4) Critério de sucesso pré-registrado: não julgar pela queda de EXPIRED isolada; avaliar expectancy em R e taxa de EXPIRED só com N≥50 resolvidos pós-mudança antes de iterar de novo.

---

### 17. [Engenharia de Prompts/LLM] VSF: níveis entregues sem ATR nem distância — 'perto do preço' é indefinível — e o stop usado ignora o nível que a LLM escolheu

**Problema:** Dois defeitos acoplados. (1) toLevelsFacts manda níveis absolutos (POC, OBs, PRZ) mas NÃO manda o ATR nem distâncias pré-computadas; o prompt exige confluência 'perto do preço atual', obrigando o modelo a fazer aritmética de (preço−nível)/ATR sem sequer conhecer o ATR — LLMs são fracas nisso, ainda mais em 200 tokens. (2) buildVsfPlan escolhe o stop pelo nível protegido mais próximo, sem relação com o nível que motivou a decisão da LLM; o guarda-corpo 0.6–2.5 ATR rejeitou o plano em 19 de 22 sinais (fallback ~a14fb), ou seja, o diferencial da família VSF quase nunca executa.

**Evidência:** narrative.ts:253-277 (toLevelsFacts: sem campo atr, sem dist_atr por nível); narrative.ts:144 ('confluência clara dos pilares perto do preço atual' — sem régua de 'perto'); emit.ts:256-271 (levels sem filtro de distância na entrada; guarda 0.6-2.5 ATR na saída). Forward: ~lvl em só 3/22 sinais VSF.

**Proposta:** (a) Pré-computar nos fatos: atr absoluto e, em CADA nível, dist_atr (distância assinada em ATRs), filtrando níveis a >3 ATR (ruído que só gasta tokens). (b) Pedir no JSON de saída o nivel_referencia (preço do nível que justifica o trade) e ancorar o stop NELE (mantendo o guarda-corpo) — fecha o vão entre a tese da LLM e o plano executado, e deve elevar a taxa de ~lvl porque o nível escolhido pela LLM já nasce dentro da faixa exigida pelo próprio prompt.

**Ajuste dos céticos:** (1) Validar nivel_referencia: só aceitar se casar com um nível efetivamente enviado nos fatos (tolerância ~0.05 ATR) E estiver do lado protetor (abaixo da entrada em compra, acima em venda); qualquer violação → fallback ~a14fb, nunca confiar em número livre da LLM. (2) Manter o guarda-corpo 0.6–2.5 ATR exatamente como está. (3) Carimbar tag de plano nova (ex. ~lvl2) no engineVersion para separar eras no forward, aplicada simultaneamente a vsf e vsf_ds. (4) No filtro >3 ATR, cortar por nível é ok, mas manter sempre POC/VAH/VAL (núcleo do pilar volume) mesmo se distantes. (5) Registrar que a mudança em toLevelsFacts também altera o Conselho de Guerra (reuso exportado) — aceitável, mas deve constar no commit. (6) Nenhuma leitura de impacto antes de ~50 resolvidos da nova era; tratar como correção de desenho, não como aposta de edge.

---

### 18. [Engenharia de Prompts/LLM] Uma única amostra a temp 0 e nenhum motor vê o próprio histórico forward — decisão sem medida de estabilidade nem loop de aprendizado

**Problema:** Cada decisão é UMA chamada a temperature 0: parece determinístico, mas temp 0 em gpt-4.1/DeepSeek não é reprodutível de fato, e o ponto único não distingue uma decisão robusta de uma que oscilaria entre compra/neutro se amostrada de novo — exatamente o tipo de sinal marginal que polui o gate de 60. Além disso, fora a banca (equity/streak dos *_surv), nenhum motor recebe seu track record forward: o llm_ds que inflava convicção nunca 'soube' disso; um motor com WR 8% em regime de range continua opinando igual nesse regime. A régua pede calibração mas o modelo não tem nenhum dado para se calibrar.

**Evidência:** narrative.ts:185 (temperature: 0, chamada única em runLlmDecision); narrative.ts:222-234 (bankFacts: só equity/drawdown/GP streak — sem WR, sem R médio, sem quebra por regime; e só na família surv — llm, llm_ds, vsf puros não veem NADA de histórico).

**Proposta:** (a) Self-consistency barata: k=3 amostras a temp 0.7; emitir só se 2/3 concordam no lado (senão neutro), convicção = mediana. Custo ~3×200 tokens por decisão — centavos — e o dissenso interno vira filtro de qualidade gratuito. (b) Injetar em TODOS os motores LLM um historico_do_motor compacto: {n_resolvidos, wr_pct, r_medio, wr_por_regime: {trend, range}} calculado dos sinais já persistidos, com instrução 'exija mais confluência nos regimes onde seu WR histórico é baixo'. Falsificável: comparar taxa de sinais 60-65 emitidos e WR antes/depois.

**Ajuste dos céticos:** Ajuste mínimo: (1) Implementar (a) em MODO SOMBRA — manter a emissão exatamente como está (chamada única, temp 0) e, adicionalmente, colher k=3 amostras a temp 0.7 gravando como metadado do sinal a concordância de lado e a dispersão de convicção; hipótese pré-registrada e testável: 'sinais com convicção 60-65 E dissenso interno têm WR pior que os sem dissenso'; só promover o dissenso a filtro de emissão se confirmar com ≥100 resolvidos com metadado. (2) Rejeitar (b) na forma atual; se a ideia voltar, que seja como MOTOR NOVO no ringue (ex.: llm_hist), preservando llm puro como controle, e só com histórico agregado global (n_resolvidos, wr, r_medio — sem quebra por regime) quando o motor tiver n ≥ 30-50 resolvidos na era vigente.

---

### 19. [Execução/Microestrutura] Cron emite SPX/EURUSD/XAUUSD com mercado fechado, a preço morto — e nada checa o frescor do último candle

**Problema:** O cron roda `0 */4 * * *` (UTC) sete dias por semana e emite em TODOS os 12 mercados sem consultar horário de pregão. O helper `marketState()` existe em lib/market/hours.ts (sabe que forex/índices fecham no fim de semana) mas é usado só no Live Trading — o emit-signals nunca o chama. Pior: `analyzeSymbol` não tem NENHUMA checagem de frescor — `entry = last(candles).close`, seja lá quão velho for esse candle. No sábado 04:00 UTC, o TwelveData devolve os candles de sexta; o sistema 'entra' no fechamento de sexta e o primeiro candle real que julga o trade é o de segunda, depois do gap de abertura. Para SPX 4h é ainda pior no dia a dia: pregão é ~13:30–20:00 UTC, então os ticks de 00:00/04:00/08:00 emitem sinais com entrada em preço de 4 a 16 horas atrás. Nenhum trader consegue executar esse preço; o pnl_r desses sinais mede um trade que não existe.

**Evidência:** vercel.json:4 (`0 */4 * * *`); app/api/cron/emit-signals/route.ts:54-57 (loop sobre TRACKED_MARKETS sem gate de sessão; imports nas linhas 8-16 não incluem hours.ts); lib/market/hours.ts:15 (`marketState` — comentário: 'para gatear o Live Trading'); packages/engine/src/risk/index.ts:17 (`computeRiskFrom(last(candles).close, ...)` sem checagem de idade do candle).

**Proposta:** No loop do emit-signals, antes de `analyzeSymbol`: (1) pular mercado se `!marketState(m.assetType, new Date()).open`; (2) checagem de frescor universal — se `now - last(candles).time > 1.5 × timeframe`, não emitir (reason novo: 'stale-data'), o que também protege cripto contra provider degradado. Registrar o tally por reason para auditar quantas emissões eram fantasma.

**Ajuste dos céticos:** Três ajustes mínimos: (1) Especificar a semântica do frescor pelo CLOSE esperado do candle, não pelo open — bloquear se now − (last.time + timeframe) > 0.5×timeframe — porque com provider devolvendo só candles fechados a idade pelo open é sempre ≈1×tf e o limiar 1.5× só funciona por coincidência; definir explicitamente evita bloquear cripto válida numa troca de provider. (2) Não reprocessar nem apagar histórico: carimbar a fronteira (era/config_version no sinal ou data de corte fixa) para o comparativo de motores não misturar amostra com/sem fantasmas — os já resolvidos ficam, filtráveis na análise. (3) Manter os dois checks (marketState + frescor) como propostos e registrar tally por reason ('market-closed' e 'stale-data' separados): marketState só cobre fim de semana; é o freshness check que mata os ticks intraday do SPX (00/04/08/12 UTC ficam >6h velhos; 16/20 UTC passam) — são complementares, não redundantes. Gate sempre 100% upstream e uniforme; nunca por motor.

---

### 20. [Execução/Microestrutura] O primeiro candle após a emissão é invisível ao juiz: 4h (ou 24h no 1d) de stop/alvo que nunca contam

**Problema:** O resolve filtra `candles.filter(c.time > emittedMs)` onde `c.time` é o OPEN time do candle (parse.ts:19). O cron emite segundos/minutos depois da virada do candle (00:00:xx), então o candle que abriu às 00:00:00 tem `time < emittedMs` e é EXCLUÍDO. Resultado: a entrada acontece no open do candle X, mas o julgamento começa no candle X+1 — as primeiras 4 horas do trade (24h no 1d) são uma zona cega. Um stop varrido às 01:30 com retorno do preço nunca vira SL; um TP1 tocado às 02:00 nunca vira TP1. Isso é leniência sistemática exatamente na janela onde o whipsaw que matou a era anterior (−8.84R dos dois lados) acontece — os números da era nova estão sendo medidos com o primeiro round do trade apagado.

**Evidência:** app/api/cron/resolve-signals/route.ts:69-70 (`const emittedMs = Date.parse(s.emitted_at); const future = candles.filter((c) => c.time > emittedMs);`); lib/market/parse.ts:12-19 (Binance klines: `time: num(row[0])` = openTime); vercel.json:4 (emissão em 0 */4 = exatamente na virada do candle 4h).

**Proposta:** Resolver a janela cega com candles de TF menor: para cada sinal, buscar candles 1h (o resolve já roda de hora em hora) no intervalo `[emitted_at, próximo boundary do TF]` e passá-los ao `resolveLifecycle` antes dos candles do TF nativo; do boundary em diante, seguir com o TF do sinal. Alternativa mínima (sem I/O novo): incluir o candle de emissão com regra conservadora 'só stop conta nele' — não perfeito, mas elimina a leniência assimétrica.

**Ajuste dos céticos:** Implementar só a correção de 1 linha: trocar `c.time > emittedMs` por `c.time >= floorToTimeframe(emittedMs)` (equivalente: `c.time > emittedMs - tfMs`), incluindo o candle de emissão com regras SIMÉTRICAS normais (stop e TP contam). Rejeitar a regra 'só stop conta nele' — cria assimetria deliberada nova (outro viés, só que documentado); a contaminação pré-emissão residual é o trecho open→emitted_at (segundos a poucos minutos, direção conservadora). Obrigatórios junto: (a) teste unitário em v2/packages/engine/test/track-record.test.ts cobrindo stop e TP tocados no candle de emissão; (b) re-resolver retroativamente os ~30 sinais da era nova com a régua nova (candles refetcháveis) OU registrar a data da troca de régua e nunca comparar através dela; (c) anotar que EXPIRED e duração média mudarão em todos os motores na mesma data — é artefato da régua, não sinal.

---

### 21. [Execução/Microestrutura] Fill de stop no preço exato mesmo com gap, TP por toque, e zero custo de spread/slippage no pnl_r

**Problema:** resolveOutcome/resolveLifecycle assumem execução perfeita: (a) stop preenche EXATAMENTE em `stopLoss` mesmo quando o candle abre além dele (`c.low <= stopLoss → exit = stopLoss`) — com emissão 24/7 em mercados que fecham (achado 1), gap de segunda-feira através do stop é cenário garantido, e o −1R gravado é mentira (o real é −1.3R, −2R...); (b) TP conta com um toque de 0 pips no high/low — ordem limitada tocada não é ordem executada; (c) nenhum centavo de spread/slippage/funding em lugar nenhum do pnl_r. EURUSD e XAUUSD via TwelveData são séries mid — o spread real (XAUUSD ~30-50 cents) come uma fração mensurável de um stop de 1.4 ATR. Um profissional olha um track record sem custo de execução e desconta 0.05-0.1R por trade de cabeça; o produto que se vende como 'prova antes de prometer' deveria descontar antes dele.

**Evidência:** packages/engine/src/track-record/index.ts:58 (`if (c.low <= stopLoss) return resolved("SL", j, stopLoss, (stopLoss - entry) / risk)` — exit price ignora gap) e :131 (`hitStop` idem no lifecycle); :130 (`reachedTp: c.high >= tp` — toque = fill); grep por slippage/spread/custo no pacote engine: zero ocorrências.

**Proposta:** (1) Fill realista do stop: `exit = side === 'buy' ? Math.min(c.open, stop) : Math.max(c.open, stop)` quando o candle já abre além do stop; (2) TP exige penetração mínima (ex.: tocar `tp + 0.05×ATR` para buy) ou pelo menos registrar taxa de 'touch-only TPs' para quantificar; (3) tabela de custo por classe de ativo em R (cripto 0.03R, forex 0.02R, XAUUSD/SPX 0.05R — calibrável) deduzida do pnl_r e exibida ('R líquido de custo estimado'). Versionar no engine_version para não misturar eras.

**Ajuste dos céticos:** Ajuste mínimo em 4 pontos: (1) Gap-fill do stop: aceitar como proposto, mas SIMÉTRICO — gap através do TP também preenche no open (limite tocada por gap executa no open, que é MELHOR para o trader); pessimismo só do lado da perda é viés, não honestidade. Aplicar também ao stop móvel do resolveLifecycle (breakeven/tp1). (2) TP por toque: NÃO mudar a regra de fill agora — descartar o knob 0.05×ATR; apenas registrar o diagnóstico 'touch-only TP' (máxima penetração além do TP em ATR por trade resolvido) e revisitar quando houver n suficiente para calibrar com dado, não com chute. (3) Custos: NÃO criar tabela nova em R fixo (0.03R/0.05R está errado conceitualmente — custo em R varia com a largura do stop: custo_R = bps×preço/risco); reusar DEFAULT_ENGINE_CONFIG.costs (bps por lado) que o backtest já usa, convertendo por sinal via risco — uma fonte de verdade, e elimina a inconsistência backtest-líquido vs forward-bruto. Calibrar o bps de XAUUSD (commodities:3 provavelmente baixo para spread de 30-50 cents). Exibir 'R líquido' ao lado do bruto, não substituir silenciosamente. (4) Versionamento: além do engine_version bump, como resolveOutcome/resolveLifecycle são puros e determinísticos, RE-RESOLVER retroativamente os sinais históricos sob as regras novas (se os candles estiverem armazenados/refetcháveis) — mantém UMA série comparável em vez de duas eras incomensuráveis com n minúsculo em cada.

---

### 22. [Execução/Microestrutura] Janela de expiração fixa em 60 candles ignora o timeframe: no 1d, um sinal tranca o motor por ~2-3 meses

**Problema:** `MAX_DURATION = 60` candles vale para 4h E 1d. No 4h são 10 dias; no 1d são 60 dias corridos (SPX 1d: ~3 meses de pregão). Combinado com o dedup do RPC (1 sinal aberto por símbolo+TF+motor), um único sinal 1d que anda de lado segura o slot do motor por um trimestre — em 6 dos 12 mercados rastreados. Vocês expandiram para EURUSD/SPX em 02/07 explicitamente para 'acelerar a amostra', mas metade do universo tem um freio de mão estrutural: com duração média já em 38 candles e ~20% EXPIRED no 4h, a matemática do 1d é ainda pior. O custo de oportunidade é duplo: amostra que não acumula E motor mudo enquanto a tese original já morreu (regime virou, LLM decidiria o oposto, e o sinal velho continua 'vivo').

**Evidência:** app/api/cron/resolve-signals/route.ts:25 (`const MAX_DURATION = 60;` — único, sem parametrização por TF); lib/signals/tracked.ts:18-28 (6 mercados em 1d); supabase/migrations/0012_engine_selector.sql:45-52 (dedup: `outcome is null` bloqueia nova emissão do motor no símbolo+TF).

**Proposta:** (1) Escalar a janela por TF: ~60 candles no 4h, ~20-30 no 1d (mesma vida em tempo-calendário); (2) time-stop por inatividade: se após N candles o trade nunca atingiu ±0.5R de excursão, fechar como EXPIRED cedo — sinal que não anda não é tese, é ruído; (3) medir e exibir 'slot occupancy' por motor (% do tempo bloqueado) como métrica operacional do comparativo.

**Ajuste dos céticos:** Implementar só (1) e (3): trocar a constante por um mapa por TF em resolve-signals/route.ts (ex.: { "4h": 60, "1d": 25 } — mesma vida em calendário, ~10 dias), aplicando a regra nova também aos sinais 1d já abertos (é regra operacional, não fitted) e gravando a versão da regra de expiração no sinal (ou ao menos anotando a data de corte) para segmentar a análise. Adicionar a métrica de slot occupancy por motor como observabilidade. ADIAR o item 2 (time-stop por inatividade): o mapa por TF já resolve o gargalo de throughput; só reconsiderar o time-stop quando houver amostra suficiente (>100 resolvidos na era) para escolher N e o limiar de excursão com dado em vez de chute.

---

## 8 achados PLAUSÍVEIS (não verificados — retomar céticos antes de agir)

### Lente darwiniana (6, na íntegra)

### D1. Morte da banca com n<20 trades é ruído, não seleção — o Darwin atual é busca aleatória

**Problema:** O gatilho de evolução é exclusivamente `bank.deaths > 0` sem nenhum n mínimo de trades (emit.ts:399-400). Com aposta de 5%/10% da banca e piso 33, uma linhagem morre com ~11 perdas de -1R em STRONG (0.9^11 ≈ 0.31) ou ~22 em normal — e com o EXPIRED em ~20% e whipsaw da era anterior, uma estratégia com expectância genuinamente positiva morre por variância com probabilidade alta nesse n. O sistema então descarta o núcleo e muta, ou seja: seleciona sobre ruído. Um pesquisador de neuroevolução chamaria isso de fitness com SNR perto de zero — a 'evolução' converge para nada porque o sinal de seleção não distingue núcleo bom de núcleo azarado.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:399-400 (`const bank = await fetchBank(s.slot, s.born_at); if (!bank || bank.deaths === 0) continue;`) + C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/survival.ts:38-40 (morte determinística em equity ≤ 33, sem n mínimo). Cadência de emissão 4h/12 mercados ⇒ vidas de 9-18 trades resolvidos, confirmado pelo dono.

**Proposta:** Duas mudanças em prepareEvoSlots: (1) n mínimo — só declarar morte se `bank.lifeTrades + trades_vidas_anteriores >= 20` (senão o núcleo continua vivo mesmo com equity < 33, marcado como 'em observação'); (2) trocar o critério binário de ruína por fitness estatístico: lower bound de 90% da expectância em R (média − 1.28·σ/√n) < 0 com n ≥ 20 ⇒ morte. Guardar esse fitness na linha do evo_engines a cada cron para auditoria.

---

### D2. População de 2 com cruzamento entre si: incesto genético garantido e gene pool que só encolhe

**Problema:** Existem exatamente 2 slots (evo_gpt, evo_ds) e o cruzamento é sempre `núcleo morto × o outro slot` (emit.ts:401-403). Com pool de 2, após poucas gerações os dois núcleos compartilham quase todo o material — cada filho é combinação dos mesmos dois pais, e a única fonte de diversidade é a temperatura 0.7 do breedEvoCore. Pior: se os DOIS morrem no mesmo cron, o segundo cruza com o filho recém-nascido do primeiro (o loop muta `s.core` in place na linha 410 antes da iteração seguinte), e o prompt do breeding ainda o rotula de 'NÚCLEO B (sobrevivente)' — mentira genética. Convergência esperada: os dois slots viram variações do mesmo prompt médio, provavelmente cada vez mais neutro (a mutação sugerida é sempre 'filtro novo, confluência maior' — só aperta, nunca solta).

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:401 (`const other = rows.find((o) => o.slot !== s.slot)`), 410 (`s.core = core` in place, contamina a iteração seguinte); C:/dev/tradeai/t_a_der/v2/apps/web/lib/analysis/narrative.ts:379 (mutação sempre no sentido restritivo: 'filtro novo, exigência de confluência maior, regime a evitar').

**Proposta:** (1) Subir a população para 4-6 slots por custo quase zero (é 1 linha na tabela + 1 chamada LLM por emissão; os núcleos-semente extras podem ser: momentum puro, mean-reversion em lateral, breakout de compressão). (2) Imigração: a cada K mortes da linhagem (ex.: 3), em vez de cruzar, semear um núcleo NOVO aleatório de um banco de sementes — injeção de diversidade padrão em EAs. (3) Snapshot dos rows antes do loop para que 'other' seja sempre o núcleo vigente no início do cron, e direcionar a mutação: alternar entre 'apertar filtro' e 'AFROUXAR um filtro que causou inatividade' conforme o diagnóstico da morte.

---

### D3. Autópsias são geradas, pagas e ignoradas: o breeding usa só drawdown e streak GP

**Problema:** O sistema já paga gpt-4o-mini para escrever um post-mortem estruturado de CADA sinal morto no SL — incluindo 'qual filtro teria evitado' (narrative.ts:400) — e esse texto vai para signals.autopsy e morre num tooltip 🔬 do admin. Enquanto isso, o deathContext do cruzamento é apenas `Pior queda X%; últimos trades GPGPP; N trades` (emit.ts:402): o engenheiro-de-estratégias LLM recebe zero informação sobre EM QUE mercados, regimes e padrões o núcleo morreu. É o desperdício mais barato de corrigir no sistema inteiro: o laço de aprendizado está construído até 90% e não foi fechado.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:402 (`const deathCtx = \`Pior queda ${bank.maxDrawdownPct}% do pico; últimos trades: ...\``) vs narrative.ts:391-409 (autópsia com tese, regime, duração e lição) e app/api/cron/resolve-signals/route.ts:97-108 (autopsy persistida, nenhum consumidor além do admin-panel.tsx:1503).

**Proposta:** Em prepareEvoSlots, antes do breedEvoCore, buscar os sinais SL da vida do núcleo (`engine = slot, emitted_at >= born_at, outcome = 'SL', autopsy not null`, limit ~8) e agregar no deathContext: por símbolo/timeframe/regime + as 3-4 lições das autópsias (basta concatenar `autopsy` truncada). Uma query + ~500 tokens a mais no prompt do cruzamento; nenhuma migration.

---

### D4. Fitness = não morrer: o núcleo covarde é imortal e a pressão de seleção aponta para o silêncio

**Problema:** Um núcleo que responde 'neutro' para sempre nunca resolve trade, logo fetchBank devolve null, logo `if (!bank || bank.deaths === 0) continue` o mantém vivo eternamente (emit.ts:399-400). O único evento evolutivo é a MORTE — não existe recompensa por performar, nem custo por não operar. Combinado com o contrato/breeding que empurram para o neutro ('em dúvida, mande ser neutro', narrative.ts:380) e com a régua de convicção pós-correção que já zerou os ≥80, o atrator do sistema é um motor que não emite nada — 'sobreviveu' e não provou coisa alguma. Um trader profissional riria: é o fundo que nunca abre posição e se declara invicto.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:399-400 (null-bank = vivo; nenhuma checagem de atividade ou idade) + C:/dev/tradeai/t_a_der/v2/apps/web/lib/analysis/narrative.ts:380 ('em dúvida, mande ser neutro' dentro das regras do cruzamento).

**Proposta:** Adicionar segunda condição de substituição em prepareEvoSlots: 'morte por letargia' — se `now − born_at > 14 dias` E trades resolvidos da vida < 5, o núcleo é substituído (cruzamento com contexto 'morreu por inatividade: afrouxe UM filtro'). E registrar fitness contínuo (expectância em R e nº de trades) na linha do evo_engines a cada cron, para que a comparação entre slots seja por performance, não por sobrevivência binária.

---

### D5. Sem arquivo nem elitismo: cada morte sobrescreve o genoma e a história da linhagem some

**Problema:** O UPDATE da morte sobrescreve `core` in place (emit.ts:406-409) e a tabela evo_engines não tem histórico (migration 0015): o núcleo morto — junto com suas estatísticas de vida — é apagado para sempre. Não há elitismo (um núcleo que fez equity 180 antes de um streak fatal é indistinguível de um que só perdeu), não há rollback se o filho for pior que o pai (e será, ~metade das vezes), e não há como responder a pergunta científica básica do experimento: 'as gerações estão melhorando?'. O campo `parents` guarda uma string decorativa ('g3 × evo_ds'), não os genomas.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:406-409 (update destrutivo de core/generation/born_at) + C:/dev/tradeai/t_a_der/v2/supabase/migrations/0015_evolution_autopsy.sql:17-26 (nenhuma tabela de histórico; `parents text` é descrição curta).

**Proposta:** Migration 0016b: tabela `evo_engines_history (slot, generation, core, born_at, died_at, life_trades, expectancy_r, max_dd_pct, death_context)` com INSERT antes de cada UPDATE de morte (5 linhas em prepareEvoSlots). Elitismo mínimo: guardar `best_core`/`best_expectancy` na linha do slot; se após 2 gerações consecutivas o fitness ficar abaixo do best ancestral, ressuscitar o best do arquivo em vez de cruzar de novo.

---

### D6. Validação do núcleo-filho é 'tem mais de 40 caracteres' — mutação pode entregar um genoma inválido que opera em produção

**Problema:** O único gate do cruzamento é `child.length > 40` (emit.ts:404). Nada verifica que o filho começa com 'ESTRATÉGIA-NÚCLEO', que cita apenas dados que os facts fornecem, que não contradiz o contrato (ex.: instruir outro formato de saída, ou 'sempre compre' — o EVO_CONTRACT vem DEPOIS do core no system prompt, narrative.ts:367, então o core fala primeiro), nem que não contém promessa de retorno — num produto onde honestidade estatística é lei, um núcleo mutado público (RLS de leitura pública, 0015:30) dizendo 'essa estratégia dobra a banca' é risco reputacional direto. Um LLM a temperatura 0.7 respondendo em texto livre VAI eventualmente produzir isso, e o sistema o instala como motor por semanas.

**Evidência:** C:/dev/tradeai/t_a_der/v2/apps/web/lib/signals/emit.ts:404 (`const core = child && child.length > 40 ? child.slice(0, 2000) : s.core`) + narrative.ts:367 (`const system = \`${core}\n\n${EVO_CONTRACT}\``) + 0015_evolution_autopsy.sql:30 (núcleo é público).

**Proposta:** Função `validateEvoCore(child)` chamada no lugar do length-check: (a) regex — começa com 'ESTRATÉGIA-NÚCLEO', 3-6 linhas, sem '%' seguido de retorno/lucro prometido, sem instruções de formato de saída ('JSON', 'responda'); (b) smoke test — rodar generateEvoDecision com o filho sobre um dto fixo de fixture e exigir JSON parseável com lado válido; falhou qualquer um → renasce com o pai (comportamento atual de fallback). ~40 linhas + 1 chamada LLM por morte.

---

### Lente execução (2, títulos — conteúdo no transcript do run)

- **Família VSF: a tese é "nível segura o preço", mas a execução é ordem A MERCADO onde o preço
  estiver** — a tese pediria ordem limitada NO nível (ou só emitir quando o preço está a ≤X ATR
  do nível), senão compra-se longe do suporte que justificou o trade.
- **A análise da emissão inclui o candle EM FORMAÇÃO (segundos de vida) como se fosse fechado** —
  indicadores calculados com um candle de 1 minuto de idade mudam até o fechamento.
