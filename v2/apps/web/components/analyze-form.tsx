"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { CATALOG, ASSET_CLASS_PT, catalogByClass } from "@/lib/market/catalog";

const TFS: { v: Timeframe; label: string; hint: string }[] = [
  { v: "15m", label: "15 minutos", hint: "Scalp" },
  { v: "1h", label: "1 hora", hint: "Intraday" },
  { v: "4h", label: "4 horas", hint: "Swing curto" },
  { v: "1d", label: "Diário", hint: "Swing" },
  { v: "1w", label: "Semanal", hint: "Posição" },
];
const TYPES: { v: AssetType; label: string; hint: string }[] = [
  { v: "crypto", label: "Criptomoedas", hint: "BTC, ETH, SOL…" },
  { v: "forex", label: "Forex", hint: "EUR/USD, USD/BRL…" },
  { v: "commodities", label: "Commodities", hint: "Ouro, Petróleo…" },
  { v: "indices", label: "Índices", hint: "S&P 500, Ibovespa…" },
  { v: "stocks", label: "Ações", hint: "AAPL, NVDA…" },
];

// gradiente do avatar por classe — variação dentro da família cyan/violeta
// (verde/rosa são reservados pra direção; âmbar pro selo)
const TYPE_GRAD: Record<AssetType, string> = {
  crypto: "linear-gradient(135deg, #54a8ff, #9a8bff)",
  forex: "linear-gradient(135deg, #7c9cff, #54a8ff)",
  commodities: "linear-gradient(135deg, #b08bff, #6f8dff)",
  indices: "linear-gradient(135deg, #54a8ff, #6ad3ff)",
  stocks: "linear-gradient(135deg, #8a8bff, #54a8ff)",
};

// ---------- ícones (inline, herdam currentColor) ----------
function ChevronIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8Z" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
const TYPE_ICON: Record<AssetType, React.ReactNode> = {
  crypto: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" />
      <path d="M12 7v10M8 9.5 16 14.5M16 9.5 8 14.5" strokeWidth="1.1" />
    </svg>
  ),
  forex: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  commodities: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3 4 5 6.5 5 9.5A5 5 0 0 1 7 12.5C7 9.5 9 7 12 3Z" />
    </svg>
  ),
  indices: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
  stocks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16l5-6 4 4 5-8M21 6h-4M21 6v4" />
    </svg>
  ),
};

/**
 * Selo/logo do ativo: para cripto, busca o ícone oficial no CDN
 * (cryptocurrency-icons via jsDelivr); se não existir ou não for cripto,
 * cai pro tile com gradiente + iniciais do ticker. `key` remonta ao trocar.
 */
function AssetAvatar({ assetType, base, initials }: { assetType: AssetType; base: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  const useLogo = assetType === "crypto" && base.length > 0 && !failed;
  if (useLogo) {
    return (
      <span className="cfg-avatar logo">
        <img
          src={`https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${base}.svg`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className="cfg-avatar" style={{ background: TYPE_GRAD[assetType] }}>
      {initials}
    </span>
  );
}

const TRUST: { t: string; s: string; icon: React.ReactNode }[] = [
  {
    t: "Auditável",
    s: "n · IC 95% · período",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
    ),
  },
  {
    t: "Segundos",
    s: "15 camadas por sinal",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" /></svg>
    ),
  },
  {
    t: "5 mercados",
    s: "143 ativos num só motor",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9S14.5 18.5 12 21M12 3c-2.5 2.5-3.5 6-3.5 9S9.5 18.5 12 21" /></svg>
    ),
  },
  {
    t: "Aberto",
    s: "algoritmos em código",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m8 9-3 3 3 3M16 9l3 3-3 3M13 5l-2 14" /></svg>
    ),
  },
];

/**
 * Configurador da tela de Análise: ativo + classe + timeframe em cartões
 * rotulados com avatar/contexto. Empurra os parâmetros pra URL
 * (?symbol&type&tf) — a página (RSC) relê e re-analisa com dados reais.
 */
