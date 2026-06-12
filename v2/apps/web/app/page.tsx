/**
 * Landing oficial (v5) — "terminal premium": o conceito "veja a IA provar"
 * com a camada de movimento: ticker, gráfico real + scanner de IA, rede
 * neural, contadores e reveals orquestrados. Zero dependência nova.
 */
import type { Metadata } from "next";
import { ENGINE_VERSION } from "@tradeai/engine";
import { Logo } from "@/components/ui";
import { signupsOpen } from "@/lib/signups";
import { HeroStage } from "./hero-stage";
import { Ticker } from "./ticker";
import { RevealObserver } from "./reveal";
import { CountUp } from "./count-up";
import { Neural } from "./neural";
import { GaugeAnim } from "./gauge";
import s from "./page.module.css";

export const metadata: Metadata = {
  title: "Overtrader — A IA que prova antes de prometer",
  description:
    "Análise de trading com IA, auditável. A IA valida cada sinal em 15 camadas — amostra, intervalo de confiança e período em cada número. 143 ativos em 5 mercados. Backtest público, algoritmos abertos.",
  openGraph: {
    title: "Overtrader — A IA que prova antes de prometer",
    description: "Análise de trading com IA auditável: 15 camadas por sinal, 143 ativos, 5 mercados. Veja como a IA chega na conclusão.",
    type: "website",
    locale: "pt_BR",
    siteName: "Overtrader",
  },
  twitter: {
    card: "summary",
    title: "Overtrader — A IA que prova antes de prometer",
    description: "Análise de trading com IA auditável: 15 camadas por sinal, 143 ativos, 5 mercados.",
  },
};

const FAQS: [string, string][] = [
  ["Isso é um robô que opera por mim?", "Não. O Overtrader não executa ordens nem acessa sua corretora. É inteligência de análise: a IA estuda o ativo em 15 camadas e mostra o raciocínio — a decisão é sempre sua."],
  ["Isso é recomendação de investimento?", "Não. É conteúdo informativo e educativo. O Overtrader não constitui recomendação personalizada — decisões de investimento são sempre suas."],
  ["O que significa “prova antes de prometer”?", "Todo número exibido carrega o tamanho de amostra (n), o intervalo de confiança e o período. Se a amostra é insuficiente, o produto diz isso em vez de mostrar um número bonito."],
  ["Como o selo de qualidade decide a cor?", "O selo só fica verde quando o limite inferior do intervalo de confiança supera o limiar — nunca sobre amostra pequena ou ruidosa."],
  ["Preciso de cartão para testar?", "Não. São 3 análises completas vitalícias, sem cartão e sem expiração."],
];

const STEPS: [string, string][] = [
  ["Escolha o ativo", "143 ativos em 5 mercados: cripto, forex, ações, índices e commodities — num só motor."],
  ["A IA roda as 15 camadas", "Tendência, momentum, SMC, multi-timeframe, harmônicos, Monte Carlo… cada camada vota com peso versionado."],
  ["Score + selo de qualidade", "A confluência vira um score de 0–100 com amostra e intervalo de confiança. O selo avisa quando NÃO operar."],
  ["Você decide", "Sem robô, sem auto-execução. Você vê o raciocínio inteiro e mantém o controle da operação."],
];

const FEATURES: { t: string; d: string; ic: React.ReactNode }[] = [
  {
    t: "Confluência multi-indicador",
    d: "20 indicadores votam por categoria e regime. O sinal só nasce quando as camadas concordam — sem achismo.",
    ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" /><path d="m4 12.5 8 4.5 8-4.5M4 17l8 4.5L20 17" /></svg>,
  },
  {
    t: "143 ativos · 5 mercados",
    d: "Cripto, forex, ações, índices e commodities com a metodologia certa para cada classe de ativo.",
    ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z" /></svg>,
  },
  {
    t: "Transparência da IA",
    d: "Indicadores, pesos e score abertos em cada análise. Você vê como a conclusão saiu — não uma caixa-preta.",
    ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>,
  },
  {
    t: "Selo de qualidade honesto",
    d: "Backtest walk-forward com intervalo de confiança. O selo verde só acende quando a estatística sustenta.",
    ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  },
];

