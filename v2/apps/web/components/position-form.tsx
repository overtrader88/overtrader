"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssetType } from "@tradeai/shared";
import { CATALOG, ASSET_CLASS_PT, catalogByClass } from "@/lib/market/catalog";

const TYPES: { v: AssetType; label: string; hint: string }[] = [
  { v: "crypto", label: "Criptomoedas", hint: "BTC, ETH, SOL…" },
  { v: "forex", label: "Forex", hint: "EUR/USD, USD/BRL…" },
  { v: "commodities", label: "Commodities", hint: "Ouro, Petróleo…" },
  { v: "indices", label: "Índices", hint: "S&P 500, Ibovespa…" },
  { v: "stocks", label: "Ações", hint: "AAPL, NVDA…" },
];

// gradiente do avatar por classe (família cyan/violeta — verde/rosa são da direção)
const TYPE_GRAD: Record<AssetType, string> = {
  crypto: "linear-gradient(135deg, #54a8ff, #9a8bff)",
  forex: "linear-gradient(135deg, #7c9cff, #54a8ff)",
  commodities: "linear-gradient(135deg, #b08bff, #6f8dff)",
  indices: "linear-gradient(135deg, #54a8ff, #6ad3ff)",
  stocks: "linear-gradient(135deg, #8a8bff, #54a8ff)",
};

const tickerOf = (symbol: string) => symbol.replace(/USDT$|USD$/i, "").slice(0, 4) || "?";

function ChevronIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export type FormSide = "comprado" | "vendido";

/**
 * Formulário do STRESS TEST: o usuário informa a posição que JÁ TEM (classe →
 * ativo do catálogo, lado, preço de entrada) e a página (RSC) relê os parâmetros
 * da URL (?symbol&type&side&entry) pra rodar a análise e a mesa de motores.
 */
