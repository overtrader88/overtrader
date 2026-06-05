"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { CATALOG } from "@/lib/market/catalog";

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d", "1w"];
const TYPES: { v: AssetType; label: string }[] = [
  { v: "crypto", label: "Cripto" },
  { v: "forex", label: "Forex" },
  { v: "commodities", label: "Commodities" },
  { v: "indices", label: "Índices" },
  { v: "stocks", label: "Ações" },
];

/**
 * Seletor de ativo/timeframe da tela de Análise. Empurra os parâmetros pra URL
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setPending(true);
    router.push(`/analise?symbol=${encodeURIComponent(s)}&type=${at}&tf=${tf}`);
  }

  return (
    <form className="analyze-form" onSubmit={submit}>
      <input
        className="af-input"
        list="af-symbols"
        value={sym}
        onChange={(e) => setSym(e.target.value)}
        placeholder="Ativo (ex.: BTCUSDT)"
        aria-label="Símbolo do ativo"
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id="af-symbols">
        {CATALOG.map((a) => (
          <option key={a.symbol} value={a.symbol}>
            {a.name}
          </option>
        ))}
      </datalist>
      <select className="af-sel" value={at} onChange={(e) => setAt(e.target.value as AssetType)} aria-label="Classe de ativo">
        {TYPES.map((t) => (
          <option key={t.v} value={t.v}>
            {t.label}
          </option>
        ))}
      </select>
      <select className="af-sel" value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} aria-label="Timeframe">
        {TFS.map((t) => (
          <option key={t} value={t}>
            {t.toUpperCase()}
          </option>
        ))}
      </select>
      <button type="submit" className="af-go" disabled={pending}>
        {pending ? "Analisando…" : "Analisar"}
      </button>
    </form>
  );
}
