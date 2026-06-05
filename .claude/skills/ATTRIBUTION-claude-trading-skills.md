# Atribuição — skills de terceiros

As 8 skills abaixo foram importadas (subset) do repositório open-source
**tradermonty/claude-trading-skills** e adaptadas para o contexto do TradeAI.

- Origem: https://github.com/tradermonty/claude-trading-skills
- Commit importado: `029fb59e0544130a0bb9199f03e7e3fe303ee2e0`
- Data da importação: 2026-06-04
- Licença: MIT (texto integral abaixo — exigido pela licença)

## Skills importadas

| Skill | Por que entrou | Observação de adaptação |
|---|---|---|
| `technical-analyst` | Análise técnica de gráficos (ações, índices, **cripto**, forex) | Pronta p/ multimercado; entrada por imagem de gráfico |
| `position-sizer` | Sizing por risco (fixo, ATR, Kelly) — cálculo puro, offline | Texto diz "stock", mas a matemática é agnóstica de ativo |
| `signal-postmortem` | Postmortem de sinais (TP/FP/missed) | Referencia `edge-signal-aggregator` (não importado) — usar só a parte standalone |
| `trader-memory-core` | Ciclo de vida de tese / diário de trade | Genérica; alguns presets citam dividendos (US) |
| `trade-performance-coach` | Revisão de processo/risco pós-trade (beta) | Consome saídas de `trader-memory-core` + `signal-postmortem` |
| `backtest-expert` | Metodologia de backtest robusto ("beat ideas to death") | Casa com o `@tradeai/engine` (calibrate/backtest) |
| `trade-hypothesis-ideator` | Hipóteses falsificáveis + kill-criteria | Exporta formato `edge-finder-candidate/v1` (sibling não importado) |
| `dual-axis-skill-reviewer` | QA de skills (estrutura + review LLM) | Meta-skill p/ revisar suas próprias skills via `--project-root` |

> As ~48 skills restantes do repo foram **deixadas de fora** por serem
> US-específicas (FMP/FINVIZ/Alpaca, dividendos/impostos dos EUA, S&P 500/13F).
> Para reimportar mais: `git clone --depth 1 https://github.com/tradermonty/claude-trading-skills.git`.

> Os scripts Python embutidos podem exigir dependências (ex.: `pyyaml`) ao serem
> executados. Instale sob demanda quando a skill rodar um script.

---

MIT License

Copyright (c) 2026 TraderMonty

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
