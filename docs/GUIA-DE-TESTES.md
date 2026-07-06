# Overtrader — Guia de Funcionalidades e Como Testar

> Documento de referência para testar o produto ponta a ponta. Cada seção traz
> **o que é**, **como testar** (passo a passo) e **como saber que funcionou**.
> Atualizado em 07/2026 (18 motores, eras `-j2`/`~c1`, Darwin 2.0).

---

## 1. Antes de começar: acesso, contas e créditos

### Onde testar
- **Produção:** https://overtrader.com.br (deploy automático da branch `main`).
- **Local:** `cd v2/apps/web && pnpm dev` → http://localhost:3000 (usa o mesmo Supabase de produção via `.env.local`).

### Modo do site (importante)
O site tem **dois modos**, controlados pela env `NEXT_PUBLIC_SIGNUPS_OPEN`:
- **Pré-lançamento** (padrão, flag ≠ `"true"`): só a vitrine é pública (`/`, `/planos`, `/roadmap`, `/login`, `/termos`, `/privacidade`). **Todo o resto exige login** — quem não está logado é mandado pra `/login`.
- **Lançado** (flag = `"true"`): `/analise` e as demais viram públicas (try-before-signup); só `/dashboard`, `/historico` e `/alertas` exigem login.

### Como criar uma conta de teste
- Se **signups abertos**: `/login` → aba "Criar conta".
- Se **fechados** (pré-lançamento): crie o usuário direto no **Supabase → Authentication → Add user**, ou ligue a flag temporariamente. Toda conta nova nasce **Free com 3 créditos vitalícios**.

### Como conseguir créditos e plano para testar (via Admin)
1. Seu e-mail precisa estar em `ADMIN_EMAILS` (env). Aí `/admin` libera.
2. **`/admin` → aba Usuários** → busque o usuário → **Definir créditos** (dá o saldo que quiser) e **Definir plano** (Free/PRO/PRO+). É o jeito rápido de destravar os testes pagos sem passar pelo checkout.

### Tabela de custos (créditos)
| Ação | Custo | Observação |
|---|---|---|
| Análise completa (`/analise`) | **1 crédito** | Re-ver a mesma análise em ≤10 min é grátis |
| Stress test da posição (`/posicao`) | **1 crédito** | Mesma regra da análise |
| Trading ao vivo (`/ao-vivo`) | **2 créditos/hora** | Sessão ao vivo com WebSocket |
| Monitor (`/monitor`) | **20 créditos** | Libera 5 dias; reativar = +20 |
| Alerta de watchlist (`/watchlist`) | **15 créditos** | Por ativo+TF+direção, válido 5 dias |
| Simulador (`/simulador`) | **3 grátis/dia** depois **1 crédito** | Cota diária reseta à meia-noite UTC |
| Conselho de Guerra (chat na análise) | **1 crédito/pergunta** | — |

### Planos
- **Free** — R$ 0 · 3 análises vitalícias · só cripto · dashboard de preços dos 5 mercados.
- **PRO** — R$ 59/mês (ou R$ 50/mês no anual) · 143 ativos + IA narrativa + backtest + análises.
- **PRO+** — R$ 99/mês · tudo do PRO + Telegram + watchlist ilimitada.

---

## 2. Vitrine pública (sem login)

### 2.1 Landing (`/`)
**O que é:** a home "terminal premium" — gráfico de candles real com scanner de IA, ticker de cotações, rede neural, contadores, gauge de confluência, planos, FAQ.
**Como testar:** abra `/` deslogado. Role a página inteira. Passe o mouse no ticker (deve pausar). Reduza a janela até mobile.
**Funcionou se:** o gráfico do hero se desenha com o scanner violeta passando; os contadores (143 / 5 / 15) sobem ao rolar; o anel de luz gira no card PRO; nada estoura a largura no mobile. Teste também `prefers-reduced-motion` (nas prefs do SO) — as animações devem parar.

