"use client";

import { useEffect, useState } from "react";
import type { Timeframe } from "@tradeai/shared";
import { CATALOG, ASSET_CLASS_PT, findAsset } from "@/lib/market/catalog";

interface WItem { id: string; symbol: string; timeframe: string; min_signal_strength: string; }

const TFS: Timeframe[] = ["15m", "1h", "4h", "1d", "1w", "1M"];
// Gatilho do alerta: lado + força mínima (compra OU venda).
const STRENGTHS = [
  { v: "WEAK_BUY", label: "↑ Qualquer compra", group: "Compra" },
  { v: "BUY", label: "↑ Compra ou mais forte", group: "Compra" },
  { v: "STRONG_BUY", label: "↑ Só compra forte", group: "Compra" },
  { v: "WEAK_SELL", label: "↓ Qualquer venda", group: "Venda" },
  { v: "SELL", label: "↓ Venda ou mais forte", group: "Venda" },
  { v: "STRONG_SELL", label: "↓ Só venda forte", group: "Venda" },
];
const STRENGTH_GROUPS = ["Compra", "Venda"] as const;

// Catálogo agrupado por classe (mesma ordem do seletor do ao-vivo).
const GROUPS = (["crypto", "forex", "commodities", "indices", "stocks"] as const).map((cls) => ({
  cls, label: ASSET_CLASS_PT[cls], items: CATALOG.filter((a) => a.assetType === cls),
}));

export function WatchlistManager() {
  const [items, setItems] = useState<WItem[] | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [strength, setStrength] = useState("STRONG_BUY");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { const d = (await (await fetch("/api/watchlist")).json()) as { items?: WItem[] }; setItems(d.items ?? []); }
    catch { setItems([]); }
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    setErr(null); setBusy(true);
    try {
      const r = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, timeframe, min_signal_strength: strength }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error ?? "Falha ao adicionar."); return; }
      await load();
    } finally { setBusy(false); }
  }

  async function setItemStrength(it: WItem, v: string) {
    await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: it.symbol, timeframe: it.timeframe, min_signal_strength: v }) });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="wm">
      <div className="wm-add">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="wm-sel wm-sym">
          {GROUPS.map((g) => (
            <optgroup key={g.cls} label={g.label}>
              {g.items.map((a) => <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>)}
            </optgroup>
          ))}
        </select>
        <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)} className="wm-sel">
          {TFS.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select value={strength} onChange={(e) => setStrength(e.target.value)} className="wm-sel">
          {STRENGTH_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {STRENGTHS.filter((s) => s.group === g).map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="wm-add-btn" onClick={add} disabled={busy}>{busy ? "…" : "+ Adicionar"}</button>
      </div>
      {err ? <div className="lg-err" style={{ marginTop: 10 }}>{err}</div> : null}

      {items === null ? (
        <p className="note" style={{ padding: "12px 2px" }}>Carregando…</p>
      ) : items.length === 0 ? (
        <p className="note" style={{ padding: "12px 2px" }}>Watchlist vazia. Adicione um ativo acima — você recebe alerta quando ele atingir o sinal escolhido.</p>
      ) : (
        <div className="wm-tbl">
          <div className="wm-head"><span>Ativo</span><span>TF</span><span>Alerta quando</span><span /></div>
          {items.map((it) => (
            <div className="wm-row" key={it.id}>
              <span className="wm-asset"><b>{it.symbol}</b> <small>{findAsset(it.symbol)?.name ?? ""}</small></span>
              <span className="wm-tf">{it.timeframe.toUpperCase()}</span>
              <span>
                <select className="wm-sel sm" value={it.min_signal_strength} onChange={(e) => setItemStrength(it, e.target.value)}>
                  {STRENGTH_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {STRENGTHS.filter((s) => s.group === g).map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </span>
              <span className="wm-row-act">
                <a className="cr-link" href={`/analise?symbol=${encodeURIComponent(it.symbol)}&tf=${it.timeframe}`}>analisar</a>
                <button type="button" className="wm-x" onClick={() => remove(it.id)} aria-label={`Remover ${it.symbol}`}>×</button>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="note" style={{ fontSize: "0.72rem", marginTop: 10 }}>
        A IA varre a watchlist de hora em hora e dispara um alerta (sininho + Telegram, se vinculado) quando o ativo atinge o sinal mínimo escolhido. Conteúdo educativo — não é recomendação.
      </p>
    </div>
  );
}
