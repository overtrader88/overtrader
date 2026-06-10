"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui";

export interface LiveAsset {
  symbol: string;
  name: string;
  assetType: string;
  open: boolean;
  reopenHint?: string;
}

/** Sparkline DECORATIVA por símbolo (determinística, sem rede) — o "gráfico" azul no topo do card. */
function bgSpark(symbol: string): { line: string; area: string } {
  const W = 240, H = 120, N = 30;
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let v = 0.45 + rnd() * 0.2;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    v += (rnd() - 0.46) * 0.18;
    v = Math.max(0.12, Math.min(0.9, v));
    pts.push(`${((i / (N - 1)) * W).toFixed(1)},${(H - v * H).toFixed(1)}`);
  }
  const line = pts.join(" ");
  return { line, area: `0,${H} ${line} ${W},${H}` };
}

/** Ícone do ativo — círculo (ou quadrado p/ índices) colorido por símbolo. */
const ICON: Record<string, { g: string; grad: string; sq?: boolean }> = {
  BTCUSDT: { g: "₿", grad: "linear-gradient(135deg,#f7931a,#ffbf6b)" },
  ETHUSDT: { g: "◈", grad: "linear-gradient(135deg,#8a8bff,#b08bff)" },
  SOLUSDT: { g: "◎", grad: "linear-gradient(135deg,#14f195,#9945ff)" },
  EURUSD: { g: "€", grad: "linear-gradient(135deg,#2bd49e,#1f9d74)" },
  GBPUSD: { g: "£", grad: "linear-gradient(135deg,#a98bff,#7b6cff)" },
  USDJPY: { g: "¥", grad: "linear-gradient(135deg,#ff6b8a,#ff9aae)" },
  AUDUSD: { g: "$", grad: "linear-gradient(135deg,#2bd49e,#1f9d74)" },
  USDCAD: { g: "$", grad: "linear-gradient(135deg,#ff6b6b,#e23b3b)" },
  XAUUSD: { g: "Au", grad: "linear-gradient(135deg,#ffd24a,#caa01c)" },
  DJI: { g: "DJI", grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true },
  NDX: { g: "NDX", grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true },
  SPX: { g: "S&P", grad: "linear-gradient(135deg,#8a8bff,#5b5cff)", sq: true },
};
function LiveIcon({ symbol }: { symbol: string }) {
  const it = ICON[symbol] ?? { g: symbol.slice(0, 3), grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true };
  return <span className={`lg-ico${it.sq ? " sq" : ""}`} style={{ background: it.grad }} aria-hidden>{it.g}</span>;
}

const PlayIco = () => <svg className="pl" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>;
const ChartIco = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 17l5-5 4 4 8-8" /></svg>;
const GridIco = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const SortIco = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3" /></svg>;
const GaugeIco = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /><path d="m12 12 4.5-3.5" /><path d="M4.5 18a9 9 0 1 1 15 0" /></svg>;