### 2.2 Planos (`/planos`), Roadmap (`/roadmap`), Termos/Privacidade
**Como testar:** abra cada uma deslogado. Em `/planos`, confira os 3 planos e o toggle mensal/anual.
**Funcionou se:** carregam sem exigir login e os preços batem com a tabela acima.

### 2.3 Autenticação (`/login`, `/recuperar`, `/redefinir-senha`)
**Como testar:** login com credenciais válidas; "esqueci a senha" → e-mail de recuperação; link do e-mail → redefinir.
**Funcionou se:** login redireciona pro `/dashboard`; quem já está logado e abre `/login` é mandado pro dashboard automaticamente.

---

## 3. Núcleo do produto (logado)

### 3.1 Dashboard (`/dashboard`)
**O que é:** a "mesa" — preços ao vivo dos 5 mercados, atalhos, estado da conta.
**Como testar:** logue e abra. Troque de mercado (cripto/forex/ações/índices/commodities).
**Funcionou se:** os preços atualizam e os cards de cada mercado aparecem (Free vê todos os preços, mas só analisa cripto).

### 3.2 Análise (`/analise`) — o coração
**O que é:** análise completa de um ativo em 15 camadas (técnica, SMC, multi-timeframe, Monte Carlo, harmônicos, WEGD, sazonalidade, notícias) + IA narrativa + backtest + selo de qualidade.
**Como testar:**
1. Escolha um ativo (ex.: BTCUSDT) e timeframe (ex.: 4h) → **Analisar** (debita 1 crédito).
2. Leia o veredito, o selo (verde/amarelo/vermelho/cinza), o plano (entrada/stop/alvos), as abas das camadas e a narrativa da IA.
3. Rode a MESMA análise de novo em menos de 10 min.
**Funcionou se:** a análise volta com todas as camadas; o selo tem cor coerente com o texto; a 2ª rodada em ≤10 min **não cobra** crédito de novo; sem saldo, aparece o aviso de créditos esgotados.

### 3.3 Posição — Stress Test (`/posicao`) 🆕
**O que é:** você informa uma posição que **já tem** e a mesa de motores vota: **segurar, sair ou aumentar**.
**Como testar:** menu **Posição** → ativo (BTCUSDT) → lado **Comprado** → preço de entrada (ex.: um pouco abaixo do preço atual) → rodar (1 crédito).
**Funcionou se:** aparece o placar de votos dos motores, o seu **R não-realizado** e o **nível onde a tese morre**. Custo 1 crédito, como a análise.

### 3.4 Trading ao vivo (`/ao-vivo`)
**O que é:** sessão ao vivo com preço em tempo real (WebSocket) — 2 créditos/hora.
**Como testar:** abra, ative a sessão para um ativo. Deixe rodar alguns minutos e encerre.
**Funcionou se:** o preço pulsa em tempo real; ao encerrar, as horas são contabilizadas; fora do pregão (forex/índices no fim de semana) ele avisa "mercado fechado".

### 3.5 Monitor (`/monitor`)
**O que é:** acompanhamento contínuo de mercados escolhidos por 5 dias (20 créditos).
**Como testar:** ative o monitor (precisa PRO/PRO+ e ≥20 créditos).
**Funcionou se:** debita 20 créditos, abre janela de 5 dias; sem saldo/plano, bloqueia com a mensagem certa.

### 3.6 Histórico (`/historico`)
**Como testar:** rode 2-3 análises e abra o histórico; filtre por classe/motor.
**Funcionou se:** as análises passadas aparecem e dá pra reabrir cada uma (reabrir de contexto já pago é grátis).

---

## 4. Track Record e os 18 motores (`/track-record`)

**O que é:** a performance **forward** auditada — cada sinal foi carimbado na emissão e o mercado julgou depois (impossível de maquiar). É o "prova antes de prometer".

**Como testar:**
1. Abra `/track-record`. No topo há **abas por família de motor** (com separadores: Produção · Variantes A/B · Inteligência/LLM · Determinísticos).
2. Clique em "Todos" para a visão consolidada e depois num motor específico (ex.: "LLM · GPT-4.1", "VSF · DeepSeek", "Evolutivo · GPT").
3. Veja o ciclo ao vivo (sinais abertos) e as estatísticas (win rate, profit factor, R) **com amostra (n) e intervalo de confiança**.

