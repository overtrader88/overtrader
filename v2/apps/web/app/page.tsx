import { ENGINE_VERSION } from "@tradeai/engine";
import { Logo, ConfidenceBadge, RadialGauge } from "@/components/ui";

const TICKER = [
  { s: "BTC", v: "67.420", c: "+2,14%", up: true },
  { s: "ETH", v: "3.512", c: "+1,38%", up: true },
  { s: "PETR4", v: "38,21", c: "−0,84%", up: false },
  { s: "EUR/USD", v: "1,0892", c: "+0,12%", up: true },
  { s: "IBOV", v: "131,4k", c: "+0,57%", up: true },
  { s: "OURO", v: "2.341", c: "−0,31%", up: false },
  { s: "SOL", v: "176,40", c: "+3,20%", up: true },
  { s: "VALE3", v: "61,07", c: "−0,40%", up: false },
  { s: "S&P 500", v: "5.844", c: "+0,31%", up: true },
];

export default function HomePage() {
  return (
    <>
      {/* NAV */}
      <nav className="nav-top">
        <div className="wrap row">
          <div className="brand">
            <Logo />
            <span className="name">Overtrader</span><span className="ia">IA</span>
          </div>
          <div className="navlinks">
            <a href="#dores">Dores</a>
            <a href="#fosso">O fosso</a>
            <a href="#recursos">Recursos</a>
            <a href="#como">Como funciona</a>
            <a href="#precos">Preços</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-cta">
            <a className="btn ghost" href="/login">Entrar</a>
            <a className="btn primary" href="/login?mode=signup">Criar conta grátis</a>
          </div>
        </div>
      </nav>

      {/* TICKER — ao vivo, full-bleed */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span className="it" key={i}>
              <b>{t.s}</b> {t.v} <span className={t.up ? "up" : "dn"}>{t.c}</span>
            </span>
          ))}
        </div>
      </div>

      {/* HERO */}
      <div className="wrap">
        <section className="hero">
          <div className="hero-trace" aria-hidden>
            <svg viewBox="0 0 1200 320" preserveAspectRatio="none">
              <path className="trace" d="M0,250 C90,250 150,150 240,170 C330,190 360,90 470,120 C580,150 600,60 720,90 C840,120 870,200 980,160 C1080,124 1130,182 1200,150" />
              <circle className="trace-dot" cx="1200" cy="150" r="3.5" />
            </svg>
          </div>

          <div className="hero-copy">
            <span className="label rise d1">Análise de trading com IA · auditável</span>
            <h1 className="rise d2">A IA que <span className="prova">prova</span><br />antes de prometer.</h1>
            <p className="lead rise d2">
              Toda métrica vem com amostra, intervalo de confiança e período. Backtest público,
              walk-forward, algoritmos abertos. Onde o concorrente afirma, nós medimos — e dizemos
              quando <b style={{ color: "var(--ink)" }}>não</b> operar.
            </p>
            <div className="ctas rise d3">
              <a className="btn primary lg" href="/analise">Analisar um ativo grátis</a>
              <a className="btn lg" href="#fosso">Ver o diferencial</a>
            </div>
            <div className="trust rise d3">
              <span className="am">●</span> <b>3 análises completas vitalícias</b> · sem cartão · sem expiração
            </div>
          </div>

          <div className="hero-inst rise d4">
            <div className="inst">
              <span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" />
              <div className="bar">
                <span className="dot" /><b>BTCUSDT</b> · 4H
                <svg className="spark" width="56" height="16" aria-hidden>
                  <polyline points="0,13 9,10 18,12 27,6 36,8 45,3 56,5" fill="none" stroke="#2BD49E" strokeWidth="1.4" />
                </svg>
                <span className="r">ENGINE {ENGINE_VERSION}</span>
              </div>
              <div className="inst-main">
                <div className="sig"><div className="v">Compra<small>CONFLUÊNCIA 7/10 · VOTOS 12·5·3</small></div></div>
                <RadialGauge value={72} size={104} stroke={8} caption="força" showOutOf />
              </div>
              <ConfidenceBadge label="Profit factor · backtest" value={1.89} ci={[1.42, 2.51]} n={142} method="bootstrap" min={0} max={3.5} />
              <div className="seal-row">
                <span className="seal"><span className="led" />VALIDADO</span>
                <span className="cap"><b style={{ color: "var(--ink-soft)" }}>n + IC + período</b> em cada número.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* RAIL — telemetria, full-bleed */}
      <div className="rail">
        <div className="wrap rail-grid">
          <div className="s"><div className="n font-mono">143<span className="u"> ativos</span></div><div className="k">Cripto, ações, forex, índices, commodities</div></div>
          <div className="s"><div className="n font-mono">5<span className="u"> mercados</span></div><div className="k">Cobertura multi-classe num só motor</div></div>
          <div className="s"><div className="n font-mono">15<span className="u"> camadas</span></div><div className="k">Por sinal — técnica, SMC, Monte Carlo, notícias</div></div>
          <div className="s"><div className="n font-mono">100%<span className="u"> aberto</span></div><div className="k">Algoritmos auditáveis em código</div></div>
        </div>
      </div>

      {/* DORES DO TRADER */}
      <div className="wrap">
        <section className="blk" id="dores">
          <div className="head">
            <span className="label">Dores do trader</span>
            <h2>Você reconhece alguma destas?</h2>
            <p>Não vendemos sonho. Reconhecemos o que dói de verdade — e mostramos como o Overtrader responde com método, não com promessa.</p>
          </div>
          <div className="pains">
            <div className="pain">
              <div className="pq">“Entrei num sinal de <b>‘IA 99%’</b> que nunca me mostrou a amostra nem o histórico.”</div>
              <div className="pa"><span className="i">→</span> Aqui todo número vem com <b>amostra (n), IC 95% e período</b>. Sem amostra, sem selo verde.</div>
            </div>
            <div className="pain">
              <div className="pq">“Operei no escuro, sem saber a <b>chance real</b> de o stop bater antes do alvo.”</div>
              <div className="pa"><span className="i">→</span> Cenários por <b>first-passage</b> (Monte Carlo): probabilidade de cada TP e do stop, com IC.</div>
            </div>
            <div className="pain">
              <div className="pq">“O app <b>nunca</b> me diz pra ficar de fora — está sempre confiante.”</div>
              <div className="pa"><span className="i">→</span> O selo <b>reprova</b> sinais ruins e lista os motivos para <b>NÃO operar</b>. Honestidade acima do engajamento.</div>
            </div>
            <div className="pain">
              <div className="pq">“Paguei caro e <b>não consegui reembolso</b> quando quis cancelar.”</div>
              <div className="pa"><span className="i">→</span> <b>Reembolso de 7 dias</b> respeitado (art. 49 do CDC), com CNPJ, Termos e contato visíveis.</div>
            </div>
            <div className="pain">
              <div className="pq">“Promessa de <b>robô que opera sozinho</b> e multiplica capital.”</div>
              <div className="pa"><span className="i">→</span> Somos ferramenta de <b>análise</b>, não execução. Você decide — sem o risco regulatório dos robôs.</div>
            </div>
            <div className="pain">
              <div className="pq">“Não sei se a ferramenta é <b>séria</b> — backtest? como o número saiu?”</div>
              <div className="pa"><span className="i">→</span> <b>Backtest público</b> walk-forward e <b>algoritmos abertos</b> (SMC, harmônicos, WEGD) legíveis em código.</div>
            </div>
          </div>
        </section>
      </div>

      {/* FOSSO */}
      <div className="wrap">
        <section className="blk" id="fosso">
          <div className="head">
            <span className="label">O fosso · transparência vs caixa-preta</span>
            <h2>O concorrente afirma. Nós mostramos a conta.</h2>
            <p>A maioria das “IAs de trading” entrega um número bonito e pede fé. O nosso diferencial é estatístico: honestidade em cada métrica.</p>
          </div>
          <div className="compare">
            <div className="col us">
              <h3>Overtrader <span className="badge">PROVA</span></h3>
              <div className="cmp"><span className="i">✓</span><span><b>Backtest público</b> em toda análise — walk-forward, train/test, sem lookahead.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>IC + amostra + período</b> em cada número. Sem amostra, sem selo verde.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>Algoritmos abertos</b> — SMC, harmônicos, WEGD legíveis em código.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>7 níveis de sinal</b> + probabilidade por Monte Carlo (first-passage).</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>Selo de qualidade</b> que avisa quando <b>não</b> operar.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>CNPJ, Termos e reembolso de 7 dias</b> visíveis — conformidade que dá pra checar.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>Sem robôs / auto-execução</b> — ferramenta de análise; você no controle.</span></div>
              <div className="cmp"><span className="i">✓</span><span><b>Trial vitalício</b> sem cartão.</span></div>
            </div>
            <div className="col them">
              <h3>IA caixa-preta</h3>
              <div className="cmp"><span className="i">✕</span><span>Sem backtest público — “acurácia 99%” sem contexto nem amostra.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Número cru, sem incerteza. Win rate 100% sobre 3 trades.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Caixa-preta — você não vê como a conclusão foi gerada.</span></div>
              <div className="cmp"><span className="i">✕</span><span>3 níveis (compra/venda/neutro) e probabilidade por fórmula frágil.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Sempre confiante — nunca diz “fique de fora”.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Sem CNPJ, termos ou reembolso claros — confiança que você não consegue verificar.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Promete robôs e lucros — o que costuma virar reclamação.</span></div>
              <div className="cmp"><span className="i">✕</span><span>Trial pago, com cartão.</span></div>
            </div>
          </div>
        </section>
      </div>

      {/* RECURSOS */}
      <div className="wrap">
        <section className="blk" id="recursos">
          <div className="head"><span className="label">Recursos</span><h2>Um motor. Quinze camadas. Zero achismo.</h2></div>
          <div className="feat">
            <div className="fcard"><div className="ic">▤</div><h4>15 camadas por sinal</h4><p>Técnica (20 indicadores), SMC, multi-timeframe, harmônicos, WEGD e notícias — agregadas com pesos versionados.</p></div>
            <div className="fcard"><div className="ic">∿</div><h4>Monte Carlo honesto</h4><p>Probabilidade de tocar cada alvo por simulação first-passage — não fórmula fechada. Estimativa + intervalo.</p></div>
            <div className="fcard"><div className="ic">▦</div><h4>Backtest walk-forward</h4><p>≥12 meses, train/test, sem lookahead. Profit factor, win rate e R médio, cada um com IC e amostra.</p></div>
            <div className="fcard"><div className="ic">◷</div><h4>Dashboard 5 mercados</h4><p>Preços ao vivo de cripto, ações, forex, índices e commodities num só painel — com Fear &amp; Greed.</p></div>
            <div className="fcard"><div className="ic">◈</div><h4>Alertas no Telegram</h4><p>Pareie sua conta e receba os sinais validados direto no Telegram, com o selo de qualidade junto.</p></div>
            <div className="fcard"><div className="ic">✶</div><h4>IA narrativa real</h4><p>Resumo em português gerado por LLM sobre as 15 camadas — explica o porquê, não só o quê.</p></div>
          </div>
        </section>
      </div>

      {/* COMO FUNCIONA */}
      <div className="wrap">
        <section className="blk" id="como">
          <div className="head"><span className="label">Como funciona</span><h2>Do ativo ao plano operacional em segundos.</h2></div>
          <div className="steps">
            <div className="step"><h4>Escolha o ativo</h4><p>143 ativos em 5 mercados, no timeframe que você opera.</p></div>
            <div className="step"><h4>O motor calcula</h4><p>15 camadas, Monte Carlo e backtest rodam de forma determinística.</p></div>
            <div className="step"><h4>Leia o veredito</h4><p>Sinal, força, níveis por ATR e o selo de qualidade — com a conta à mostra.</p></div>
            <div className="step"><h4>Execute (ou não)</h4><p>Plano operacional claro. E o aviso honesto quando a amostra não sustenta.</p></div>
          </div>
        </section>
      </div>

      {/* PREÇOS */}
      <div className="wrap">
        <section className="blk" id="precos">
          <div className="head"><span className="label">Preços</span><h2>Comece de graça. Para sempre.</h2><p>Sem cartão para testar. Faça upgrade quando o motor já tiver provado o valor pra você. <b>Ferramentas opacas cobram R$337–749/mês</b> — aqui o PRO custa R$97 e você vê a conta por trás de cada número.</p></div>
          <div className="plans">
            <div className="plan">
              <div className="pn">Free</div>
              <div className="pp font-mono">R$0<small>/sempre</small></div>
              <div className="pd">Para conhecer o motor e o padrão de honestidade.</div>
              <ul>
                <li><span className="c">✓</span> 3 análises completas vitalícias</li>
                <li><span className="c">✓</span> Dashboard de preços ao vivo</li>
                <li><span className="c">✓</span> Selo de qualidade em toda análise</li>
              </ul>
              <a className="btn" href="/login?mode=signup">Criar conta grátis</a>
            </div>
            <div className="plan pro">
              <span className="tagp">Mais popular</span>
              <div className="pn">PRO</div>
              <div className="pp font-mono">R$97<small>/mês</small></div>
              <div className="pp-yr">ou R$970/ano · 2 meses grátis</div>
              <div className="pd">Para quem opera com frequência e quer o motor completo.</div>
              <ul>
                <li><span className="c">✓</span> Análises ilimitadas · 143 ativos</li>
                <li><span className="c">✓</span> 15 camadas + Monte Carlo + backtest</li>
                <li><span className="c">✓</span> Alertas no Telegram</li>
                <li><span className="c">✓</span> Histórico completo</li>
              </ul>
              <a className="btn primary" href="/planos">Assinar o PRO</a>
            </div>
            <div className="plan">
              <div className="pn">PRO+</div>
              <div className="pp font-mono">R$197<small>/mês</small></div>
              <div className="pp-yr">ou R$1.970/ano · 2 meses grátis</div>
              <div className="pd">Para o trader avançado e profissional.</div>
              <ul>
                <li><span className="c">✓</span> Tudo do PRO</li>
                <li><span className="c">✓</span> Backtest segmentado por regime</li>
                <li><span className="c">✓</span> Alertas multi-ativo prioritários</li>
                <li><span className="c">✓</span> Suporte dedicado</li>
              </ul>
              <a className="btn" href="/planos">Assinar o PRO+</a>
            </div>
          </div>
        </section>
      </div>

      {/* FAQ */}
      <div className="wrap">
        <section className="blk" id="faq">
          <div className="head"><span className="label">Dúvidas</span><h2>Tire suas dúvidas.</h2></div>
          <div className="faq">
            <div className="qa"><div className="q">Isso é recomendação de investimento? <span className="pl">+</span></div><div className="a">Não. É conteúdo informativo e educativo. O Overtrader não constitui recomendação personalizada — decisões de investimento são sempre suas.</div></div>
            <div className="qa"><div className="q">O que significa “prova antes de prometer”? <span className="pl">+</span></div><div className="a">Todo número exibido carrega o tamanho de amostra (n), o intervalo de confiança e o período. Se a amostra é insuficiente, o produto diz isso em vez de mostrar um número bonito.</div></div>
            <div className="qa"><div className="q">Como o selo de qualidade decide a cor? <span className="pl">+</span></div><div className="a">O selo só fica verde quando o limite inferior do intervalo de confiança supera o limiar — nunca sobre amostra pequena ou ruidosa.</div></div>
            <div className="qa"><div className="q">Preciso de cartão para testar? <span className="pl">+</span></div><div className="a">Não. São 3 análises completas vitalícias, sem cartão e sem expiração.</div></div>
          </div>
        </section>
      </div>

      {/* CTA FINAL */}
      <div className="wrap">
        <section className="final">
          <span className="label" style={{ justifyContent: "center" }}>Pronto para começar</span>
          <h2 style={{ marginTop: 14 }}>Pare de operar no escuro.</h2>
          <p>Rode sua primeira análise auditável agora — de graça, sem cartão. Veja a conta antes de confiar nela.</p>
          <a className="btn primary lg" href="/analise">Analisar um ativo grátis</a>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="ft">
        <div className="wrap">
          <div className="row">
            <div className="brand"><Logo /><span className="name">Overtrader</span><span className="ia">IA</span></div>
            <div className="col2"><span className="h">Produto</span><a href="#recursos">Recursos</a><a href="#precos">Preços</a><a href="#como">Como funciona</a></div>
            <div className="col2"><span className="h">Empresa</span><a href="#">Sobre</a><a href="/roadmap">Roadmap público</a><a href="#faq">FAQ</a></div>
            <div className="col2"><span className="h">Legal</span><a href="/termos">Termos de uso</a><a href="/privacidade">Política de privacidade</a></div>
          </div>
          <div className="legal">
            <span>© 2026 OVERTRADER · CONTEÚDO INFORMATIVO · NÃO CONSTITUI RECOMENDAÇÃO PERSONALIZADA · ENGINE {ENGINE_VERSION}</span>
            <span>FEITO COM RIGOR ESTATÍSTICO</span>
          </div>
        </div>
      </footer>
    </>
  );
}
