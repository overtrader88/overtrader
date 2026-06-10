"use client";

import { useCallback, useEffect, useState } from "react";
import { AssetGlyph } from "@/components/asset-glyph";

interface Market {
  symbol: string; timeframe: string; signal: string; strength: number;
  side: "buy" | "sell" | "neutral"; regime: string | null; price: number | null;
  watched?: boolean;
}
interface LiveLifecycle {
  tp1Hit: boolean; tp2Hit: boolean; tp3Hit: boolean;
  stopStage: "initial" | "breakeven" | "tp1";
  currentStop: number; closedFraction: number;
  status: "open" | "resolved"; outcome: string | null; pnlR: number | null; price: number | null;
}
interface ActiveSignal {
  symbol: string; timeframe: string; direction: string; side: string; seal: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number;
  regime: string | null; narrative: string | null; emitted_at: string;
  tp1_hit: boolean; tp2_hit: boolean; tp3_hit: boolean; stop_stage: string;
  live: LiveLifecycle | null;
}
interface MonitorData { markets: Market[]; signals: ActiveSignal[]; ts: number }

const POLL_MS = 45_000;
const SIGNAL_PT: Record<string, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA", NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};
const REGIME_PT: Record<string, string> = { trending: "Tendência", ranging: "Lateral", transitional: "Transição", explosive: "Explosivo" };
const SEAL_C: Record<string, string> = { green: "var(--bull)", yellow: "var(--amber)", red: "var(--bear)", grey: "var(--ink-faint)" };
const sideClass = (s: string) => (s.includes("BUY") || s === "buy" ? "up" : s.includes("SELL") || s === "sell" ? "dn" : "neu");
const fmt = (p: number | null) => (p == null ? "—" : p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 }));
const fmtR = (r: number) => `${r >= 0 ? "+" : ""}${(Math.round(r * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}R`;

/** Onde o stop está AGORA (após a gestão em terços) — texto curto pro card. */
function stopLabel(lc: LiveLifecycle, entry: number): { text: string; price: number; moved: boolean } {
  if (lc.stopStage === "tp1") return { text: "protegido em TP1 (após TP2)", price: lc.currentStop, moved: true };
  if (lc.stopStage === "breakeven") return { text: "no zero a zero (após TP1)", price: entry, moved: true };
  return { text: "inicial", price: lc.currentStop, moved: false };
}
/** Sinal já encerrado ao vivo (o cron ainda não gravou) — desfecho legível + R realizado. */
const CLOSED_PT: Record<string, string> = {
  TP3: "Alvo final (TP3) atingido", TP2: "Encerrada no TP1 após TP2",
  TP1: "Zerada no zero a zero após TP1", SL: "Stopada", EXPIRED: "Expirada",
};
function closedTone(outcome: string | null, pnlR: number | null): string {
  if (outcome === "SL") return "var(--bear)";
  if (outcome === "EXPIRED") return "var(--ink-faint)";
  return (pnlR ?? 0) > 0 ? "var(--bull)" : "var(--ink-faint)";
}
/**
 * "Ainda dá pra entrar?" — para quem abre um sinal ATRASADO (ex.: dormiu na
 * emissão). Compara o preço ao vivo com a entrada/TP1 do plano e diz se a entrada
 * ainda está na zona, se o preço já avançou (entrada tardia) ou se já passou do TP1.
 */
type EntryView = { label: string; tone: string; tip: string };
function entryView(s: ActiveSignal, lc: LiveLifecycle | null): EntryView | null {
  if (!lc || lc.price == null || lc.status === "resolved") return null;
  const buy = s.side === "buy" || s.direction.includes("BUY");
  if (lc.tp1Hit) return { label: "Já passou do TP1 — tarde p/ entrar", tone: "var(--amber)", tip: "O preço já alcançou o 1º alvo; entrar agora é correr atrás (R:R pior)." };
  const dist = s.tp1 - s.entry;                                  // assinado pelo lado
  const progress = dist !== 0 ? (lc.price - s.entry) / dist : 0; // fração entrada→TP1
  if (progress <= 0.25) {
    const better = buy ? lc.price < s.entry : lc.price > s.entry;
    return better
      ? { label: "Ainda dá pra entrar · preço melhor que a entrada", tone: "var(--bull)", tip: "Preço na zona de entrada e a seu favor." }
      : { label: "Ainda dá pra entrar · preço na zona", tone: "var(--bull)", tip: "Preço ainda próximo da entrada do plano." };
  }
  const pct = Math.min(99, Math.round(progress * 100));
  return { label: `Preço já andou ~${pct}% até o TP1 — entrada tardia`, tone: "var(--amber)", tip: "R:R pior que na emissão; avalie esperar um pullback à entrada." };
}

