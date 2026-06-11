"use client";

import { useEffect, useState } from "react";
import type { Timeframe } from "@tradeai/shared";
import { CATALOG, ASSET_CLASS_PT, findAsset } from "@/lib/market/catalog";
import { AssetGlyph } from "@/components/asset-glyph";
import { WATCHLIST_ALERT_COST, WATCHLIST_ALERT_DAYS } from "@/lib/billing-constants";

interface WItem { id: string; symbol: string; timeframe: string; min_signal_strength: string; engine?: string; expires_at?: string | null; }

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

const StrengthOptions = () => (
  <>
    {STRENGTH_GROUPS.map((g) => (
      <optgroup key={g} label={g}>
        {STRENGTHS.filter((s) => s.group === g).map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
      </optgroup>
    ))}
  </>
);

/** Estado de validade de um alerta a partir do expires_at.
 *  Sem expires_at = alerta legado (nunca pago) → INATIVO (só recebe quem paga 15). */
function expiryView(expiresAt: string | null | undefined, now: number): { kind: "inactive" | "active" | "dead"; label: string } {
  if (!expiresAt) return { kind: "inactive", label: "inativo" };
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { kind: "dead", label: "expirado" };
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return { kind: "active", label: `expira em ${d}d ${h}h` };
  if (h > 0) return { kind: "active", label: `expira em ${h}h ${m}min` };
  return { kind: "active", label: `expira em ${m}min` };
}

export function WatchlistManager() {
  const [items, setItems] = useState<WItem[] | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [strength, setStrength] = useState("STRONG_BUY");
  const [engine, setEngine] = useState<"padrao" | "classe">("padrao");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tique do contador de validade (1x/min basta — a precisão é em horas/dias).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    try {
      const d = (await (await fetch("/api/watchlist")).json()) as { items?: WItem[]; credits?: number };
      setItems(d.items ?? []);
      if (typeof d.credits === "number") setCredits(d.credits);
    } catch { setItems([]); }
  }
  useEffect(() => { void load(); }, []);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error ?? "Falha ao salvar o alerta."); return false; }
    return true;
  }

  async function add() {
    setErr(null); setBusy(true);
    try {
      if (await post({ symbol, timeframe, min_signal_strength: strength, engine })) await load();
    } finally { setBusy(false); }
  }

  // Troca o limiar de um alerta ATIVO — não recobra (só atualiza). Preserva o motor.
  async function setItemStrength(it: WItem, v: string) {
    setErr(null);
    if (await post({ symbol: it.symbol, timeframe: it.timeframe, min_signal_strength: v, engine: it.engine ?? "padrao" })) await load();
  }

  // Renova um alerta vencido — recobra os créditos por mais 5 dias.
  async function renew(it: WItem) {
    setErr(null); setBusy(true);
    try {
      if (await post({ symbol: it.symbol, timeframe: it.timeframe, min_signal_strength: it.min_signal_strength, engine: it.engine ?? "padrao" })) await load();
    } finally { setBusy(false); }
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
          <StrengthOptions />
        </select>
        <select value={engine} onChange={(e) => setEngine(e.target.value as "padrao" | "classe")} className="wm-sel" title="Motor que dispara o alerta">
          <option value="padrao">Motor padrão</option>
          <option value="classe">Motor por classe</option>
        </select>
        <button type="button" className="wm-add-btn" onClick={add} disabled={busy}>{busy ? "…" : `+ Adicionar · ${WATCHLIST_ALERT_COST} créditos`}</button>
      </div>

      <div className="wm-cost">
        <span>Cada alerta custa <b>{WATCHLIST_ALERT_COST} créditos</b> e vale <b>{WATCHLIST_ALERT_DAYS} dias</b> (por ativo + timeframe + direção).</span>
        {credits != null ? <span className="wm-bal">saldo: <b>{credits.toLocaleString("pt-BR")}</b> créditos</span> : null}
      </div>

      {(() => {
        const inativos = (items ?? []).filter((it) => expiryView(it.expires_at, now).kind !== "active").length;
        if (inativos === 0) return null;
        return (
          <div className="wm-warn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.5" /></svg>
            <span>Você tem <b>{inativos}</b> alerta{inativos > 1 ? "s" : ""} {inativos > 1 ? "inativos" : "inativo"} — eles <b>não estão sendo monitorados</b>. Clique em <b>ativar</b>/<b>renovar</b> na linha ({WATCHLIST_ALERT_COST} créditos · {WATCHLIST_ALERT_DAYS} dias) para voltar a receber os alertas.</span>
          </div>
        );
      })()}
      {err ? <div className="lg-err" style={{ marginTop: 10 }}>{err}</div> : null}

      {items === null ? (
        <p className="note" style={{ padding: "12px 2px" }}>Carregando…</p>
      ) : items.length === 0 ? (
        <p className="note" style={{ padding: "12px 2px" }}>Watchlist vazia. Adicione um ativo acima — cada alerta custa {WATCHLIST_ALERT_COST} créditos e vale {WATCHLIST_ALERT_DAYS} dias.</p>
      ) : (
        <div className="wm-tbl">
          <div className="wm-head"><span>Ativo</span><span>TF</span><span>Alerta quando</span><span>Validade</span><span /></div>
          {items.map((it) => {
            const ev = expiryView(it.expires_at, now);
            return (
              <div className="wm-row" key={it.id}>
                <span className="wm-asset"><AssetGlyph symbol={it.symbol} size={30} /><b>{it.symbol}</b> <small>{findAsset(it.symbol)?.name ?? ""}</small>{it.engine === "classe" ? <span className="eng-chip" style={{ marginLeft: 6 }}>⚙ M2</span> : null}</span>
                <span className="wm-tf">{it.timeframe.toUpperCase()}</span>
                <span>
                  <select className="wm-sel sm" value={it.min_signal_strength} disabled={ev.kind !== "active"} onChange={(e) => setItemStrength(it, e.target.value)}>
                    <StrengthOptions />
                  </select>
                </span>
                <span className={`wm-exp ${ev.kind}`}>{ev.label}</span>
                <span className="wm-row-act">
                  {ev.kind === "active" ? (
                    <a className="cr-link" href={`/analise?symbol=${encodeURIComponent(it.symbol)}&tf=${it.timeframe}&view=1${it.engine === "classe" ? "&engine=classe" : ""}`}>analisar</a>
                  ) : (
                    <button type="button" className="cr-link wm-renew" onClick={() => renew(it)} disabled={busy}>{ev.kind === "inactive" ? "ativar" : "renovar"}</button>
                  )}
                  <button type="button" className="wm-x" onClick={() => remove(it.id)} aria-label={`Remover ${it.symbol}`}>×</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="wm-foot">
        <span className="ic" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5v.5" /></svg>
        </span>
        <p>
          A IA varre a watchlist de hora em hora e dispara um alerta (sininho + Telegram, se vinculado) quando o ativo atinge o sinal mínimo escolhido. Cada alerta custa <b>{WATCHLIST_ALERT_COST} créditos</b> e vale <b>{WATCHLIST_ALERT_DAYS} dias</b>; ao expirar é só renovar. Conteúdo educativo — não é recomendação.
        </p>
      </div>
    </div>
  );
}
