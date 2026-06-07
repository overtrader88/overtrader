"use client";

import { useCallback, useEffect, useState } from "react";

interface Market {
  symbol: string; timeframe: string; signal: string; strength: number;
  side: "buy" | "sell" | "neutral"; regime: string | null; price: number | null;
  watched?: boolean;
}
interface ActiveSignal {
  symbol: string; timeframe: string; direction: string; side: string; seal: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number;
  regime: string | null; narrative: string | null; emitted_at: string;
  tp1_hit: boolean; tp2_hit: boolean; tp3_hit: boolean; stop_stage: string;
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

export function MonitorLive({ watch, engineQs = "" }: { watch?: string; engineQs?: string }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [err, setErr] = useState(false);

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
          {data.signals.map((s, i) => (
            <div className="mon-sig" key={i} style={{ ["--sc" as string]: SEAL_C[s.seal] ?? "var(--ink-faint)" }}>
              <div className="ms-head">
                <span className="ms-sym"><b>{s.symbol}</b> · {s.timeframe.toUpperCase()}</span>
                <span className={`ms-dir ${sideClass(s.direction)}`}>{SIGNAL_PT[s.direction] ?? s.direction}</span>
                <span className="ms-seal" style={{ color: SEAL_C[s.seal] }}>● {s.seal === "green" ? "selo verde" : "selo amarelo"}</span>
              </div>
              <div className="ms-levels">
                <span>Entrada <b>{fmt(s.entry)}</b></span>
                <span>Stop <b>{fmt(s.stop_loss)}</b></span>
                <span>Alvos {fmt(s.tp1)} / {fmt(s.tp2)} / {fmt(s.tp3)}</span>
                <span className="ms-lc">
                  <i className={s.tp1_hit ? "on" : ""}>TP1</i>
                  <i className={s.tp2_hit ? "on" : ""}>TP2</i>
                  <i className={s.tp3_hit ? "on" : ""}>TP3</i>
                </span>
              </div>
              {s.narrative ? <p className="ms-narr">{s.narrative}</p> : null}
            </div>
          ))}
        </div>
      )}

      <div className="mon-sec-h">Mercados monitorados</div>
      <div className="mon-grid">
        {data.markets.map((m, i) => (
          <a className="mon-row" key={i} href={`/analise?symbol=${m.symbol}&tf=${m.timeframe}&type=crypto${engineQs}`}>
            <span className="mr-sym">{m.watched ? <span className="mr-star" title="Da sua watchlist">★</span> : null}<b>{m.symbol}</b> · {m.timeframe.toUpperCase()}</span>
            <span className={`mr-sig ${sideClass(m.side)}`}>{SIGNAL_PT[m.signal] ?? m.signal}</span>
            <span className="mr-reg">{m.regime ? REGIME_PT[m.regime] ?? m.regime : "—"}</span>
            <span className="mr-px">{fmt(m.price)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
