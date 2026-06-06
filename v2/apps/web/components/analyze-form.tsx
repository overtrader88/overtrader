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

const baseOf = (symbol: string) => symbol.replace(/USDT$|USD$/i, "");
const tickerOf = (symbol: string) => baseOf(symbol).slice(0, 4) || "?";

// Ações → domínio (logo via Clearbit). Faltou alguém? cai no fallback de iniciais.
const STOCK_DOMAIN: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", NVDA: "nvidia.com", GOOGL: "google.com", AMZN: "amazon.com",
  META: "meta.com", TSLA: "tesla.com", NFLX: "netflix.com", AMD: "amd.com", INTC: "intel.com",
  JPM: "jpmorganchase.com", V: "visa.com", MA: "mastercard.com", DIS: "disney.com", KO: "coca-cola.com",
  PEP: "pepsico.com", NKE: "nike.com", BA: "boeing.com", XOM: "exxonmobil.com", CVX: "chevron.com",
  WMT: "walmart.com", PYPL: "paypal.com", BABA: "alibaba.com", ORCL: "oracle.com", CRM: "salesforce.com",
  ADBE: "adobe.com", AVGO: "broadcom.com", COST: "costco.com", MCD: "mcdonalds.com", CSCO: "cisco.com",
  QCOM: "qualcomm.com", TXN: "ti.com", IBM: "ibm.com", GE: "ge.com", GS: "goldmansachs.com",
  BAC: "bankofamerica.com", PFE: "pfizer.com", JNJ: "jnj.com", UNH: "unitedhealthgroup.com", HD: "homedepot.com",
  SBUX: "starbucks.com",
};
// Moeda → código de bandeira (flagcdn). EUR usa a bandeira da UE ("eu").
const CCY_FLAG: Record<string, string> = {
  EUR: "eu", USD: "us", GBP: "gb", JPY: "jp", CHF: "ch", AUD: "au", CAD: "ca", NZD: "nz",
  BRL: "br", MXN: "mx", ZAR: "za", SEK: "se",
};
const flagUrl = (code: string) => `https://flagcdn.com/w160/${code}.png`;

/**
 * Selo/logo do ativo, por classe:
 *  · cripto  → ícone oficial (cryptocurrency-icons via jsDelivr)
 *  · ações   → logo da empresa (Clearbit, por domínio)
 *  · forex   → par de bandeiras (base + cotação) via flagcdn
 *  · resto   → tile com gradiente + iniciais
 * Qualquer falha de imagem cai no fallback de iniciais. `key` remonta ao trocar.
 */
function AssetAvatar({ symbol, assetType, compact }: { symbol: string; assetType: AssetType; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const cls = `cfg-avatar${compact ? " sm" : ""}`;
  const initials = tickerOf(symbol);

  if (!failed) {
    if (assetType === "crypto") {
      const b = baseOf(symbol).toLowerCase();
      if (b) return (
        <span className={`${cls} logo`}>
          <img src={`https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${b}.svg`} alt="" loading="lazy" onError={() => setFailed(true)} />
        </span>
      );
    }
    if (assetType === "stocks") {
      const dom = STOCK_DOMAIN[symbol.toUpperCase()];
      if (dom) return (
        <span className={`${cls} logo brand`}>
          <img src={`https://logo.clearbit.com/${dom}`} alt="" loading="lazy" onError={() => setFailed(true)} />
        </span>
      );
    }
    if (assetType === "forex") {
      const b = CCY_FLAG[symbol.slice(0, 3).toUpperCase()];
      const q = CCY_FLAG[symbol.slice(3, 6).toUpperCase()];
      if (b && q) return (
        <span className={`${cls} flags`}>
          <img className="fx-b" src={flagUrl(b)} alt="" loading="lazy" />
          <img className="fx-q" src={flagUrl(q)} alt="" loading="lazy" />
        </span>
      );
    }
  }
  return (
    <span className={cls} style={{ background: TYPE_GRAD[assetType] }}>
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ddRef = useRef<HTMLDivElement>(null);

  const cleanSym = sym.trim().toUpperCase();
  const matched = CATALOG.find((a) => a.symbol === cleanSym);
  const typeMeta = TYPES.find((t) => t.v === at);
  const tfMeta = TFS.find((t) => t.v === tf);
  const byClass = useMemo(() => catalogByClass(), []);

  // Lista do dropdown: sem busca → todos da classe atual; com busca → varre os 143.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byClass[at];
    return CATALOG.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 80);
  }, [query, at, byClass]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(a: { symbol: string; assetType: AssetType }) {
    setSym(a.symbol);
    setAt(a.assetType);
    setOpen(false);
    setQuery("");
  }
  function openDropdown() {
    setQuery("");
    setOpen((v) => !v);
  }
  function changeType(next: AssetType) {
    setAt(next);
    // mantém ativo coerente com a classe: troca pro 1º da nova classe se o atual não for dela
    if (matched?.assetType !== next) setSym(byClass[next][0]?.symbol ?? sym);
  }

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
        <div className="cfg-field" ref={ddRef}>
          <span className="cfg-label">Ativo</span>
          <button
            type="button"
            className={`cfg-control as-button${open ? " open" : ""}`}
            onClick={openDropdown}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <AssetAvatar key={`${at}-${cleanSym}`} symbol={cleanSym} assetType={at} />
            <span className="cfg-main">
              <span className="cfg-value">{cleanSym || "Selecione"}</span>
              <span className="cfg-meta">{matched?.name ?? "Digite ou escolha um ativo"}</span>
            </span>
            <span className={`cfg-chev${open ? " open" : ""}`}><ChevronIcon /></span>
          </button>

          {open ? (
            <div className="cfg-dd" role="listbox" aria-label="Lista de ativos">
              <div className="cfg-dd-head">
                <input
                  className="cfg-dd-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar entre 143 ativos…"
                  aria-label="Buscar ativo"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (results[0]) pick(results[0]);
                      else if (query.trim()) { setSym(query.trim().toUpperCase()); setOpen(false); }
                    } else if (e.key === "Escape") {
                      setOpen(false);
                    }
                  }}
                />
                <div className="cfg-dd-count">
                  {query.trim()
                    ? `${results.length} resultado${results.length === 1 ? "" : "s"}`
                    : `${results.length} ativos · ${ASSET_CLASS_PT[at]}`}
                </div>
              </div>
              <div className="cfg-dd-list">
                {results.length === 0 ? (
                  <div className="cfg-dd-empty">Nenhum ativo encontrado. Pressione Enter pra usar “{query.trim().toUpperCase()}”.</div>
                ) : (
                  results.map((a) => (
                    <button
                      type="button"
                      key={a.symbol}
                      className={`cfg-dd-item${a.symbol === cleanSym ? " active" : ""}`}
                      role="option"
                      aria-selected={a.symbol === cleanSym}
                      onClick={() => pick(a)}
                    >
                      <AssetAvatar compact key={a.symbol} symbol={a.symbol} assetType={a.assetType} />
                      <span className="it-sym">{a.symbol}</span>
                      <span className="it-name">{a.name}</span>
                      <span className="it-cls">{ASSET_CLASS_PT[a.assetType]}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <label className="cfg-field">
          <span className="cfg-label">Tipo de Ativo</span>
          <div className="cfg-control">
            <span className="cfg-avatar soft">{TYPE_ICON[at]}</span>
            <span className="cfg-main">
              <select className="cfg-select" value={at} onChange={(e) => changeType(e.target.value as AssetType)} aria-label="Classe de ativo">
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
