import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ENGINE_VERSION } from "@tradeai/engine";
import {
  Logo,
  ConfidenceBadge,
  RadialGauge,
  EquityCurve,
  SignalBadge,
} from "@/components/ui";
import { signupsOpen } from "@/lib/signups";
import s from "./nova.module.css";

export const metadata: Metadata = {
  title: "Overtrader — A IA que prova antes de prometer (nova)",
  description:
    "Versão em avaliação da landing do Overtrader. Análise de trading com IA, auditável — amostra, intervalo de confiança e período em cada número.",
  robots: { index: false, follow: false },
};

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

const EQUITY = [0, 0.4, 0.2, 1.1, 0.9, 1.8, 1.5, 2.4, 2.1, 3.2, 3.0, 3.9, 4.6];

/* ---- ícones (stroke 1.6, currentColor) ---- */
const I = {
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="m3 12 9 4.5L21 12" /><path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  ),
  monte: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 20V4" /><path d="M3 16h4M3 11h2.5M3 7h6M3 20h7" />
      <path d="M12 20c2-7 4-11 9-13" /><circle cx="21" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  backtest: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18" /><rect x="5" y="11" width="3.4" height="7" rx="1" />
      <rect x="10.3" y="7" width="3.4" height="11" rx="1" /><rect x="15.6" y="13" width="3.4" height="5" rx="1" />
      <path d="M5 6.5 9 4l4 2 6-3.2" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8.5 13.4 11 12 13.5 10.6 11 12 8.5Z" />
    </svg>
  ),
};