export function MonitorLive({ watch, engineQs = "" }: { watch?: string; engineQs?: string }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const load = useCallback(async () => {
    try {
      const url = watch ? `/api/monitor?watch=${encodeURIComponent(watch)}` : "/api/monitor";
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData((await r.json()) as MonitorData);
      setUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
      setErr(false);
    } catch {
      setErr(true);
    }
  }, [watch]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return <p className="note">{err ? "Não foi possível carregar o monitor agora." : "Carregando monitor ao vivo…"}</p>;

  return (
    <div className="mon">
      <div className="mon-bar">
        <span className="seg live"><span className="dot" />AO VIVO</span>
        <span className="note">atualiza a cada 45s{updatedAt ? ` · ${updatedAt}` : ""}{err ? " · reconectando…" : ""}</span>
      </div>

      <div className="mon-sec-h">Setups de qualidade ativos</div>
      {data.signals.length === 0 ? (
        <div className="mon-empty">Nenhum setup de qualidade ativo agora — <b>monitorando</b>. Os sinais surgem aqui só quando o selo valida (sem alarme falso).</div>
      ) : (
        <div className="mon-signals">
          {data.signals.map((s, i) => {
            const lc = s.live;
            const tp1 = lc?.tp1Hit ?? s.tp1_hit;
            const tp2 = lc?.tp2Hit ?? s.tp2_hit;
            const tp3 = lc?.tp3Hit ?? s.tp3_hit;
            const stop = lc ? stopLabel(lc, s.entry) : null;
            const closed = lc?.status === "resolved";
            const ev = !closed ? entryView(s, lc) : null;
            return (
            <article className="mon-sig" key={i} style={{ ["--sc" as string]: SEAL_C[s.seal] ?? "var(--ink-faint)", opacity: closed ? 0.82 : 1 }}>
              <div className="ms-head">
                <AssetGlyph symbol={s.symbol} size={30} />
                <span className="ms-sym"><b>{s.symbol}</b> · {s.timeframe.toUpperCase()}</span>
                <span className={`ms-dir ${sideClass(s.direction)}`}>{SIGNAL_PT[s.direction] ?? s.direction}</span>
                <span className="ms-spacer" />
                <span className="ms-seal" style={{ color: SEAL_C[s.seal] }}>● {s.seal === "green" ? "SELO VERDE" : s.seal === "red" ? "SELO VERMELHO" : "SELO AMARELO"}</span>
                {closed || s.narrative ? (
                  <button type="button" className={`ms-chev${open.has(i) ? " open" : ""}`} aria-expanded={open.has(i)} aria-label="Detalhes" onClick={() => toggle(i)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                ) : null}
              </div>
              <div className="ms-levels">
                <span>Entrada <b>{fmt(s.entry)}</b></span>
                <span>
                  Stop <b>{fmt(stop ? stop.price : s.stop_loss)}</b>
                  {stop?.moved ? <em style={{ fontStyle: "normal", color: "var(--bull)", marginLeft: 4 }}>↑ {stop.text}</em> : null}
                </span>
                <span>Alvos {fmt(s.tp1)} / {fmt(s.tp2)} / {fmt(s.tp3)}</span>
                <span className="ms-lc">
                  <i className={tp1 ? "on" : ""}>TP1</i>
                  <i className={tp2 ? "on" : ""}>TP2</i>
                  <i className={tp3 ? "on" : ""}>TP3</i>
                </span>
              </div>
              {ev ? (
                <div className="ms-entry" title={ev.tip} style={{ marginTop: 6, fontSize: "0.8rem", fontWeight: 700, color: ev.tone, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ev.tone, display: "inline-block" }} /> {ev.label}
                </div>
              ) : null}
              {open.has(i) ? (
                closed && lc ? (
                  <p className="ms-narr" style={{ color: closedTone(lc.outcome, lc.pnlR), fontWeight: 600 }}>
                    ● {CLOSED_PT[lc.outcome ?? ""] ?? "Encerrada"}{lc.pnlR != null ? ` · ${fmtR(lc.pnlR)}` : ""}
                    <span style={{ fontWeight: 400, opacity: 0.8 }}> (aguardando registro)</span>
                  </p>
                ) : s.narrative ? <p className="ms-narr">{s.narrative}</p> : null
              ) : null}
            </article>
            );
          })}
        </div>
      )}

      <div className="mon-sec-h">Mercados monitorados</div>
      <div className="mon-grid">
        {data.markets.map((m, i) => (
          <a className="mon-row" key={i} href={`/analise?symbol=${m.symbol}&tf=${m.timeframe}&type=crypto${engineQs}`}>
            <span className="mr-sym"><AssetGlyph symbol={m.symbol} size={24} />{m.watched ? <span className="mr-star" title="Da sua watchlist">★</span> : null}<b>{m.symbol}</b> · {m.timeframe.toUpperCase()}</span>
            <span className={`mr-sig ${sideClass(m.side)}`}>{SIGNAL_PT[m.signal] ?? m.signal}</span>
            <span className="mr-reg">{m.regime ? REGIME_PT[m.regime] ?? m.regime : "—"}</span>
            <span className="mr-px">{fmt(m.price)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
