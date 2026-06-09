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
import v from "./v3.module.css";

export const metadata: Metadata = {
  title: "Overtrader — Pare de apostar em “IA 99%” (v3)",
  description:
    "Versão em avaliação da landing do Overtrader. Análise de trading com IA auditável — amostra, IC e período em cada número, backtest público e algoritmos abertos.",
  robots: { index: false, follow: false },
};

const MARKETS = [
  { s: "BTC", v: "67.420", c: "+2,14%", up: true },
  { s: "S&P 500", v: "5.844", c: "+0,31%", up: true },
  { s: "EUR/USD", v: "1,0892", c: "+0,12%", up: true },
  { s: "OURO", v: "2.341", c: "−0,31%", up: false },
  { s: "PETR4", v: "38,21", c: "−0,84%", up: false },
];

const EQUITY = [0, 0.3, 0.1, 0.9, 0.7, 1.6, 1.3, 2.3, 2.0, 3.1, 2.8, 3.8, 4.6];

const I: Record<string, ReactNode> = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
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
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" /><path d="m3 12 9 4.5L21 12" /><path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  ),
};

export default function V3HomePage() {
  const open = signupsOpen();
  return (
    <div className={v.page}>
      <div className={v.aurora} aria-hidden />

      {/* NAV */}
      <nav className={v.nav}>
        <div className={`${v.wrap} ${v.navRow}`}>
          <a className={v.brand} href="/v3" aria-label="Overtrader">
            <Logo />
            <span className={v.name}>Overtrader</span>
            <span className={v.ia}>IA</span>
          </a>
          <div className={v.switcher} role="group" aria-label="Versões da landing">
            <a href="/">Atual</a>
            <a href="/nova">v2</a>
            <a href="/v3" className={v.switchActive} aria-current="page">v3</a>
          </div>
          <div className={v.navCtas}>
            <a className={`${v.btn} ${v.ghost}`} href="/login">Entrar</a>
            <a className={`${v.btn} ${v.primary}`} href="/analise">Analisar grátis</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className={v.hero}>
        <div className={`${v.wrap} ${v.heroWrap}`}>
          <div className={v.heroCopy}>
            <span className={`${v.kicker} ${v.rise} ${v.d1}`}>
              <span className={v.kickerDot} /> Chega de apostar em “IA 99%”
            </span>
            <h1 className={`${v.h1} ${v.rise} ${v.d2}`}>
              A IA que <span className={v.grad}>prova</span><br />
              antes de prometer.
            </h1>
            <p className={`${v.sub} ${v.rise} ${v.d3}`}>
              Cada sinal vem com <b>amostra, intervalo de confiança e período</b> —
              backtest público e algoritmos abertos. Você vê a conta
              <b> antes</b> de arriscar o seu dinheiro. E ela diz até quando
              <b> não</b> operar.
            </p>
            <div className={`${v.ctaRow} ${v.rise} ${v.d4}`}>
              <a className={`${v.btn} ${v.primary} ${v.lg}`} href="/analise">
                Analisar um ativo grátis <span className={v.arrow}>→</span>
              </a>
              <a className={`${v.btn} ${v.lg} ${v.glassBtn}`} href="#precos">Ver planos</a>
            </div>
            <div className={`${v.chips} ${v.rise} ${v.d5}`}>
              <span className={v.chip}>✓ Sem cartão</span>
              <span className={v.chip}>✓ 3 análises vitalícias</span>
              <span className={v.chip}>✓ Reembolso de 7 dias</span>
              <span className={v.chip}>✓ Algoritmos abertos</span>
            </div>
          </div>

          {/* CARTÃO VIVO (glass) */}
          <div className={`${v.heroCard} ${v.rise} ${v.d3}`}>
            <div className={v.glow} aria-hidden />
            <div className={v.card}>
              <div className={v.cardTop}>
                <span className={v.live}><span className={v.liveDot} /> AO VIVO</span>
                <b>BTCUSDT</b><span className={v.tf}>4H</span>
                <span className={v.engine}>ENGINE {ENGINE_VERSION}</span>
              </div>
              <div className={v.cardMain}>
                <div className={v.verdict}>
                  <SignalBadge direction="buy">Compra</SignalBadge>
                  <div className={v.vmeta}>CONFLUÊNCIA 7/10<br /><span className={v.votes}>VOTOS 12 · 5 · 3</span></div>
                </div>
                <RadialGauge value={72} size={116} stroke={9} caption="força" showOutOf />
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
              <div className={v.cardSeal}>
                <span className={v.seal}><span className={v.sealLed} /> VALIDADO</span>
                <span className={v.sealCap}>Selo verde só quando o pior caso do IC supera o limiar.</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* PROOF BAND */}
      <section className={v.proof}>
        <div className={`${v.wrap} ${v.proofGrid}`}>
          {[
            ["143", "ativos", "5 mercados num só motor"],
            ["15", "camadas", "por sinal, com pesos versionados"],
            ["100%", "auditável", "algoritmos abertos em código"],
            ["7 dias", "de reembolso", "art. 49 do CDC, sem pegadinha"],
          ].map(([n, u, k]) => (
            <div className={`${v.proofItem} ${v.reveal}`} key={u}>
              <div className={v.proofNum}>{n}<span>{" "}{u}</span></div>
              <div className={v.proofLabel}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BENTO */}
      <section className={`${v.wrap} ${v.section}`} id="recursos">
        <div className={v.head}>
          <span className={v.eyebrow}>O produto</span>
          <h2 className={v.h2}>Uma análise que você consegue <span className={v.grad}>auditar</span>.</h2>
          <p className={v.lead}>
            Quinze camadas, Monte Carlo honesto e backtest público — agregados num
            veredito único, com a conta à mostra em cada número.
          </p>
        </div>

        <div className={v.bento}>
          {/* tile grande: demo */}
          <article className={`${v.tile} ${v.tDemo} ${v.reveal}`}>
            <span className={v.tileLabel}>Veredito do motor</span>
            <div className={v.demoRow}>
              <div className={v.demoVerdict}>
                <SignalBadge direction="buy">Compra</SignalBadge>
                <div className={v.demoMeta}>7/10 confluência<br /><span>força 72/100</span></div>
              </div>
              <RadialGauge value={72} size={120} stroke={9} caption="força" showOutOf />
            </div>
            <ConfidenceBadge
              label="Profit factor · backtest"
              value={1.89}
              ci={[1.42, 2.51]}
              n={142}
              method="bootstrap"
              min={0}
              max={3.5}
            />
            <p className={v.tileBody}>
              Direção, força e níveis por ATR — e o aviso honesto quando a amostra
              não sustenta a operação.
            </p>
          </article>

          {/* backtest */}
          <article className={`${v.tile} ${v.tBacktest} ${v.reveal}`}>
            <span className={v.tileLabel}>Backtest público</span>
            <h3 className={v.tileTitle}>Walk-forward, sem lookahead</h3>
            <div className={v.eqWrap}>
              <EquityCurve data={EQUITY} height={84} gradientId="v3eq" />
            </div>
            <div className={v.eqFoot}>
              <span>Curva de R acumulado</span>
              <span className={v.eqVal}>+4,6 R · n=142</span>
            </div>
          </article>

          {/* monte carlo */}
          <article className={`${v.tile} ${v.tMonte} ${v.reveal}`}>
            <span className={v.tileLabel}>Monte Carlo</span>
            <h3 className={v.tileTitle}>Probabilidade honesta</h3>
            <div className={v.bars} aria-hidden>
              <span style={{ height: "68%" }}><i>TP1</i></span>
              <span style={{ height: "41%" }}><i>TP2</i></span>
              <span style={{ height: "22%" }} className={v.barBear}><i>stop</i></span>
            </div>
            <p className={v.tileBody}>Chance de tocar cada alvo por first-passage — com intervalo, não fórmula fechada.</p>
          </article>

          {/* selo */}
          <article className={`${v.tile} ${v.tSelo} ${v.reveal}`}>
            <span className={`${v.seal} ${v.sealBig}`}><span className={v.sealLed} /> SELO DE QUALIDADE</span>
            <p className={v.tileBody}>
              Verde só quando o limite inferior do IC supera o limiar. O motor
              <b> reprova</b> sinais fracos e diz por que <b>não</b> operar.
            </p>
          </article>

          {/* dashboard */}
          <article className={`${v.tile} ${v.tDash} ${v.reveal}`}>
            <span className={v.tileLabel}>Dashboard · 5 mercados ao vivo</span>
            <div className={v.dash}>
              {MARKETS.map((m) => (
                <div className={v.dashRow} key={m.s}>
                  <span className={v.dsym}>{m.s}</span>
                  <span className={v.dval}>{m.v}</span>
                  <span className={m.up ? v.up : v.dn}>{m.c}</span>
                </div>
              ))}
            </div>
          </article>

          {/* telegram */}
          <article className={`${v.tile} ${v.tTele} ${v.reveal}`}>
            <div className={v.tileIcon}>{I.bell}</div>
            <h3 className={v.tileTitle}>Alertas no Telegram</h3>
            <p className={v.tileBody}>Sinais validados no seu Telegram — com o selo de qualidade junto.</p>
          </article>

          {/* narrativa */}
          <article className={`${v.tile} ${v.tNarr} ${v.reveal}`}>
            <div className={v.tileIcon}>{I.spark}</div>
            <h3 className={v.tileTitle}>IA narrativa real</h3>
            <p className={v.tileBody}>Resumo em português que explica o porquê das 15 camadas — não só o quê.</p>
          </article>
        </div>
      </section>

      {/* FOSSO */}
      <section className={`${v.wrap} ${v.section}`} id="fosso">
        <div className={v.head}>
          <span className={v.eyebrow}>Transparência vs caixa-preta</span>
          <h2 className={v.h2}>O concorrente afirma.<br />Nós mostramos a <span className={v.grad}>conta</span>.</h2>
        </div>
        <div className={`${v.compare} ${v.reveal}`}>
          <div className={`${v.col} ${v.us}`}>
            <h3 className={v.colHead}>Overtrader <span className={v.badge}>PROVA</span></h3>
            {[
              "<b>Backtest público</b> em toda análise — walk-forward, sem lookahead.",
              "<b>IC + amostra + período</b> em cada número. Sem amostra, sem selo verde.",
              "<b>Algoritmos abertos</b> — SMC, harmônicos, WEGD legíveis em código.",
              "<b>Selo de qualidade</b> que avisa quando <b>não</b> operar.",
              "<b>CNPJ, Termos e reembolso de 7 dias</b> que dá pra checar.",
              "<b>Sem robôs / auto-execução</b> — você no controle.",
            ].map((t, i) => (
              <div className={v.cmp} key={i}>
                <span className={`${v.cmpI} ${v.ok}`} aria-hidden>✓</span>
                <span dangerouslySetInnerHTML={{ __html: t }} />
              </div>
            ))}
          </div>
          <div className={`${v.col} ${v.them}`}>
            <h3 className={v.colHead}>IA caixa-preta</h3>
            {[
              "“Acurácia 99%” sem contexto, sem amostra, sem backtest.",
              "Número cru, sem incerteza. Win rate 100% sobre 3 trades.",
              "Caixa-preta — você não vê como a conclusão saiu.",
              "Sempre confiante — nunca diz “fique de fora”.",
              "Sem CNPJ, termos ou reembolso claros.",
              "Promete robôs e lucros — o que vira reclamação.",
            ].map((t, i) => (
              <div className={v.cmp} key={i}>
                <span className={`${v.cmpI} ${v.no}`} aria-hidden>✕</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className={`${v.wrap} ${v.section}`} id="como">
        <div className={v.head}>
          <span className={v.eyebrow}>Como funciona</span>
          <h2 className={v.h2}>Do ativo ao plano em segundos.</h2>
        </div>
        <div className={`${v.steps} ${v.reveal}`}>
          {[
            ["Escolha o ativo", "143 ativos em 5 mercados, no seu timeframe."],
            ["O motor calcula", "15 camadas, Monte Carlo e backtest, de forma determinística."],
            ["Leia o veredito", "Sinal, força e níveis por ATR — com o selo e a conta à mostra."],
            ["Execute (ou não)", "Plano claro. E o aviso honesto quando a amostra não sustenta."],
          ].map(([t, b], i) => (
            <div className={v.step} key={i}>
              <span className={v.stepNum}>{String(i + 1).padStart(2, "0")}</span>
              <h4 className={v.stepTitle}>{t}</h4>
              <p className={v.stepBody}>{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PREÇOS */}
      <section className={`${v.wrap} ${v.section}`} id="precos">
        <div className={v.head}>
          <span className={v.eyebrow}>Preços</span>
          <h2 className={v.h2}>Comece de graça.<br />Pague quando o motor <span className={v.grad}>provar</span> o valor.</h2>
          <p className={v.lead}>
            Ferramentas opacas cobram <s className={v.strike}>R$337–749/mês</s>. O PRO
            custa R$97 — e você vê a conta por trás de cada número.
          </p>
        </div>
        <div className={v.plans}>
          <div className={`${v.plan} ${v.reveal}`}>
            <div className={v.pn}>Free</div>
            <div className={v.pp}>R$0<small>/sempre</small></div>
            <div className={v.pd}>Para conhecer o motor e o padrão de honestidade.</div>
            <ul className={v.list}>
              <li><span className={v.c}>✓</span> 3 análises completas vitalícias</li>
              <li><span className={v.c}>✓</span> Dashboard de preços ao vivo</li>
              <li><span className={v.c}>✓</span> Selo de qualidade em toda análise</li>
            </ul>
            <a className={v.btn} href={open ? "/login?mode=signup" : "/login"}>{open ? "Criar conta grátis" : "Entrar"}</a>
          </div>

          <div className={`${v.plan} ${v.pro} ${v.reveal}`}>
            <span className={v.tag}>Mais popular</span>
            <div className={v.pn}>PRO</div>
            <div className={v.pp}>R$97<small>/mês</small></div>
            <div className={v.ppYr}>ou R$970/ano · 2 meses grátis</div>
            <div className={v.pd}>Para quem opera com frequência e quer o motor completo.</div>
            <ul className={v.list}>
              <li><span className={v.c}>✓</span> Análises ilimitadas · 143 ativos</li>
              <li><span className={v.c}>✓</span> 15 camadas + Monte Carlo + backtest</li>
              <li><span className={v.c}>✓</span> Alertas no Telegram</li>
              <li><span className={v.c}>✓</span> Histórico completo</li>
            </ul>
            <a className={`${v.btn} ${v.primary}`} href="/planos">Assinar o PRO</a>
          </div>

          <div className={`${v.plan} ${v.reveal}`}>
            <div className={v.pn}>PRO+</div>
            <div className={v.pp}>R$197<small>/mês</small></div>
            <div className={v.ppYr}>ou R$1.970/ano · 2 meses grátis</div>
            <div className={v.pd}>Para o trader avançado e profissional.</div>
            <ul className={v.list}>
              <li><span className={v.c}>✓</span> Tudo do PRO</li>
              <li><span className={v.c}>✓</span> Backtest segmentado por regime</li>
              <li><span className={v.c}>✓</span> Alertas multi-ativo prioritários</li>
              <li><span className={v.c}>✓</span> Suporte dedicado</li>
            </ul>
            <a className={v.btn} href="/planos">Assinar o PRO+</a>
          </div>
        </div>
        <div className={`${v.guarantee} ${v.reveal}`}>
          <span className={v.gIcon}>{I.shield}</span>
          <span><b>Garantia de 7 dias.</b> Não curtiu? Reembolso integral, sem perguntas — art. 49 do CDC. CNPJ e Termos visíveis.</span>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${v.wrap} ${v.section}`} id="faq">
        <div className={v.head}>
          <span className={v.eyebrow}>Dúvidas</span>
          <h2 className={v.h2}>Tire suas dúvidas.</h2>
        </div>
        <div className={v.faq}>
          {[
            ["Isso é recomendação de investimento?", "Não. É conteúdo informativo e educativo. O Overtrader não constitui recomendação personalizada — decisões de investimento são sempre suas."],
            ["O que significa “prova antes de prometer”?", "Todo número exibido carrega o tamanho de amostra (n), o intervalo de confiança e o período. Se a amostra é insuficiente, o produto diz isso em vez de mostrar um número bonito."],
            ["Como o selo de qualidade decide a cor?", "O selo só fica verde quando o limite inferior do intervalo de confiança supera o limiar — nunca sobre amostra pequena ou ruidosa."],
            ["Preciso de cartão para testar?", "Não. São 3 análises completas vitalícias, sem cartão e sem expiração."],
          ].map(([q, a], i) => (
            <details className={v.qa} key={i}>
              <summary className={v.q}>{q}<span className={v.plus} aria-hidden /></summary>
              <div className={v.a}>{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className={`${v.wrap} ${v.section}`}>
        <div className={`${v.final} ${v.reveal}`}>
          <div className={v.finalAurora} aria-hidden />
          <span className={v.eyebrow} style={{ justifyContent: "center" }}>Pronto para começar</span>
          <h2 className={v.h2}>Pare de operar no escuro.</h2>
          <p className={v.lead}>Rode sua primeira análise auditável agora — de graça, sem cartão. Veja a conta antes de confiar nela.</p>
          <a className={`${v.btn} ${v.primary} ${v.lg}`} href="/analise">
            Analisar um ativo grátis <span className={v.arrow}>→</span>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={v.footer}>
        <div className={`${v.wrap} ${v.footRow}`}>
          <div className={v.brand}><Logo /><span className={v.name}>Overtrader</span><span className={v.ia}>IA</span></div>
          <div className={v.footCol}>
            <span className={v.footH}>Produto</span>
            <a href="#recursos">Recursos</a><a href="#precos">Preços</a><a href="#como">Como funciona</a>
          </div>
          <div className={v.footCol}>
            <span className={v.footH}>Empresa</span>
            <a href="#">Sobre</a><a href="/roadmap">Roadmap público</a><a href="#faq">FAQ</a>
          </div>
          <div className={v.footCol}>
            <span className={v.footH}>Legal</span>
            <a href="/termos">Termos de uso</a><a href="/privacidade">Política de privacidade</a>
          </div>
        </div>
        <div className={`${v.wrap} ${v.legal}`}>
          <span>© 2026 OVERTRADER · CONTEÚDO INFORMATIVO · NÃO CONSTITUI RECOMENDAÇÃO PERSONALIZADA · ENGINE {ENGINE_VERSION}</span>
          <span>FEITO COM RIGOR ESTATÍSTICO</span>
        </div>
      </footer>
    </div>
  );
}
