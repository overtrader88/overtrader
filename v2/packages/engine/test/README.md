# Testes do motor

## Estratégia de "golden"

Como o ambiente de desenvolvimento **não tem acesso ao TradingView**, os testes
validam contra duas fontes de verdade independentes da implementação:

1. **Casos analiticamente conhecidos** — o resultado é dedutível na matemática,
   não copiado de lugar nenhum. Ex.:
   - ATR de candles com range constante = esse range.
   - EMA de série constante = a constante.
   - RSI de série estritamente crescente = 100; decrescente = 0.
   - Bollinger de série constante → bandwidth 0.
2. **Invariantes** — propriedades que devem sempre valer (faixas [0,100], +DI>−DI
   em uptrend, monotonicidade de `ratioToSignal`, determinismo do pipeline).

> Não fabricamos números do TradingView. Inventar valores de referência
> contradiz o posicionamento "prova antes de prometer".

## Cross-check manual com TradingView (passo online — fazer quando houver acesso)

Para a validação numérica fina contra a referência da indústria:

1. Exporte ~300 candles de um ativo/timeframe do TradingView (ex.: BTCUSDT 1h).
2. Salve em `test/fixtures/tradingview-btcusdt-1h.json` (OHLCV + valores esperados
   de RSI/MACD/ATR/ADX no último candle, lidos dos indicadores do próprio TV).
3. Adicione um teste comparando `rsi/macd/atr/adx` com tolerância pequena
   (ex.: ±0.5 para RSI). Isso fecha o critério "golden vs referência externa" do M1.

Enquanto esse passo não roda, os testes analíticos + invariantes já garantem a
**correção matemática** das fórmulas.
