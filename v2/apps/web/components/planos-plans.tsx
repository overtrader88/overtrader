"use client";

import { useState } from "react";

/**
 * Grade de planos interativa (Fase F3 / E6). Toggle Mensal×Anual troca preços e
 * o link de checkout da Hubla. URLs vêm do servidor (env HUBLA_CHECKOUT_URL_*);
 * quando ausentes, o botão fica desabilitado ("em breve") — no-op gracioso.
 */
export interface CheckoutUrls {
  proMonthly?: string;
  proAnnual?: string;
  proPlusMonthly?: string;
  proPlusAnnual?: string;
}

function Cta({ href, label, className }: { href?: string; label: string; className: string }) {
  if (!href) {
    return (
      <button type="button" className={className} disabled title="Checkout em configuração">
        Em breve
      </button>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener" className={className}>
      {label}
    </a>
  );
}

export function PlanosPlans({ urls, currentPlan }: { urls: CheckoutUrls; currentPlan: string }) {
  const [annual, setAnnual] = useState(true);
  const isPro = currentPlan === "pro";
  const isProPlus = currentPlan === "pro_plus";
  const isFree = !isPro && !isProPlus;

  return (
    <>
      <div className="toggle">
        <button type="button" className={annual ? "" : "on"} onClick={() => setAnnual(false)}>Mensal</button>
        <button type="button" className={annual ? "on" : ""} onClick={() => setAnnual(true)}>
          Anual <span className="save">−20%</span>
        </button>
      </div>

      <div className="plans">
        {/* FREE */}
        <div className={`plan${isFree ? " current" : ""}`}>
          {isFree ? <span className="tagc">Plano atual</span> : null}
          <div className="pn">Free</div>
          <div className="pp font-mono">R$0<small>/sempre</small></div>
          <div className="pd">Para conhecer o motor e o padrão de honestidade.</div>
          <ul>
            <li><span className="c">✓</span> 3 análises completas vitalícias</li>
            <li><span className="c">✓</span> Dashboard de preços ao vivo</li>
            <li><span className="c">✓</span> Selo de qualidade em toda análise</li>
            <li className="off"><span className="c">✕</span> Alertas no Telegram</li>
            <li className="off"><span className="c">✕</span> Histórico completo</li>
          </ul>
          <button type="button" className="pbtn ghost" disabled>{isFree ? "Seu plano" : "Free"}</button>
        </div>

        {/* PRO */}
        <div className={`plan pro${isPro ? " current" : ""}`}>
          <span className="tagp">{isPro ? "Plano atual" : "Recomendado"}</span>
          <div className="pn">Pro</div>
          {annual ? (
            <>
              <div className="pp font-mono">R$970<small>/ano</small></div>
              <div className="pp-yr">equivale a R$80,83/mês · 2 meses grátis</div>
            </>
          ) : (
            <>
              <div className="pp font-mono">R$97<small>/mês</small></div>
              <div className="pp-yr">ou R$970/ano · 2 meses grátis</div>
            </>
          )}
          <div className="pd">Para quem opera com frequência e quer o motor completo.</div>
          <ul>
            <li><span className="c">✓</span> Análises <b style={{ color: "var(--ink)" }}>ilimitadas</b> · 143 ativos</li>
            <li><span className="c">✓</span> 15 camadas + Monte Carlo + backtest</li>
            <li><span className="c">✓</span> Alertas no Telegram</li>
            <li><span className="c">✓</span> Histórico completo + exportação</li>
            <li><span className="c">✓</span> Modo Simples × Avançado</li>
          </ul>
          {isPro ? (
            <button type="button" className="pbtn primary" disabled>Seu plano</button>
          ) : (
            <Cta className="pbtn primary" label="Fazer upgrade →" href={annual ? urls.proAnnual : urls.proMonthly} />
          )}
        </div>

        {/* PRO+ */}
        <div className={`plan${isProPlus ? " current" : ""}`}>
          {isProPlus ? <span className="tagp">Plano atual</span> : null}
          <div className="pn">Pro+</div>
          {annual ? (
            <>
              <div className="pp font-mono">R$1.970<small>/ano</small></div>
              <div className="pp-yr">equivale a R$164,17/mês · 2 meses grátis</div>
            </>
          ) : (
            <>
              <div className="pp font-mono">R$197<small>/mês</small></div>
              <div className="pp-yr">ou R$1.970/ano · 2 meses grátis</div>
            </>
          )}
          <div className="pd">Para o trader avançado e profissional.</div>
          <ul>
            <li><span className="c">✓</span> Tudo do PRO</li>
            <li><span className="c">✓</span> Backtest segmentado por regime</li>
            <li><span className="c">✓</span> Alertas multi-ativo prioritários</li>
            <li><span className="c">✓</span> API de análise (em breve)</li>
            <li><span className="c">✓</span> Suporte dedicado</li>
          </ul>
          {isProPlus ? (
            <button type="button" className="pbtn" disabled>Seu plano</button>
          ) : (
            <Cta className="pbtn" label="Assinar o PRO+" href={annual ? urls.proPlusAnnual : urls.proPlusMonthly} />
          )}
        </div>
      </div>
    </>
  );
}
