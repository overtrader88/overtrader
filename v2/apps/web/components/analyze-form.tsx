"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { CATALOG } from "@/lib/market/catalog";

const TFS: { v: Timeframe; label: string }[] = [
  { v: "15m", label: "15 minutos" },
  { v: "1h", label: "1 hora" },
  { v: "4h", label: "4 horas" },
  { v: "1d", label: "Diário" },
  { v: "1w", label: "Semanal" },
];
const TYPES: { v: AssetType; label: string }[] = [
  { v: "crypto", label: "Criptomoedas" },
  { v: "forex", label: "Forex" },
  { v: "commodities", label: "Commodities" },
  { v: "indices", label: "Índices" },
  { v: "stocks", label: "Ações" },
];

// ---------- ícones (inline, herdam currentColor) ----------
function CandlesIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M7 3v4M7 17v4M7 7h0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <path d="M17 6v3M17 16v3M17 9a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
const TYPE_ICON: Record<AssetType, React.ReactNode> = {
  crypto: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" />
      <path d="M12 7v10M8 9.5 16 14.5M16 9.5 8 14.5" strokeWidth="1.2" />
    </svg>
  ),
  forex: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  ),
  commodities: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c3 4 5 6.5 5 9.5A5 5 0 0 1 7 12.5C7 9.5 9 7 12 3Z" />
    </svg>
  ),
  indices: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
  stocks: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16l5-6 4 4 5-8M21 6h-4M21 6v4" />
    </svg>
  ),
};

/**
 * Configurador da tela de Análise: ativo + classe + timeframe em cartões
 * rotulados. Empurra os parâmetros pra URL (?symbol&type&tf) — a página (RSC)
 * relê e re-analisa com dados reais.
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

  const matched = CATALOG.find((a) => a.symbol === sym.trim().toUpperCase());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setPending(true);
    router.push(`/analise?symbol=${encodeURIComponent(s)}&type=${at}&tf=${tf}`);
  }

  return (
    <form className="configurator" onSubmit={submit}>
      <div className="cfg-head">
        <div>
          <h2 className="cfg-title">Configurar Análise</h2>
          <p className="cfg-sub">Escolha o ativo, a classe e o timeframe ideais para suas operações</p>
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
            <span className="cfg-ico"><CandlesIcon /></span>
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
            {matched ? <span className="cfg-name">{matched.name}</span> : null}
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
            <span className="cfg-ico">{TYPE_ICON[at]}</span>
            <select className="cfg-select" value={at} onChange={(e) => setAt(e.target.value as AssetType)} aria-label="Classe de ativo">
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="cfg-chev"><ChevronIcon /></span>
          </div>
        </label>

        <label className="cfg-field">
          <span className="cfg-label">Timeframe</span>
          <div className="cfg-control">
            <span className="cfg-ico"><ClockIcon /></span>
            <select className="cfg-select" value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} aria-label="Timeframe">
              {TFS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="cfg-chev"><ChevronIcon /></span>
          </div>
        </label>
      </div>

      <button type="submit" className="cfg-go" disabled={pending}>
        {pending ? "Analisando…" : "Analisar agora"}
        {pending ? null : <ArrowIcon />}
      </button>
    </form>
  );
}
