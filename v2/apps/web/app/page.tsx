import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ENGINE_VERSION } from "@tradeai/engine";
import {
  Logo,
  ConfidenceBadge,
  RadialGauge,
  EquityCurve,
  SignalBadge,
} from "@/components/ui";
import { signupsOpen } from "@/lib/signups";
import v from "./page.module.css";

export const metadata: Metadata = {
  title: "Overtrader — A IA que prova antes de prometer",
  description:
    "Análise de trading com IA, auditável. A IA valida cada sinal camada por camada — amostra, intervalo de confiança e período em cada número. Backtest público, algoritmos abertos, e o veredito honesto de quando não operar.",
};

// As camadas que “acendem” em sequência no hero (sensação de motor rodando).
const LAYERS = [
  "Tendência",
  "Momentum",
  "Volatilidade",
  "Suporte / Resistência",
  "Smart Money (SMC)",
  "Multi-timeframe",
  "Harmônicos",
  "Monte Carlo",
  "Fluxo de notícias",
  "Volume / liquidez",
];

const EQUITY = [0, 0.3, 0.1, 0.9, 0.7, 1.6, 1.3, 2.3, 2.0, 3.1, 2.8, 3.8, 4.6];

export default function HomePage() {
  const open = signupsOpen();
  return (
    <div className={v.page}>
      <div className={v.bg} aria-hidden>
        <div className={v.beam} />
        <div className={v.gridlines} />
      </div>

      {/* NAV */}
      <nav className={v.nav}>
        <div className={`${v.wrap} ${v.navRow}`}>
          <a className={v.brand} href="/" aria-label="Overtrader">
            <Logo />
            <span className={v.name}>Overtrader</span>
            <span className={v.ia}>IA</span>
          </a>
          <div className={v.navLinks}>
            <a href="#fosso">O diferencial</a>
            <a href="#precos">Preços</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className={v.navCtas}>
            <a className={`${v.btn} ${v.ghost}`} href="/login">Entrar</a>
            <a className={`${v.btn} ${v.primary}`} href="/analise">Analisar grátis</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className={`${v.wrap} ${v.hero}`}>
        <span className={`${v.eyebrow} ${v.rise} ${v.d1}`}>
          <span className={v.dot} /> Análise de trading com IA · 100% auditável
        </span>
        <h1 className={`${v.h1} ${v.rise} ${v.d2}`}>
          Veja a IA <span className={v.grad}>provar</span> o sinal.<br />
          Camada por camada.
        </h1>
        <p className={`${v.sub} ${v.rise} ${v.d3}`}>
          Enquanto o concorrente grita <i>“acurácia 99%”</i>, a gente mostra a conta:
          <b> amostra, intervalo de confiança e período</b> em cada número. Backtest
          público, algoritmos abertos — e o veredito honesto de quando <b>não</b> operar.
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
          <span className={v.chip}>✓ Reembolso de 7 dias (CDC)</span>
        </div>

        {/* SHOWCASE — o produto provando ao vivo */}
        <div className={`${v.stage} ${v.rise} ${v.d4}`}>
          <div className={v.showGlow} aria-hidden />
          <section className={v.show} aria-label="Demonstração de análise">
            <div className={v.showBar}>
              <span className={v.live}><span className={v.liveDot} /> ANÁLISE AO VIVO</span>
              <b>BTCUSDT</b><span className={v.tf}>4H</span>
              <span className={v.engine}>ENGINE {ENGINE_VERSION}</span>
            </div>

            <div className={v.showGrid}>
              {/* coluna 1 — camadas acendendo */}
              <div className={v.col1}>
                <div className={v.colHead}>15 camadas analisadas</div>
                <ul className={v.layers}>
                  {LAYERS.map((l, i) => (
                    <li
                      className={v.layer}
                      key={l}
                      style={{ "--i": i } as CSSProperties}
                    >
                      <span className={v.check} aria-hidden>✓</span>
                      <span className={v.layerName}>{l}</span>
                      <span className={v.layerOk}>ok</span>
                    </li>
                  ))}
                  <li className={v.more}>+5 camadas · pesos versionados</li>
                </ul>
              </div>

              {/* coluna 2 — veredito + força */}
              <div className={v.col2}>
                <RadialGauge value={72} size={172} stroke={11} caption="força do sinal" showOutOf />
                <div className={v.verdict}>
                  <SignalBadge direction="buy">Compra</SignalBadge>
                  <span className={v.confl}>confluência 7/10 · votos 12 · 5 · 3</span>
                </div>
              </div>

              {/* coluna 3 — prova estatística */}
              <div className={v.col3}>
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
                <div className={v.eqWrap}>
                  <div className={v.eqHead}><span>Curva de R acumulado</span><span className={v.eqVal}>+4,6 R</span></div>
                  <EquityCurve data={EQUITY} height={62} gradientId="v4eq" />
                </div>
                <div className={v.seal}><span className={v.sealLed} /> VEREDITO: VALIDADO</div>
              </div>
            </div>
          </section>
        </div>
      </header>

      {/* PROOF STRIP */}
      <section className={v.proof}>
        <div className={`${v.wrap} ${v.proofGrid}`}>
          {[
            ["143", "ativos", "5 mercados num só motor"],
            ["15", "camadas", "por sinal, pesos versionados"],
            ["100%", "auditável", "algoritmos abertos em código"],
            ["7 dias", "de reembolso", "art. 49 do CDC, sem pegadinha"],
          ].map(([n, u, k]) => (
            <div className={`${v.proofItem} ${v.reveal}`} key={u}>
              <div className={v.proofNum}>{n}<span> {u}</span></div>
              <div className={v.proofLabel}>{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FOSSO */}
      <section className={`${v.wrap} ${v.section}`} id="fosso">
        <div className={v.head}>
          <span className={v.eyebrow}><span className={v.dot} /> Transparência vs caixa-preta</span>
          <h2 className={v.h2}>O concorrente afirma.<br />Nós mostramos a <span className={v.grad}>conta</span>.</h2>
        </div>
        <div className={`${v.compare} ${v.reveal}`}>
          <div className={`${v.colc} ${v.us}`}>
            <h3 className={v.cHead}>Overtrader <span className={v.badge}>PROVA</span></h3>
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
          <div className={`${v.colc} ${v.them}`}>
            <h3 className={v.cHead}>IA caixa-preta</h3>
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

      {/* PREÇOS */}
      <section className={`${v.wrap} ${v.section}`} id="precos">
        <div className={v.head}>
          <span className={v.eyebrow}><span className={v.dot} /> Preços</span>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={v.gIcon} aria-hidden>
            <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
          </svg>
          <span><b>Garantia de 7 dias.</b> Não curtiu? Reembolso integral, sem perguntas — art. 49 do CDC. CNPJ e Termos visíveis.</span>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${v.wrap} ${v.section}`} id="faq">
        <div className={v.head}>
          <span className={v.eyebrow}><span className={v.dot} /> Dúvidas</span>
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
          <div className={v.finalGlow} aria-hidden />
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
            <a href="#fosso">O diferencial</a><a href="#precos">Preços</a><a href="#faq">FAQ</a>
          </div>
          <div className={v.footCol}>
            <span className={v.footH}>Empresa</span>
            <a href="#">Sobre</a><a href="/roadmap">Roadmap público</a>
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