export function PositionForm({ credits = 0 }: { credits?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<AssetType | "">("");
  const [sym, setSym] = useState("");
  const [side, setSide] = useState<FormSide | "">("");
  const [entry, setEntry] = useState("");
  const [openDD, setOpenDD] = useState<null | "tipo" | "ativo">(null);
  const [query, setQuery] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  const cleanSym = sym.trim().toUpperCase();
  const matched = CATALOG.find((a) => a.symbol === cleanSym);
  const typeMeta = TYPES.find((t) => t.v === at);
  const byClass = useMemo(() => catalogByClass(), []);

  const results = useMemo(() => {
    if (!at) return [];
    const q = query.trim().toLowerCase();
    if (!q) return byClass[at];
    return CATALOG.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 80);
  }, [query, at, byClass]);

  useEffect(() => {
    if (!openDD) return;
    function onDocClick(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) setOpenDD(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openDD]);

  function pick(a: { symbol: string; assetType: AssetType }) {
    setSym(a.symbol);
    setAt(a.assetType);
    setOpenDD(null);
    setQuery("");
  }

  // aceita vírgula decimal pt-BR ("108.350,50" não — só "108350,50" ou "108350.50")
  const entryNum = Number(entry.trim().replace(",", "."));
  const entryOk = Number.isFinite(entryNum) && entryNum > 0;
  const canRun = !!at && !!cleanSym && !!side && entryOk;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canRun) { setShowErrors(true); return; }
    setShowErrors(false);
    startTransition(() => {
      router.push(`/posicao?symbol=${encodeURIComponent(cleanSym)}&type=${at}&side=${side}&entry=${entryNum}`);
    });
  }

  const errType = showErrors && !at;
  const errAsset = showErrors && !cleanSym;
  const errSide = showErrors && !side;
  const errEntry = showErrors && !entryOk;

  return (
    <form className="configurator pos-form" onSubmit={submit}>
      <div className="cfg-glow" aria-hidden />
      <div className="cfg-head">
        <div className="cfg-headline">
          <span className="cfg-eyebrow">Stress test · IA</span>
          <h2 className="cfg-title">Sua posição sobrevive à mesa?</h2>
          <p className="cfg-sub">
            Informe uma posição que você <span className="cfg-hl">já tem aberta</span>. Os motores da casa leem o mercado
            agora e respondem: quantos <b>aumentariam</b>, <b>segurariam</b> ou <b>sairiam</b>.
          </p>
        </div>
      </div>

      <div className="cfg-grid pos-grid" ref={gridRef}>
        <div className="cfg-field">
          <span className="cfg-label">Tipo de Ativo</span>
          <button
            type="button"
            className={`cfg-control as-button${openDD === "tipo" ? " open" : ""}${errType ? " err" : ""}`}
            onClick={() => setOpenDD((v) => (v === "tipo" ? null : "tipo"))}
            aria-haspopup="listbox"
            aria-expanded={openDD === "tipo"}
          >
            <span className="cfg-avatar soft">{at ? tickerOf(at).slice(0, 2).toUpperCase() : "?"}</span>
            <span className="cfg-main">
              <span className="cfg-value">{typeMeta?.label ?? "Selecione"}</span>
              <span className="cfg-meta">{typeMeta?.hint ?? "Classe do ativo"}</span>
            </span>
            <span className={`cfg-chev${openDD === "tipo" ? " open" : ""}`}><ChevronIcon /></span>
          </button>
          {openDD === "tipo" ? (
            <div className="cfg-dd" role="listbox" aria-label="Classe de ativo">
              <div className="cfg-dd-list">
                {TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.v}
                    className={`cfg-dd-item${t.v === at ? " active" : ""}`}
                    role="option"
                    aria-selected={t.v === at}
                    onClick={() => { setAt(t.v); setSym(""); setOpenDD(null); }}
                  >
                    <span className="cfg-avatar sm" style={{ background: TYPE_GRAD[t.v] }}>{t.label.slice(0, 2).toUpperCase()}</span>
                    <span className="it-sym">{t.label}</span>
                    <span className="it-name">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="cfg-field">
          <span className="cfg-label">Ativo</span>
          <button
            type="button"
            className={`cfg-control as-button${openDD === "ativo" ? " open" : ""}${errAsset ? " err" : ""}`}
            onClick={() => { if (at) { setQuery(""); setOpenDD((v) => (v === "ativo" ? null : "ativo")); } }}
            disabled={!at}
            aria-haspopup="listbox"
            aria-expanded={openDD === "ativo"}
          >
            <span className="cfg-avatar" style={at ? { background: TYPE_GRAD[at] } : undefined}>{cleanSym ? tickerOf(cleanSym) : "?"}</span>
            <span className="cfg-main">
              <span className="cfg-value">{cleanSym || "Selecione"}</span>
              <span className="cfg-meta">{!at ? "Escolha a classe primeiro" : (matched?.name ?? "Digite ou escolha um ativo")}</span>
            </span>
            <span className={`cfg-chev${openDD === "ativo" ? " open" : ""}`}><ChevronIcon /></span>
          </button>
          {openDD === "ativo" && at ? (
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
                      else if (query.trim()) { setSym(query.trim().toUpperCase()); setOpenDD(null); }
                    } else if (e.key === "Escape") {
                      setOpenDD(null);
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
                      <span className="cfg-avatar sm" style={{ background: TYPE_GRAD[a.assetType] }}>{tickerOf(a.symbol)}</span>
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

        <div className="cfg-field">
          <span className="cfg-label">Lado da posição</span>
          <div className={`pos-side-btns${errSide ? " err" : ""}`} role="group" aria-label="Lado da posição">
            <button
              type="button"
              className={`pos-side-btn buy${side === "comprado" ? " on" : ""}`}
              aria-pressed={side === "comprado"}
              onClick={() => setSide("comprado")}
            >
              ▲ Comprado
            </button>
            <button
              type="button"
              className={`pos-side-btn sell${side === "vendido" ? " on" : ""}`}
              aria-pressed={side === "vendido"}
              onClick={() => setSide("vendido")}
            >
              ▼ Vendido
            </button>
          </div>
        </div>

        <div className="cfg-field">
          <span className="cfg-label">Preço de entrada</span>
          <label className={`cfg-control pos-entry${errEntry ? " err" : ""}`}>
            <span className="cfg-avatar soft">$</span>
            <span className="cfg-main">
              <input
                className="pos-entry-input"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="ex.: 108350.50"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                aria-label="Preço de entrada"
              />
              <span className="cfg-meta">O preço em que você entrou</span>
            </span>
          </label>
        </div>
      </div>

      <div className="cfg-cta">
        <button type="submit" className="cfg-go" disabled={pending}>
          {pending ? "Consultando a mesa…" : "Rodar stress test (1 crédito)"}
        </button>
        <div className="cfg-cta-foot">
          <span className="cfg-cta-note">1 crédito por stress test — re-rodar o mesmo ativo em até 10 min é grátis.</span>
          <span className="cfg-bal">Saldo disponível: <b>{credits.toLocaleString("pt-BR")}</b> créditos</span>
        </div>
      </div>
      {showErrors && !canRun ? <p className="cfg-err-msg">Preencha os campos destacados em vermelho para rodar o stress test.</p> : null}
    </form>
  );
}
