"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface LiveAsset {
  symbol: string;
  name: string;
  assetType: string;
  open: boolean;
  reopenHint?: string;
}

/**
 * Grade de Live Trading (estilo "Live Trading IA 24/7"): cada ativo tem um
 * toggle. Ativar cobra 2 créditos imediatamente + 2/hora no servidor (continua
 * contando com a página fechada até desligar). Mercado fechado → travado.
 */
export function LiveGrid({ assets, activeSymbols, plan, credits }: {
  assets: LiveAsset[];
  activeSymbols: string[];
  plan: string;
  credits: number;
}) {
  const router = useRouter();
  const isPro = plan === "pro" || plan === "pro_plus";
  const [active, setActive] = useState<Set<string>>(new Set(activeSymbols));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<LiveAsset | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function doActivate(sym: string) {
    setConfirm(null); setErr(null); setBusy(sym);
    try {
      const r = await fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym }) });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && data.ok) { setActive((s) => new Set(s).add(sym)); router.refresh(); }
      else setErr(data.error ?? "Falha ao ativar.");
    } catch { setErr("Falha de rede."); } finally { setBusy(null); }
  }

  async function doDeactivate(sym: string) {
    setErr(null); setBusy(sym);
    try {
      await fetch("/api/live", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: sym }) });
      setActive((s) => { const n = new Set(s); n.delete(sym); return n; });
      router.refresh();
    } catch { setErr("Falha de rede."); } finally { setBusy(null); }
  }

  return (
    <div className="lg">
      <div className="lg-banner">
        <div className="lg-b-h">💠 Consumo de Créditos</div>
        <p>Cada live ativa consome <b>2 créditos por hora</b>. O relógio corre no servidor — desative quando não estiver assistindo.</p>
        <p className="lg-beta">⚠️ FUNÇÃO EM BETA — pode apresentar instabilidades e ajustes em tempo real.</p>
      </div>

      {!isPro ? (
        <div className="lg-locked">
          O Live Trading é exclusivo para assinantes <b>PRO</b> e <b>PRO+</b>. <a href="/planos">Ver planos →</a>
        </div>
      ) : (
        <div className="lg-bal">Saldo: <b>{credits}</b> créditos</div>
      )}
      {err ? <div className="lg-err">{err}</div> : null}

      <div className="lg-grid">
        {assets.map((a) => {
          const on = active.has(a.symbol);
          const loading = busy === a.symbol;
          const disabled = !isPro || !a.open || loading;
          return (
            <div className={`lg-card ${on ? "on" : a.open ? "live" : "closed"}`} key={a.symbol}>
              <div className="lg-card-top">
                <span className={`lg-badge ${on ? "on" : a.open ? "live" : "closed"}`}>{on ? "● ATIVO" : a.open ? "● LIVE" : "FECHADO"}</span>
              </div>
              <div className="lg-card-mid">
                {!a.open ? (
                  <div className="lg-closed-msg">🔒<span>Mercado Fechado</span><small>Reabre {a.reopenHint ?? "em breve"}</small></div>
                ) : on ? (
                  <a className="lg-access" href={`/ao-vivo?symbol=${encodeURIComponent(a.symbol)}`}>▶ Acessar Live Trading</a>
                ) : (
                  <button type="button" className="lg-play" disabled={disabled} onClick={() => setConfirm(a)}>
                    {loading ? "…" : "▶ Clique aqui para ativar"}
                  </button>
                )}
              </div>
              <div className="lg-card-bot">
                <div className="lg-sym">
                  <b>{a.symbol}</b>{on ? <span className="lg-rate"> · −2 créditos/h</span> : null}
                  <small>{a.name}</small>
                </div>
                <button
                  type="button"
                  className={`lg-toggle ${on ? "on" : ""}`}
                  disabled={disabled && !on}
                  aria-label={on ? "Desativar" : "Ativar"}
                  onClick={() => (on ? doDeactivate(a.symbol) : setConfirm(a))}
                >
                  <span className="knob" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {confirm ? (
        <div className="lg-modal-bg" onClick={() => setConfirm(null)}>
          <div className="lg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lg-modal-h">⚠️ Ativar Live Trading</div>
            <div className="lg-modal-sub">{confirm.name} ({confirm.symbol})</div>
            <p>Ao ativar, serão cobrados <b>2 créditos imediatamente</b> e <b>a cada hora</b> enquanto a live estiver ativa (mesmo com a página fechada). Desligue o toggle para parar.</p>
            <div className="lg-modal-actions">
              <button type="button" className="lg-cancel" onClick={() => setConfirm(null)}>Cancelar</button>
              <button type="button" className="lg-confirm" onClick={() => doActivate(confirm.symbol)}>● Ativar Live</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