**Funcionou se:** as abas quebram em linhas sem vazar do painel; cada motor mostra suas métricas; enquanto a amostra é pequena, o veredito fica **cinza/"em construção"** (honestidade — não inventa número).

**Os 18 motores (contexto):** 2 de produção (padrão, classe) · 2 variantes A/B · **9 de IA** (GPT-4.1, DeepSeek, `llm_cot`, +sobrevivência e VSF de cada) · 2 evolutivos · condicional · contrário (controle) · consenso.

> ⚠️ **Amostra ainda pequena.** As mudanças recentes (eras `-j2` e `~c1`) reiniciaram a comparabilidade. Leituras sérias só com **≥100 sinais resolvidos por motor** — o sistema acumula sozinho a cada 4h.

---

## 5. Watchlist e Alertas (`/watchlist`, `/alertas`)

### 5.1 Watchlist (`/watchlist`)
**O que é:** lista de ativos monitorados com **alertas pagos** (15 créditos por ativo+TF+direção, válidos 5 dias).
**Como testar:**
1. Adicione um ativo, escolha timeframe e direção → **+ Adicionar · 15 créditos**.
2. Veja o contador regressivo (5 dias) e o estado (ativo / expirado / inativo).
3. Clique em **Analisar** num item — deve abrir a análise **sem cobrar** (você já pagou o alerta).
**Funcionou se:** debita 15 créditos ao criar; o countdown aparece; "analisar" a partir de um alerta pago é grátis; alertas inativos mostram o banner de aviso.

### 5.2 Alertas (`/alertas`)
**O que é:** os disparos recebidos (mesmos sinais que vão pro Telegram, para quem paga).
**Como testar:** abra `/alertas` após ter alertas ativos.
**Funcionou se:** lista os alertas recebidos; quem não pagou não recebe.

### 5.3 Telegram
**Como testar:** vincule seu Telegram (fluxo na conta/alertas) e aguarde um sinal novo do cron. **Pendência conhecida:** validação ao vivo do webhook do Telegram em produção (ver `docs/PENDENTES.md`).

---

## 6. Simulador — Máquina do Tempo (`/simulador`) 🆕

**O que é:** roda a análise **real numa data do passado** (sem lookahead — os candles são truncados naquela data) e deixa você **avançar o tempo** pra ver o desfecho. Treino tipo simulador de voo.
**Como testar:**
1. Menu **Simulador** → ativo (BTCUSDT) + timeframe (4h) + uma **data de ~2 semanas atrás**.
2. Rode → leia a análise "daquele dia".
3. Clique em **avançar o tempo** → os candles seguintes são revelados e o plano resolve em TP ou SL.
**Funcionou se:** aparece o aviso âmbar de "simulação histórica"; a análise usa só dados até a data; ao avançar, o desfecho (TP/SL) é revelado. **3 grátis/dia**, depois 1 crédito.

---

## 7. Conselho de Guerra (chat na análise) 🆕

**O que é:** depois de uma análise, um chat onde você **interroga a IA presa aos dados daquela análise** (1 crédito/pergunta).
**Como testar:**
1. Rode uma análise em `/analise` → role até o chat.
2. Pergunte algo sobre a análise (ex.: *"por que o viés é de venda se o funding está negativo?"*).
3. Depois pergunte algo **fora dos dados** (ex.: *"o que o Fed decide amanhã?"*).
**Funcionou se:** responde a 1ª com base nos números da análise e **admite que não tem** o dado da 2ª (a honestidade é o teste). Cada pergunta cobra 1 crédito.

---

## 8. Conta e Créditos (`/conta`, `/creditos`)

**Como testar:** em `/conta` troque a senha e veja os dados; em `/creditos` veja o saldo e o histórico de consumo.
**Funcionou se:** o histórico mostra cada débito (análise, monitor, alerta…) com data; a troca de senha funciona.