export default function NovaHomePage() {
  const open = signupsOpen();
  return (
    <div className={s.page}>
      {/* NAV */}
      <nav className={s.nav}>
        <div className={`${s.wrap} ${s.navRow}`}>
          <a className={s.brand} href="/nova" aria-label="Overtrader">
            <Logo />
            <span className={s.name}>Overtrader</span>
            <span className={s.ia}>IA</span>
          </a>
          <div className={s.links}>
            <a href="#dores">Dores</a>
            <a href="#fosso">O fosso</a>
            <a href="#recursos">Recursos</a>
            <a href="#como">Como funciona</a>
            <a href="#precos">Preços</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className={s.ctas}>
            <a className={s.preview} href="/" title="Abrir a versão atual em produção">
              <span className={s.previewDot} /> ver versão atual
            </a>
            <a className={`${s.btn} ${s.ghost}`} href="/login">Entrar</a>
            {open ? (
              <a className={`${s.btn} ${s.primary}`} href="/login?mode=signup">Criar conta grátis</a>
            ) : null}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className={s.hero}>
        <div className={s.heroGlow} aria-hidden />
        <div className={s.heroGrid} aria-hidden />
        <div className={`${s.wrap} ${s.heroInner}`}>
          <div className={s.heroCopy}>
            <span className={`${s.eyebrow} ${s.rise} ${s.d1}`}>
              <span className={s.liveDot} /> Análise de trading com IA · auditável
            </span>
            <h1 className={`${s.h1} ${s.rise} ${s.d2}`}>
              A IA que <span className={s.prova}>prova</span>
              <br /> antes de prometer.
            </h1>
            <p className={`${s.lead} ${s.rise} ${s.d2}`}>
              Toda métrica vem com <b>amostra, intervalo de confiança e período</b>.
              Backtest público, walk-forward, algoritmos abertos. Onde o concorrente
              afirma, nós medimos — e dizemos quando <b>não</b> operar.
            </p>
            <div className={`${s.heroCtas} ${s.rise} ${s.d3}`}>
              <a className={`${s.btn} ${s.primary} ${s.lg}`} href="/analise">
                Analisar um ativo grátis
              </a>
              <a className={`${s.btn} ${s.lg}`} href="#fosso">Ver o diferencial</a>
            </div>
            <div className={`${s.trust} ${s.rise} ${s.d3}`}>
              <span className={s.trustSeal}><span className={s.trustLed} /> 3 análises completas vitalícias</span>
              <span className={s.trustSep}>·</span> sem cartão <span className={s.trustSep}>·</span> sem expiração
            </div>
          </div>

          {/* MOCK VIVO */}
          <div className={`${s.heroCard} ${s.rise} ${s.d4}`}>
            <div className={s.card}>
              <span className={s.scan} aria-hidden />
              <div className={s.cardBar}>
                <span className={s.live}><span className={s.liveDot} /> AO VIVO</span>
                <b>BTCUSDT</b>
                <span className={s.tf}>4H</span>
                <svg className={s.sparkSvg} width="62" height="18" viewBox="0 0 62 18" aria-hidden>
                  <polyline className={s.sparkLine} points="0,14 10,11 18,13 27,6 36,9 45,3 54,6 62,4" fill="none" stroke="var(--bull)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={s.engine}>ENGINE {ENGINE_VERSION}</span>
              </div>

              <div className={s.cardMain}>
                <div className={s.verdict}>
                  <SignalBadge direction="buy">Compra</SignalBadge>
                  <div className={s.verdictMeta}>
                    CONFLUÊNCIA 7/10<br />
                    <span className={s.votes}>VOTOS 12 · 5 · 3</span>
                  </div>
                </div>
                <RadialGauge value={72} size={112} stroke={9} caption="força" showOutOf />
              </div>

              <ConfidenceBadge
                label="Profit factor · backtest"
                value={1.89}
                ci={[1.42, 2.51]}
                n={142}
                method="bootstrap"
                period="jan/24–mai/26"
                min={0}
                max={3.5}
              />

              <div className={s.eqWrap}>
                <div className={s.eqHead}>
                  <span>Curva de R acumulado</span>
                  <span className={s.eqVal}>+4,6 R</span>
                </div>
                <EquityCurve data={EQUITY} height={64} gradientId="novaEq" />
              </div>

              <div className={s.sealRow}>
                <span className={s.seal}><span className={s.sealLed} /> VALIDADO</span>
                <span className={s.sealCap}><b>n + IC + período</b> em cada número.</span>
              </div>
            </div>
          </div>
        </div>

        {/* TICKER */}
        <div className={s.ticker} aria-hidden>
          <div className={s.tickerTrack}>
            {[...TICKER, ...TICKER].map((t, i) => (
              <span className={s.tickItem} key={i}>
                <b>{t.s}</b> {t.v}{" "}
                <span className={t.up ? s.up : s.dn}>{t.c}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* RAIL */}
      <section className={s.rail}>
        <div className={`${s.wrap} ${s.railGrid}`}>
          {[
            { n: "143", u: " ativos", k: "Cripto, ações, forex, índices, commodities" },
            { n: "5", u: " mercados", k: "Cobertura multi-classe num só motor" },
            { n: "15", u: " camadas", k: "Por sinal — técnica, SMC, Monte Carlo, notícias" },
            { n: "100%", u: " aberto", k: "Algoritmos auditáveis em código" },
          ].map((r) => (
            <div className={s.stat} key={r.n}>
              <div className={s.statN}>
                {r.n}<span className={s.statU}>{r.u}</span>
              </div>
              <div className={s.statK}>{r.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DORES */}
      <section className={`${s.wrap} ${s.section}`} id="dores">
        <div className={s.head}>
          <span className={s.label}>Dores do trader</span>
          <h2 className={s.h2}>Você reconhece alguma destas?</h2>
          <p className={s.sub}>
            Não vendemos sonho. Reconhecemos o que dói de verdade — e mostramos
            como o Overtrader responde com método, não com promessa.
          </p>
        </div>
        <div className={s.pains}>
          {[
            ["“Entrei num sinal de <b>‘IA 99%’</b> que nunca me mostrou a amostra nem o histórico.”", "Aqui todo número vem com <b>amostra (n), IC 95% e período</b>. Sem amostra, sem selo verde."],
            ["“Operei no escuro, sem saber a <b>chance real</b> de o stop bater antes do alvo.”", "Cenários por <b>first-passage</b> (Monte Carlo): probabilidade de cada TP e do stop, com IC."],
            ["“O app <b>nunca</b> me diz pra ficar de fora — está sempre confiante.”", "O selo <b>reprova</b> sinais ruins e lista os motivos para <b>NÃO operar</b>. Honestidade acima do engajamento."],
            ["“Paguei caro e <b>não consegui reembolso</b> quando quis cancelar.”", "<b>Reembolso de 7 dias</b> respeitado (art. 49 do CDC), com CNPJ, Termos e contato visíveis."],
            ["“Promessa de <b>robô que opera sozinho</b> e multiplica capital.”", "Somos ferramenta de <b>análise</b>, não execução. Você decide — sem o risco regulatório dos robôs."],
            ["“Não sei se a ferramenta é <b>séria</b> — backtest? como o número saiu?”", "<b>Backtest público</b> walk-forward e <b>algoritmos abertos</b> (SMC, harmônicos, WEGD) legíveis em código."],
          ].map(([q, a], i) => (
            <div className={s.pain} key={i}>
              <div className={s.pq} dangerouslySetInnerHTML={{ __html: q! }} />
              <div className={s.pa}>
                <span className={s.arrow}>→</span>
                <span dangerouslySetInnerHTML={{ __html: a! }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOSSO */}
      <section className={`${s.wrap} ${s.section}`} id="fosso">
        <div className={s.head}>
          <span className={s.label}>O fosso · transparência vs caixa-preta</span>
          <h2 className={s.h2}>O concorrente afirma. Nós mostramos a conta.</h2>
          <p className={s.sub}>
            A maioria das “IAs de trading” entrega um número bonito e pede fé.
            O nosso diferencial é estatístico: honestidade em cada métrica.
          </p>
        </div>
        <div className={s.compare}>
          <div className={`${s.col} ${s.us}`}>
            <h3 className={s.colHead}>
              Overtrader <span className={s.badgeProva}>PROVA</span>
            </h3>
            {[
              "<b>Backtest público</b> em toda análise — walk-forward, train/test, sem lookahead.",
              "<b>IC + amostra + período</b> em cada número. Sem amostra, sem selo verde.",
              "<b>Algoritmos abertos</b> — SMC, harmônicos, WEGD legíveis em código.",
              "<b>7 níveis de sinal</b> + probabilidade por Monte Carlo (first-passage).",
              "<b>Selo de qualidade</b> que avisa quando <b>não</b> operar.",
              "<b>CNPJ, Termos e reembolso de 7 dias</b> visíveis — conformidade que dá pra checar.",
              "<b>Sem robôs / auto-execução</b> — ferramenta de análise; você no controle.",
              "<b>Trial vitalício</b> sem cartão.",
            ].map((t, i) => (
              <div className={s.cmp} key={i}>
                <span className={`${s.cmpI} ${s.ok}`} aria-hidden>✓</span>
                <span dangerouslySetInnerHTML={{ __html: t }} />
              </div>
            ))}
          </div>
          <div className={`${s.col} ${s.them}`}>
            <h3 className={s.colHead}>IA caixa-preta</h3>
            {[
              "Sem backtest público — “acurácia 99%” sem contexto nem amostra.",
              "Número cru, sem incerteza. Win rate 100% sobre 3 trades.",
              "Caixa-preta — você não vê como a conclusão foi gerada.",
              "3 níveis (compra/venda/neutro) e probabilidade por fórmula frágil.",
              "Sempre confiante — nunca diz “fique de fora”.",
              "Sem CNPJ, termos ou reembolso claros — confiança que você não consegue verificar.",
              "Promete robôs e lucros — o que costuma virar reclamação.",
              "Trial pago, com cartão.",
            ].map((t, i) => (
              <div className={s.cmp} key={i}>
                <span className={`${s.cmpI} ${s.no}`} aria-hidden>✕</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section className={`${s.wrap} ${s.section}`} id="recursos">
        <div className={s.head}>
          <span className={s.label}>Recursos</span>
          <h2 className={s.h2}>Um motor. Quinze camadas. Zero achismo.</h2>
        </div>
        <div className={s.feat}>
          {[
            [I.layers, "15 camadas por sinal", "Técnica (20 indicadores), SMC, multi-timeframe, harmônicos, WEGD e notícias — agregadas com pesos versionados."],
            [I.monte, "Monte Carlo honesto", "Probabilidade de tocar cada alvo por simulação first-passage — não fórmula fechada. Estimativa + intervalo."],
            [I.backtest, "Backtest walk-forward", "≥12 meses, train/test, sem lookahead. Profit factor, win rate e R médio, cada um com IC e amostra."],
            [I.grid, "Dashboard 5 mercados", "Preços ao vivo de cripto, ações, forex, índices e commodities num só painel — com Fear & Greed."],
            [I.bell, "Alertas no Telegram", "Pareie sua conta e receba os sinais validados direto no Telegram, com o selo de qualidade junto."],
            [I.spark, "IA narrativa real", "Resumo em português gerado por LLM sobre as 15 camadas — explica o porquê, não só o quê."],
          ].map(([icon, title, body], i) => (
            <div className={s.fcard} key={i}>
              <div className={s.ic}>{icon as ReactNode}</div>
              <h4 className={s.fTitle}>{title as string}</h4>
              <p className={s.fBody}>{body as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className={`${s.wrap} ${s.section}`} id="como">
        <div className={s.head}>
          <span className={s.label}>Como funciona</span>
          <h2 className={s.h2}>Do ativo ao plano operacional em segundos.</h2>
        </div>
        <div className={s.steps}>
          <span className={s.stepsLine} aria-hidden />
          {[
            ["Escolha o ativo", "143 ativos em 5 mercados, no timeframe que você opera."],
            ["O motor calcula", "15 camadas, Monte Carlo e backtest rodam de forma determinística."],
            ["Leia o veredito", "Sinal, força, níveis por ATR e o selo de qualidade — com a conta à mostra."],
            ["Execute (ou não)", "Plano operacional claro. E o aviso honesto quando a amostra não sustenta."],
          ].map(([t, b], i) => (
            <div className={s.step} key={i}>
              <span className={s.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <h4 className={s.stepTitle}>{t}</h4>
              <p className={s.stepBody}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section className={`${s.wrap} ${s.section}`} id="precos">
        <div className={s.head}>
          <span className={s.label}>Preços</span>
          <h2 className={s.h2}>Comece de graça. Para sempre.</h2>
          <p className={s.sub}>
            Sem cartão para testar. Faça upgrade quando o motor já tiver provado o
            valor pra você. <b>Ferramentas opacas cobram R$337–749/mês</b> — aqui o
            PRO custa R$97 e você vê a conta por trás de cada número.
          </p>
        </div>
        <div className={s.plans}>
          <div className={s.plan}>
            <div className={s.pn}>Free</div>
            <div className={s.pp}>R$0<small>/sempre</small></div>
            <div className={s.pd}>Para conhecer o motor e o padrão de honestidade.</div>
            <ul className={s.planList}>
              <li><span className={s.c}>✓</span> 3 análises completas vitalícias</li>
              <li><span className={s.c}>✓</span> Dashboard de preços ao vivo</li>
              <li><span className={s.c}>✓</span> Selo de qualidade em toda análise</li>
            </ul>
            <a className={s.btn} href={open ? "/login?mode=signup" : "/login"}>
              {open ? "Criar conta grátis" : "Entrar"}
            </a>
          </div>

          <div className={`${s.plan} ${s.pro}`}>
            <span className={s.tagPro}>Mais popular</span>
            <div className={s.pn}>PRO</div>
            <div className={s.pp}>R$97<small>/mês</small></div>
            <div className={s.ppYr}>ou R$970/ano · 2 meses grátis</div>
            <div className={s.pd}>Para quem opera com frequência e quer o motor completo.</div>
            <ul className={s.planList}>
              <li><span className={s.c}>✓</span> Análises ilimitadas · 143 ativos</li>
              <li><span className={s.c}>✓</span> 15 camadas + Monte Carlo + backtest</li>
              <li><span className={s.c}>✓</span> Alertas no Telegram</li>
              <li><span className={s.c}>✓</span> Histórico completo</li>
            </ul>
            <a className={`${s.btn} ${s.primary}`} href="/planos">Assinar o PRO</a>
          </div>

          <div className={s.plan}>
            <div className={s.pn}>PRO+</div>
            <div className={s.pp}>R$197<small>/mês</small></div>
            <div className={s.ppYr}>ou R$1.970/ano · 2 meses grátis</div>
            <div className={s.pd}>Para o trader avançado e profissional.</div>
            <ul className={s.planList}>
              <li><span className={s.c}>✓</span> Tudo do PRO</li>
              <li><span className={s.c}>✓</span> Backtest segmentado por regime</li>
              <li><span className={s.c}>✓</span> Alertas multi-ativo prioritários</li>
              <li><span className={s.c}>✓</span> Suporte dedicado</li>
            </ul>
            <a className={s.btn} href="/planos">Assinar o PRO+</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${s.wrap} ${s.section}`} id="faq">
        <div className={s.head}>
          <span className={s.label}>Dúvidas</span>
          <h2 className={s.h2}>Tire suas dúvidas.</h2>
        </div>
        <div className={s.faq}>
          {[
            ["Isso é recomendação de investimento?", "Não. É conteúdo informativo e educativo. O Overtrader não constitui recomendação personalizada — decisões de investimento são sempre suas."],
            ["O que significa “prova antes de prometer”?", "Todo número exibido carrega o tamanho de amostra (n), o intervalo de confiança e o período. Se a amostra é insuficiente, o produto diz isso em vez de mostrar um número bonito."],
            ["Como o selo de qualidade decide a cor?", "O selo só fica verde quando o limite inferior do intervalo de confiança supera o limiar — nunca sobre amostra pequena ou ruidosa."],
            ["Preciso de cartão para testar?", "Não. São 3 análises completas vitalícias, sem cartão e sem expiração."],
          ].map(([q, a], i) => (
            <details className={s.qa} key={i}>
              <summary className={s.q}>
                {q}<span className={s.plus} aria-hidden />
              </summary>
              <div className={s.a}>{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className={`${s.wrap} ${s.section}`}>
        <div className={s.final}>
          <span className={s.finalGlow} aria-hidden />
          <span className={s.label} style={{ justifyContent: "center" }}>Pronto para começar</span>
          <h2 className={s.h2}>Pare de operar no escuro.</h2>
          <p className={s.sub}>
            Rode sua primeira análise auditável agora — de graça, sem cartão.
            Veja a conta antes de confiar nela.
          </p>
          <a className={`${s.btn} ${s.primary} ${s.lg}`} href="/analise">
            Analisar um ativo grátis
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footRow}`}>
          <div className={s.brand}>
            <Logo /><span className={s.name}>Overtrader</span><span className={s.ia}>IA</span>
          </div>
          <div className={s.footCol}>
            <span className={s.footH}>Produto</span>
            <a href="#recursos">Recursos</a><a href="#precos">Preços</a><a href="#como">Como funciona</a>
          </div>
          <div className={s.footCol}>
            <span className={s.footH}>Empresa</span>
            <a href="#">Sobre</a><a href="/roadmap">Roadmap público</a><a href="#faq">FAQ</a>
          </div>
          <div className={s.footCol}>
            <span className={s.footH}>Legal</span>
            <a href="/termos">Termos de uso</a><a href="/privacidade">Política de privacidade</a>
          </div>
        </div>
        <div className={`${s.wrap} ${s.legal}`}>
          <span>© 2026 OVERTRADER · CONTEÚDO INFORMATIVO · NÃO CONSTITUI RECOMENDAÇÃO PERSONALIZADA · ENGINE {ENGINE_VERSION}</span>
          <span>FEITO COM RIGOR ESTATÍSTICO</span>
        </div>
      </footer>
    </div>
  );
}
