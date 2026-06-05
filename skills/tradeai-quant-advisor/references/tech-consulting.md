# Consultoria de tecnologia / arquitetura

Régua para o Modo 3. Avalie nas dimensões abaixo e priorize achados como 🔴 Crítico / 🟠 Importante / 🟡 Menor, sempre com arquivo:linha quando possível.

## Correção e pureza do motor
- A lógica de análise é **pura** (sem I/O, rede, DB, `Date.now()`)? Efeitos colaterais vivem na borda (API route)?
- Tipos fortes, `strict` + `noUncheckedIndexedAccess`? Sem `any` escondendo bug?
- Há teste cobrindo o caminho? Golden/invariante para cálculo?

## Robustez
- Chamadas externas (OpenAI, market data, news) têm **retry com backoff** (429/5xx) e **timeout**?
- Há **fallback** quando um provider falha (ex.: Binance → TwelveData → Yahoo)? O fallback é testado e logado?
- Parse de saída de LLM é defensivo (try/catch + validação de schema), sem derrubar a análise?

## Segurança
- **RLS** habilitado em TODAS as tabelas? `service_role` só server-side?
- Webhooks validam **HMAC** com `timingSafeEqual` e são **idempotentes** (dedupe por event id)?
- **Rate-limit** em webhooks e rotas admin (tabela `rate_limits`)? Admin tem audit trail (e MFA no escopo v2)?
- `CRON_SECRET` ≥ 32 chars? Endpoint de apagar conta exige confirmação exata? Sem segredo no bundle do cliente?
- Validação de env no boot (Zod) e de input nas bordas (Zod)?

## Performance
- Há **O(n²)** evitável (ex.: recalcular indicador por candle fatiando o array)? Dá para usar série incremental/rolling?
- Cache onde faz sentido (market data compartilhado)? Cota de API externa respeitada?
- Backtest longo (M4: 24–36 meses) cabe no orçamento de CPU/latência? Se não, considerar pré-computação ou worker dedicado — sinalizar antes de prometer a janela maior.

## Observabilidade
- Log **estruturado** (não `console.*` solto) + captura de erro (Sentry)? Falhas silenciosas viram alerta (ex.: email não encontrado em webhook)?

## Alinhamento ao blueprint
- Parâmetros no `EngineConfig` centralizado? Camadas como funções puras compostas pela borda?
- Encaixa no marco certo (M0–M6)? Não antecipa acoplamento que o cutover (M6) vai sofrer?
- Migrations consolidadas (sem duplicata/"fix de fix")?

## Como entregar o parecer técnico
Diagnóstico curto → achados priorizados com arquivo:linha → recomendação de arquitetura com o **porquê** → encaixe no roadmap. Separe "bloqueia produção/credibilidade" de "dívida aceitável por ora". O produto precisa lançar; nem todo 🟡 precisa virar 🔴.