export function AnalyzeForm({
  symbol,
  assetType,
  timeframe,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
}) {
  const router = useRouter();
  const [sym, setSym] = useState(symbol);
  const [at, setAt] = useState<AssetType>(assetType);
  const [tf, setTf] = useState<Timeframe>(timeframe);
  const [pending, setPending] = useState(false);

  const cleanSym = sym.trim().toUpperCase();
  const matched = CATALOG.find((a) => a.symbol === cleanSym);
  const base = (matched?.symbol ?? cleanSym).replace(/USDT$|USD$/i, "");
  const ticker = base.slice(0, 4) || "?";
  const typeMeta = TYPES.find((t) => t.v === at);
  const tfMeta = TFS.find((t) => t.v === tf);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cleanSym) return;
    setPending(true);
    router.push(`/analise?symbol=${encodeURIComponent(cleanSym)}&type=${at}&tf=${tf}`);
  }

  return (
    <form className="configurator" onSubmit={submit}>
      <div className="cfg-glow" aria-hidden />
      <div className="cfg-head">
        <div className="cfg-headline">
          <span className="cfg-eyebrow">Nova análise</span>
          <h2 className="cfg-title">Configurar Análise</h2>
          <p className="cfg-sub">Escolha o ativo, a classe e o timeframe — o motor faz as 15 camadas com dados reais.</p>
        </div>
        <Link href="/planos" className="cfg-pro">
          <span className="pro-ico"><CrownIcon /></span>
          <span className="pro-txt">
            <b>Desbloqueie o PRO</b>
            <small>Análises ilimitadas e camadas exclusivas</small>
          </span>
          <span className="pro-arrow"><ArrowIcon /></span>
        </Link>
      </div>

      <div className="cfg-grid">
        <label className="cfg-field">
          <span className="cfg-label">Ativo</span>
          <div className="cfg-control">
            <AssetAvatar key={`${at}-${base.toLowerCase()}`} assetType={at} base={base.toLowerCase()} initials={ticker} />
            <span className="cfg-main">
              <input
                className="cfg-input"
                list="af-symbols"
                value={sym}
                onChange={(e) => setSym(e.target.value)}
                placeholder="Ex.: BTCUSDT"
                aria-label="Símbolo do ativo"
                spellCheck={false}
                autoComplete="off"
              />
              <span className="cfg-meta">{matched?.name ?? "Digite ou escolha um ativo"}</span>
            </span>
          </div>
          <datalist id="af-symbols">
            {CATALOG.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.name}
              </option>
            ))}
          </datalist>
        </label>

        <label className="cfg-field">
          <span className="cfg-label">Tipo de Ativo</span>
          <div className="cfg-control">
            <span className="cfg-avatar soft">{TYPE_ICON[at]}</span>
            <span className="cfg-main">
              <select className="cfg-select" value={at} onChange={(e) => setAt(e.target.value as AssetType)} aria-label="Classe de ativo">
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="cfg-meta">{typeMeta?.hint}</span>
            </span>
            <span className="cfg-chev"><ChevronIcon /></span>
          </div>
        </label>

        <label className="cfg-field">
          <span className="cfg-label">Timeframe</span>
          <div className="cfg-control">
            <span className="cfg-avatar soft"><ClockIcon /></span>
            <span className="cfg-main">
              <select className="cfg-select" value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} aria-label="Timeframe">
                {TFS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
              <span className="cfg-meta">{tfMeta ? `${tf.toUpperCase()} · ${tfMeta.hint}` : null}</span>
            </span>
            <span className="cfg-chev"><ChevronIcon /></span>
          </div>
        </label>
      </div>

      <button type="submit" className="cfg-go" disabled={pending}>
        <span className="cfg-go-ico"><CrownIcon /></span>
        {pending ? "Analisando…" : "Analisar agora"}
        {pending ? null : <ArrowIcon />}
      </button>

      <div className="cfg-trust">
        {TRUST.map((x) => (
          <div className="cfg-trust-item" key={x.t}>
            <span className="ti-ico">{x.icon}</span>
            <span className="ti-txt">
              <b>{x.t}</b>
              <small>{x.s}</small>
            </span>
          </div>
        ))}
      </div>
    </form>
  );
}