---

## 9. Painel Admin (`/admin`) — só para `ADMIN_EMAILS`

**Como testar:** abra `/admin` logado como admin. Abas principais:
- **Usuários** — buscar, **definir créditos**, **definir plano**, notificar. (É daqui que você libera as contas de teste.)
- **Motores** — o laboratório de IA:
  - **🥊 Duelo LLM** — GPT‑4.1 × DeepSeek head-to-head (assertividade, PF, R).
  - **⚔ VS** — dois seletores: escolha **quaisquer dois** motores e compare.
  - **🛡 Ringue de Sobrevivência** — 8 contas de banca (mente/gestão × GPT/DeepSeek × flat/VSF) que **morrem se quebrarem**; agora mostra também o **Heat** (risco simultâneo de carteira).
  - **🧬 Evolução** — os núcleos darwinianos: geração, mortes na linhagem, e o **texto da estratégia** (clique em "ver núcleo").
  - **Tabela comparativa + ranking** dos 18 motores (nomes dos motores de IA em **amarelo**), com filtros por classe/timeframe.
  - **Operações fechadas** — as que morreram no stop têm **🔬 autópsia** (passe o mouse).
- **Outras abas** — receita/MRR, funil, coorte, consumo, auditoria, ops, HUBLA.

**Ferramentas de diagnóstico admin (abrir no navegador logado):**
- `/api/admin/llm-probe` — testa OpenAI + DeepSeek no deploy atual (diz na hora se é chave/modelo/rede). Use se um motor de IA parar de emitir.

**Funcionou se:** as abas carregam; definir créditos/plano reflete na conta do usuário; os cards de motores populam conforme os sinais resolvem.

---

## 10. O que roda sozinho (crons Vercel) — não precisa acionar

| Cron | Frequência | O que faz |
|---|---|---|
| `emit-signals` | a cada 4h | Emite os sinais dos 18 motores nos 12 mercados (pula mercado fechado / dado velho) |
| `resolve-signals` | de hora em hora | Julga os sinais abertos contra os candles novos (TP/SL/expirado) + gera autópsias |
| `settle-live` | periódico | Acerta as sessões de trading ao vivo |
| `check-watchlist` | periódico | Dispara alertas de watchlist para quem pagou |
| `morning-digest` | diário | Resumo matinal |

Você não aciona nada disso manualmente. Se quiser forçar uma rodada em teste, é preciso o `CRON_SECRET` (não fazer em produção sem necessidade — o `emit-signals` publica no Telegram).

---

## 11. Checklist rápido de fumaça (5 min)

1. [ ] `/` carrega deslogado, com o gráfico animado do hero.
2. [ ] Login funciona e cai no `/dashboard`.
3. [ ] `/analise` roda uma análise de BTCUSDT 4h e debita 1 crédito.
4. [ ] Re-rodar a mesma análise em ≤10 min **não** cobra.
5. [ ] `/posicao` vota na sua posição.
6. [ ] `/simulador` roda uma data passada e revela o desfecho ao avançar.
7. [ ] `/watchlist` cria um alerta (15 créditos) e "analisar" a partir dele é grátis.
8. [ ] `/track-record` mostra as abas dos motores sem estourar o layout.
9. [ ] `/admin` → Motores mostra Duelo, VS, Ringue e Evolução.
10. [ ] `/api/admin/llm-probe` retorna `ok:true` para OpenAI e DeepSeek.

---

## 12. Pendências e cuidados conhecidos
- **Telegram/webhook:** validação ao vivo em produção pendente (`docs/PENDENTES.md`).
- **Amostra dos motores:** vereditos só com ≥100 resolvidos por motor; eras `-j2`/`~c1` não são comparáveis com dados antigos.
- **Efeito one-shot:** sinais 1d antigos com >25 candles vão expirar em lote na próxima rodada do resolve — é a régua nova, não um bug.
- **Custo de API:** o modo sombra k=3 (motores `llm`/`llm_ds`) faz 3 chamadas extras por sinal emitido — monitorar consumo.