export default function HomePage() {
  const open = signupsOpen();
  return (
    <div className={s.page}>
      <RevealObserver />
      <div className={s.bg} aria-hidden>
        <div className={s.beam} />
        <div className={s.gridlines} />
      </div>

      {/* NAV */}
      <nav className={s.nav}>
        <div className={`${s.wrap} ${s.navRow}`}>
          <a className={s.brand} href="/" aria-label="Overtrader">
            <Logo />
            <span className={s.name}>Overtrader</span>
            <span className={s.ia}>IA</span>
          </a>
          <div className={s.navLinks}>
            <a href="#como">Como funciona</a>
            <a href="#fosso">O diferencial</a>
            <a href="#precos">Preços</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className={s.navCtas}>
            <a className={`${s.btn} ${s.ghost}`} href="/login">Entrar</a>
            <a className={`${s.btn} ${s.primary}`} href={open ? "/login?mode=signup" : "/analise"}>Começar grátis</a>
          </div>
        </div>
      </nav>

      <Ticker />

      {/* HERO */}
      <header className={`${s.wrap} ${s.hero}`}>
        <span className={`${s.eyebrow} ${s.rise} ${s.d1}`}>
          <span className={s.dot} /> Análise de trading com IA · 100% auditável
        </span>
        <h1 className={`${s.h1} ${s.rise} ${s.d2}`}>
          Veja a IA <span className={s.grad}>provar</span> o sinal.<br />
          Camada por camada.
        </h1>
        <p className={`${s.sub} ${s.rise} ${s.d3}`}>
          Enquanto o concorrente grita <i>“acurácia 99%”</i>, a gente mostra a conta:
          <b> amostra, intervalo de confiança e período</b> em cada número. Backtest
          público, algoritmos abertos — e o veredito honesto de quando <b>não</b> operar.
        </p>
        <div className={`${s.ctaRow} ${s.rise} ${s.d4}`}>
          <a className={`${s.btn} ${s.primary} ${s.lg}`} href={open ? "/login?mode=signup" : "/analise"}>
            Começar grátis <span className={s.arrow}>→</span>
          </a>
          <a className={`${s.btn} ${s.lg} ${s.glassBtn}`} href="#como">Ver como funciona</a>
        </div>
        <div className={`${s.chips} ${s.rise} ${s.d5}`}>
          <span className={s.chip}>✓ Sem cartão</span>
          <span className={s.chip}>✓ 3 análises vitalícias</span>
          <span className={s.chip}>✓ Reembolso de 7 dias (CDC)</span>
        </div>

        {/* PALCO — gráfico vivo + IA escaneando */}
        <div className={`${s.stage} ${s.rise} ${s.d4}`}>
          <div className={s.showGlow} aria-hidden />
          <HeroStage engineVersion={ENGINE_VERSION} />
        </div>
      </header>

      {/* PROVA — contadores reais */}
      <section className={s.proof}>
        <div className={`${s.wrap} ${s.proofGrid}`}>
          {[
            [<CountUp to={143} key="n" />, "ativos", "5 mercados num só motor"],
            [<CountUp to={5} key="n" />, "mercados", "cripto, forex, ações, índices, commodities"],
            [<CountUp to={15} key="n" />, "camadas", "por sinal, pesos versionados"],
            [<CountUp to={100} suffix="%" key="n" />, "auditável", "algoritmos abertos em código"],
          ].map(([n, u, k], i) => (
            <div className={s.proofItem} data-rv style={{ "--rd": i } as React.CSSProperties} key={String(u)}>
              <div className={s.proofNum}>{n}<span> {String(u)}</span></div>
              <div className={s.proofLabel}>{String(k)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className={`${s.wrap} ${s.section}`} id="como">
        <div className={s.head} data-rv>
          <span className={s.eyebrow}><span className={s.dot} /> Como funciona</span>
          <h2 className={s.h2}>Do gráfico ao veredito<br />em <span className={s.grad}>4 passos</span>.</h2>
        </div>
        <div className={s.steps}>
          {STEPS.map(([t, d], i) => (
            <div className={s.step} data-rv style={{ "--rd": i } as React.CSSProperties} key={t}>
              <span className={s.stepNum}>PASSO {String(i + 1).padStart(2, "0")}</span>
              <h3 className={s.stepT}>{t}</h3>
              <p className={s.stepD}>{d}</p>
            </div>
          ))}
        </div>
        <Neural />
      </section>

      {/* RECURSOS */}
      <section className={`${s.wrap} ${s.section}`} id="recursos">
        <div className={s.head} data-rv>
          <span className={s.eyebrow}><span className={s.dot} /> Recursos</span>
          <h2 className={s.h2}>Inteligência de análise.<br />Não <span className={s.grad}>caixa-preta</span>.</h2>
        </div>
        <div className={s.cards}>
          {FEATURES.map((f, i) => (
            <div className={s.card} data-rv style={{ "--rd": i } as React.CSSProperties} key={f.t}>
              <div className={s.cardIc}>{f.ic}</div>
              <h3 className={s.cardT}>{f.t}</h3>
              <p className={s.cardD}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOSSO / DIFERENCIAL */}
      <section className={`${s.wrap} ${s.section}`} id="fosso">
        <div className={s.head} data-rv>
          <span className={s.eyebrow}><span className={s.dot} /> Transparência vs caixa-preta</span>
          <h2 className={s.h2}>O concorrente afirma.<br />Nós mostramos a <span className={s.grad}>conta</span>.</h2>
        </div>
        <div className={s.compare}>
          <div className={`${s.colc} ${s.us}`} data-rv>
            <h3 className={s.cHead}>Overtrader <span className={s.badge}>PROVA</span></h3>
            {[
              "<b>Backtest público</b> em toda análise — walk-forward, sem lookahead.",
              "<b>IC + amostra + período</b> em cada número. Sem amostra, sem selo verde.",
              "<b>Algoritmos abertos</b> — SMC, harmônicos, WEGD legíveis em código.",
              "<b>Selo de qualidade</b> que avisa quando <b>não</b> operar.",
              "<b>CNPJ, Termos e reembolso de 7 dias</b> que dá pra checar.",
              "<b>Sem robôs / auto-execução</b> — você no controle.",
            ].map((t, i) => (
              <div className={s.cmp} key={i}>
                <span className={`${s.cmpI} ${s.ok}`} aria-hidden>✓</span>
                <span dangerouslySetInnerHTML={{ __html: t }} />
              </div>
            ))}
          </div>
          <div className={`${s.colc} ${s.them}`} data-rv style={{ "--rd": 1 } as React.CSSProperties}>
            <h3 className={s.cHead}>IA caixa-preta</h3>
            {[
              "“Acurácia 99%” sem contexto, sem amostra, sem backtest.",
              "Número cru, sem incerteza. Win rate 100% sobre 3 trades.",
              "Caixa-preta — você não vê como a conclusão saiu.",
              "Sempre confiante — nunca diz “fique de fora”.",
              "Sem CNPJ, termos ou reembolso claros.",
              "Promete robôs e lucros — o que vira reclamação.",
            ].map((t, i) => (
              <div className={s.cmp} key={i}>
                <span className={`${s.cmpI} ${s.no}`} aria-hidden>✕</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={s.gaugeRow} data-rv>
          <GaugeAnim value={72} />
          <p className={s.gexp}>
            <b>É assim que a IA pontua um sinal.</b> Cada camada vota com peso definido e
            versionado; a concordância vira um <b>score de confluência de 0 a 100</b> —
            sempre acompanhado de amostra e intervalo de confiança. Score baixo?
            O produto diz <b>“fique de fora”</b>.
          </p>
        </div>
      </section>

      {/* PREÇOS */}
      <section className={`${s.wrap} ${s.section}`} id="precos">
        <div className={s.head} data-rv>
          <span className={s.eyebrow}><span className={s.dot} /> Preços</span>
          <h2 className={s.h2}>Comece de graça.<br />Pague quando o motor <span className={s.grad}>provar</span> o valor.</h2>
          <p className={s.lead}>
            Ferramentas opacas cobram <s className={s.strike}>R$337–749/mês</s>. O PRO
            custa R$97 — e você vê a conta por trás de cada número.
          </p>
        </div>
        <div className={s.plans}>
          <div className={s.plan} data-rv>
            <div className={s.pn}>Free</div>
            <div className={s.pp}>R$0<small>/sempre</small></div>
            <div className={s.pd}>Para conhecer o motor e o padrão de honestidade.</div>
            <ul className={s.list}>
              <li><span className={s.c}>✓</span> 3 análises completas vitalícias</li>
              <li><span className={s.c}>✓</span> Dashboard de preços ao vivo</li>
              <li><span className={s.c}>✓</span> Selo de qualidade em toda análise</li>
            </ul>
            <a className={s.btn} href={open ? "/login?mode=signup" : "/login"}>{open ? "Criar conta grátis" : "Entrar"}</a>
          </div>

          <div className={`${s.plan} ${s.pro} ${s.proRing}`} data-rv style={{ "--rd": 1 } as React.CSSProperties}>
            <span className={s.tag}>Mais popular</span>
            <div className={s.pn}>PRO</div>
            <div className={s.pp}>R$97<small>/mês</small></div>
            <div className={s.ppYr}>ou R$970/ano · 2 meses grátis</div>
            <div className={s.pd}>Para quem opera com frequência e quer o motor completo.</div>
            <ul className={s.list}>
              <li><span className={s.c}>✓</span> Análises ilimitadas · 143 ativos</li>
              <li><span className={s.c}>✓</span> 15 camadas + Monte Carlo + backtest</li>
              <li><span className={s.c}>✓</span> Alertas no Telegram</li>
              <li><span className={s.c}>✓</span> Histórico completo</li>
            </ul>
            <a className={`${s.btn} ${s.primary}`} href="/planos">Assinar o PRO</a>
          </div>

          <div className={s.plan} data-rv style={{ "--rd": 2 } as React.CSSProperties}>
            <div className={s.pn}>PRO+</div>
            <div className={s.pp}>R$197<small>/mês</small></div>
            <div className={s.ppYr}>ou R$1.970/ano · 2 meses grátis</div>
            <div className={s.pd}>Para o trader avançado e profissional.</div>
            <ul className={s.list}>
              <li><span className={s.c}>✓</span> Tudo do PRO</li>
              <li><span className={s.c}>✓</span> Backtest segmentado por regime</li>
              <li><span className={s.c}>✓</span> Alertas multi-ativo prioritários</li>
              <li><span className={s.c}>✓</span> Suporte dedicado</li>
            </ul>
            <a className={s.btn} href="/planos">Assinar o PRO+</a>
          </div>
        </div>
        <div className={s.guarantee} data-rv>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={s.gIcon} aria-hidden>
            <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
          </svg>
          <span><b>Garantia de 7 dias.</b> Não curtiu? Reembolso integral, sem perguntas — art. 49 do CDC. CNPJ e Termos visíveis.</span>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${s.wrap} ${s.section}`} id="faq">
        <div className={s.head} data-rv>
          <span className={s.eyebrow}><span className={s.dot} /> Dúvidas</span>
          <h2 className={s.h2}>Tire suas dúvidas.</h2>
        </div>
        <div className={s.faq} data-rv>
          {FAQS.map(([q, a], i) => (
            <details className={s.qa} key={i}>
              <summary className={s.q}>{q}<span className={s.plus} aria-hidden /></summary>
              <div className={s.a}>{a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className={`${s.wrap} ${s.section}`}>
        <div className={s.final} data-rv>
          <div className={s.finalGlow} aria-hidden />
          <h2 className={s.h2}>Pare de operar no escuro.</h2>
          <p className={s.lead}>Rode sua primeira análise auditável agora — de graça, sem cartão. Veja a conta antes de confiar nela.</p>
          <a className={`${s.btn} ${s.primary} ${s.lg}`} href={open ? "/login?mode=signup" : "/analise"}>
            Começar grátis <span className={s.arrow}>→</span>
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footRow}`}>
          <div className={s.brand}><Logo /><span className={s.name}>Overtrader</span><span className={s.ia}>IA</span></div>
          <div className={s.footCol}>
            <span className={s.footH}>Produto</span>
            <a href="#como">Como funciona</a><a href="#fosso">O diferencial</a><a href="#precos">Preços</a><a href="#faq">FAQ</a>
          </div>
          <div className={s.footCol}>
            <span className={s.footH}>Empresa</span>
            <a href="/roadmap">Roadmap público</a>
          </div>
          <div className={s.footCol}>
            <span className={s.footH}>Legal</span>
            <a href="/termos">Termos de uso</a><a href="/privacidade">Política de privacidade</a>
          </div>
        </div>
        <div className={`${s.wrap} ${s.legal}`}>
          <span>© 2026 OVERTRADER · CONTEÚDO INFORMATIVO · NÃO CONSTITUI RECOMENDAÇÃO PERSONALIZADA · TODA OPERAÇÃO ENVOLVE RISCO DE PERDA · ENGINE {ENGINE_VERSION}</span>
          <span>FEITO COM RIGOR ESTATÍSTICO</span>
        </div>
      </footer>

      {/* SEO — FAQ estruturada */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(([q, a]) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        }}
      />
    </div>
  );
}