/**
 * Grade de Live Trading ("Live Trading IA 24/7"): cada ativo tem um toggle.
 * Ativar cobra 2 créditos + 2/hora no servidor. Mercado fechado → travado.
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
  const [eng, setEng] = useState<"padrao" | "classe">("padrao");
  const [sortKey, setSortKey] = useState<"padrao" | "az" | "ativas">("padrao");
  const engQs = eng === "classe" ? "&engine=classe" : "";

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

  const ordered = useMemo(() => {
    const arr = [...assets];
    if (sortKey === "az") arr.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else if (sortKey === "ativas") arr.sort((a, b) => (active.has(b.symbol) ? 1 : 0) - (active.has(a.symbol) ? 1 : 0));
    return arr;
  }, [assets, sortKey, active]);

  return (
    <div className="lg">
      {/* BANNER — consumo de créditos */}
      <div className="lg-banner2">
        <div className="lg-banner-main">
          <div className="lg-banner-l">
            <span className="lg-banner-ico"><Logo size={26} /></span>
            <div className="lg-banner-txt">
              <b>Consumo de Créditos</b>
              <p>Cada live ativa consome <b>2 créditos por hora</b>.</p>
              <p>O relógio corre no servidor — desative quando não estiver assistindo.</p>
            </div>
          </div>
          <div className="lg-banner-r">
            {isPro ? (
              <div className="lg-bal2"><span>Saldo disponível</span><b><i>{credits}</i> créditos</b></div>
            ) : (
              <div className="lg-bal2 locked"><span>Exclusivo PRO / PRO+</span><a href="/planos">Ver planos →</a></div>
            )}
            <span className="lg-gauge"><GaugeIco /></span>
          </div>
        </div>
        <div className="lg-beta2">⚠️ FUNÇÃO EM BETA — pode apresentar instabilidades e ajustes em tempo real.</div>
      </div>

      {err ? <div className="lg-err">{err}</div> : null}

      {/* CONTROLES — motor + ordenar */}
      <div className="lg-controls">
        <div className="lg-controls-l">
          <span className="lg-controls-label">Motor de análise na live</span>
          <div className="engine-switch" role="group" aria-label="Motor de análise">
            <button type="button" className={eng === "padrao" ? "on" : undefined} aria-pressed={eng === "padrao"} onClick={() => setEng("padrao")}><ChartIco /> Padrão</button>
            <button type="button" className={eng === "classe" ? "on" : undefined} aria-pressed={eng === "classe"} onClick={() => setEng("classe")} title="Metodologia por família de ativo"><GridIco /> Por classe</button>
          </div>
        </div>
        <label className="lg-sort">
          <SortIco />
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} aria-label="Ordenar">
            <option value="padrao">Ordenar</option>
            <option value="az">A — Z</option>
            <option value="ativas">Ativas primeiro</option>
          </select>
        </label>
      </div>

      {/* GRADE */}
      <div className="lg-grid">
        {ordered.map((a) => {
          const on = active.has(a.symbol);
          const loading = busy === a.symbol;
          const disabled = !isPro || !a.open || loading;
          const spark = bgSpark(a.symbol);
          const state = on ? "on" : a.open ? "live" : "closed";
          return (
            <article className={`lg-card ${state}`} key={a.symbol}>
              <svg className="lg-chart" viewBox="0 0 240 120" preserveAspectRatio="none" aria-hidden>
                <polygon className="lg-chart-area" points={spark.area} />
                <polyline className="lg-chart-line" points={spark.line} />
              </svg>

              <span className={`lg-badge ${state}`}>{on ? "● ATIVO" : a.open ? "● LIVE" : "● FECHADO"}</span>

              <div className="lg-cta-row">
                {on ? (
                  <a className="lg-cta access" href={`/ao-vivo?symbol=${encodeURIComponent(a.symbol)}${engQs}`}><PlayIco /> Acessar Live</a>
                ) : (
                  <button
                    type="button"
                    className="lg-cta"
                    disabled={disabled}
                    title={!a.open ? `Mercado fechado · reabre ${a.reopenHint ?? "em breve"}` : !isPro ? "Exclusivo PRO/PRO+" : undefined}
                    onClick={() => setConfirm(a)}
                  >
                    {loading ? "…" : <><PlayIco /> Ativar Live</>}
                  </button>
                )}
              </div>

              <div className="lg-foot">
                <div className="lg-foot-l">
                  <LiveIcon symbol={a.symbol} />
                  <div className="lg-meta">
                    <b>{a.symbol}</b>
                    <small>{a.name}{on ? " · −2 cr/h" : !a.open ? " · fechado" : ""}</small>
                  </div>
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
            </article>
          );
        })}
      </div>

      <p className="lg-tip"><span>ⓘ</span> Dica: você pode ativar várias lives ao mesmo tempo.</p>

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
