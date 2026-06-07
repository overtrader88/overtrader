"use client";

import { useEffect, useState } from "react";

interface WItem {
  id: string;
  symbol: string;
  timeframe: string;
  min_signal_strength: string;
}

/** Gatilho em PT (≥ aquele lado/força). */
const SIG_PT: Record<string, string> = {
  WEAK_BUY: "↑ Qualquer compra", BUY: "↑ Compra ou mais forte", STRONG_BUY: "↑ Só compra forte",
  WEAK_SELL: "↓ Qualquer venda", SELL: "↓ Venda ou mais forte", STRONG_SELL: "↓ Só venda forte",
};

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
        Watchlist vazia. <a href="/watchlist" style={{ color: "var(--cyan)" }}>Gerenciar watchlist</a> para adicionar ativos e receber alertas.
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
          <span className="chip" style={{ fontSize: 10 }}>{SIG_PT[w.min_signal_strength] ?? w.min_signal_strength}</span>
          <button type="button" className="wl-x" onClick={() => remove(w.id)} aria-label={`Remover ${w.symbol}`}>×</button>
        </div>
      ))}
    </div>
  );
}
