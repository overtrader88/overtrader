"use client";

import { useEffect, useState } from "react";

interface WItem {
  id: string;
  symbol: string;
  timeframe: string;
  min_signal_strength: string;
}

/** Painel de watchlist do dashboard — lista/remove itens reais via /api/watchlist. */
export function WatchlistPanel() {
  const [items, setItems] = useState<WItem[] | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/watchlist");
      const d: { items?: WItem[] } = await r.json();
      setItems(d.items ?? []);
    } catch {
      setItems([]);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    void load();
  }

  if (!items) return <p className="note" style={{ padding: "8px 6px", margin: 0 }}>Carregando…</p>;
  if (items.length === 0) {
    return (
      <p className="note" style={{ padding: "8px 6px", margin: 0 }}>
        Watchlist vazia. <a href="/watchlist" style={{ color: "var(--cyan)" }}>Gerenciar watchlist</a> ou use <b>★ Acompanhar</b> na <a href="/analise" style={{ color: "var(--cyan)" }}>Análise</a>.
      </p>
    );
  }
  return (
    <div className="alist">
      {items.map((w) => (
        <div className="wrow" key={w.id}>
          <div className="a-sym">
            <span className="s">{w.symbol}</span>
            <span className="tf">{w.timeframe.toUpperCase()}</span>
          </div>
          <span className="chip" style={{ fontSize: 10 }}>≥ {w.min_signal_strength.replace(/_/g, " ")}</span>
          <a className="see" href={`/analise?symbol=${encodeURIComponent(w.symbol)}&tf=${w.timeframe}`}>analisar →</a>
          <button type="button" className="wl-x" onClick={() => remove(w.id)} aria-label={`Remover ${w.symbol}`}>×</button>
        </div>
      ))}
    </div>
  );
}
