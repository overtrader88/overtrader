"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { SignalDirection, Timeframe } from "@tradeai/shared";
import { signalSide } from "@tradeai/shared";
import type { LifecycleState } from "@tradeai/engine";
import { CATALOG, ASSET_CLASS_PT } from "@/lib/market/catalog";
import { SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST } from "@/lib/billing-constants";
import type { SimulationResult } from "@/lib/simulator/service";
import { Panel, PanelLabel } from "@/components/ui/panel";
import { SimChart } from "./sim-chart";

interface Billing { usedToday: number; freePerDay: number; cost: number; charged: boolean; balance: number }
type SimResponse = SimulationResult & { billing: Billing };

const TFS: { v: Timeframe; label: string; reach: string }[] = [
  { v: "15m", label: "15 minutos", reach: "viaja ~1 mês" },
  { v: "1h", label: "1 hora", reach: "viaja ~4 meses" },
  { v: "4h", label: "4 horas", reach: "viaja ~1,5 ano" },
  { v: "1d", label: "Diário", reach: "viaja ~8 anos" },
  { v: "1w", label: "Semanal", reach: "viaja ~6 anos" },
];

const SIGNAL_PT: Record<SignalDirection, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA", NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};
const SEAL_PT: Record<string, { label: string; color: string }> = {
  green: { label: "SELO VERDE", color: "var(--bull)" },
  yellow: { label: "SELO AMARELO", color: "var(--amber)" },
  red: { label: "SELO VERMELHO", color: "var(--bear)" },
  grey: { label: "SEM SELO", color: "var(--ink-faint)" },
};
const OUTCOME_PT: Record<string, string> = {
  TP1: "ALVO 1 (saída escalonada)", TP2: "ALVO 2 (saída escalonada)", TP3: "ALVO 3 — PLANO CHEIO",
  SL: "STOP ATINGIDO", EXPIRED: "EXPIROU (60 candles)",
};

const fmtPrice = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });
const signedR = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} R`;
const fmtDay = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const fmtStamp = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

type Tone = "bull" | "bear" | "neu";
const toneOf = (s: SignalDirection): Tone => {
  const side = signalSide(s);
  return side === "buy" ? "bull" : side === "sell" ? "bear" : "neu";
};
const toneColor = (t: Tone) => (t === "bull" ? "var(--bull)" : t === "bear" ? "var(--bear)" : "var(--ink-soft)");

interface SimEvent { i: number; text: string; tone: Tone }

/** Extrai os eventos do ciclo de vida (transições entre estados da timeline). */
function buildEvents(timeline: LifecycleState[]): SimEvent[] {
  const evs: SimEvent[] = [];
  let prev: LifecycleState | null = null;
  timeline.forEach((s, i) => {
    if (s.tp1Hit && !prev?.tp1Hit) evs.push({ i, text: "TP1 atingido · 1/3 realizado · stop sobe pro 0×0 (breakeven)", tone: "bull" });
    if (s.tp2Hit && !prev?.tp2Hit) evs.push({ i, text: "TP2 atingido · 2/3 realizados · stop sobe pro TP1", tone: "bull" });
    if (s.tp3Hit && !prev?.tp3Hit) evs.push({ i, text: "TP3 atingido · posição encerrada no alvo máximo", tone: "bull" });
    if (s.status === "resolved" && prev?.status !== "resolved") {
      if (s.outcome === "SL") evs.push({ i, text: "Stop atingido · posição encerrada com prejuízo", tone: "bear" });
      else if (s.outcome === "EXPIRED") evs.push({ i, text: "Janela de 60 candles encerrada · liquidado a mercado", tone: "neu" });
      else if (s.outcome === "TP1" || s.outcome === "TP2") evs.push({ i, text: `Stop móvel acionado · desfecho ${s.outcome} garantido`, tone: "bull" });
    }
    prev = s;
  });
  return evs;
}

/**
 * Simulador — Máquina do Tempo. Escolhe ativo + timeframe + data PASSADA,
 * roda a análise real truncada naquele dia (sem lookahead) e revela o futuro
 * candle a candle até o desfecho do plano.
 */
export function SimuladorClient({ initialUsedToday, initialCredits }: { initialUsedToday: number; initialCredits: number }) {
  const [symbol, setSymbol] = useState("");
  const [tf, setTf] = useState<Timeframe | "">("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SimResponse | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [usedToday, setUsedToday] = useState(initialUsedToday);
  const [credits, setCredits] = useState(initialCredits);

  const byClass = useMemo(() => {
    const groups = new Map<string, typeof CATALOG>();
    for (const a of CATALOG) {
      const k = ASSET_CLASS_PT[a.assetType];
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    return [...groups.entries()];
  }, []);
  const maxDate = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10), []);

  const total = res?.futureCandles.length ?? 0;
  const timeline = res?.timeline ?? null;
  const state = timeline && revealed > 0 ? timeline[Math.min(revealed, timeline.length) - 1]! : null;
  const resolvedAt = useMemo(() => (timeline ? timeline.findIndex((s) => s.status === "resolved") : -1), [timeline]);
  const done = state?.status === "resolved";
  const events = useMemo(() => (timeline ? buildEvents(timeline) : []), [timeline]);
  const visibleEvents = events.filter((e) => e.i < revealed);
  const exhausted = revealed >= total || (resolvedAt >= 0 && revealed > resolvedAt);

  // ▶ reproduzir: revela 1 candle a cada 320ms até o desfecho (ou o fim).
  useEffect(() => {
    if (!playing) return;
    if (exhausted) { setPlaying(false); return; }
    const t = setTimeout(() => setRevealed((v) => Math.min(total, v + 1)), 320);
    return () => clearTimeout(t);
  }, [playing, exhausted, revealed, total]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const asset = CATALOG.find((a) => a.symbol === symbol);
    if (!asset || !tf || !date) { setError("Escolha ativo, timeframe e uma data no passado."); return; }
    setLoading(true); setError(null); setPlaying(false);
    try {
      const r = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: asset.symbol, assetType: asset.assetType, timeframe: tf, date }),
      });
      const data = (await r.json()) as SimResponse & { error?: string };
      if (!r.ok) throw new Error(data?.error ?? "Falha na simulação.");
      setRes(data);
      setRevealed(0);
      setUsedToday(data.billing.usedToday);
      setCredits(data.billing.balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na simulação.");
    } finally {
      setLoading(false);
    }
  }

  const nextIsFree = usedToday < SIMULATOR_FREE_PER_DAY;
  const simClock = res ? (revealed > 0 ? res.futureCandles[revealed - 1]!.time : res.cutoffMs - 1) : null;
  const a = res?.analysis;
  const tone = a ? toneOf(a.signal) : "neu";
  const seal = a ? (SEAL_PT[a.sealStatus] ?? SEAL_PT.grey!) : null;
  const plan = res?.plan ?? null;
  const rOf = (price: number) => (a && plan && a.distSL > 0 ? Math.abs(price - plan.entry) / a.distSL : 0);
  const maxR = plan ? Math.max(rOf(plan.takeProfit1), rOf(plan.takeProfit2), rOf(plan.takeProfit3), 1) : 1;
  const w = (r: number) => `${Math.max(6, (r / maxR) * 100)}%`;

  return (
    <div className="sim-body">
      {/* ======== AVISO GRITANTE — sempre visível ======== */}
      <div className="sim-warn" role="note">
        <span className="sim-warn-tag">⚠ SIMULAÇÃO HISTÓRICA</span>
        <p>
          <b>Isto não é o mercado de hoje.</b> Você escolhe um dia do passado e a IA analisa <b>somente os candles
          fechados até aquele dia</b> — sem lookahead, auditável por design. O “futuro” revelado já aconteceu.
          Educativo; <b>não é recomendação de investimento</b>.
        </p>
      </div>

      {/* ======== formulário ======== */}
      <Panel>
        <PanelLabel>Máquina do tempo · configurar viagem</PanelLabel>
        <form className="sim-form" onSubmit={submit}>
          <label className="sim-field">
            <span className="sim-label">Ativo</span>
            <select className="sim-input" value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Ativo">
              <option value="">Selecione…</option>
              {byClass.map(([cls, assets]) => (
                <optgroup key={cls} label={cls}>
                  {assets.map((x) => (
                    <option key={x.symbol} value={x.symbol}>{x.symbol} · {x.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="sim-label">Timeframe</span>
            <select className="sim-input" value={tf} onChange={(e) => setTf(e.target.value as Timeframe)} aria-label="Timeframe">
              <option value="">Selecione…</option>
              {TFS.map((t) => (
                <option key={t.v} value={t.v}>{t.label} · {t.reach}</option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="sim-label">Dia do passado</span>
            <input className="sim-input" type="date" value={date} min="2010-01-01" max={maxDate} onChange={(e) => setDate(e.target.value)} aria-label="Data simulada" />
          </label>
          <button type="submit" className="btn primary sim-go" disabled={loading}>
            {loading ? "Viajando…" : "▸ Viajar no tempo"}
          </button>
        </form>
        <div className="sim-quota">
          Hoje: <b>{Math.min(usedToday, SIMULATOR_FREE_PER_DAY)}/{SIMULATOR_FREE_PER_DAY}</b> simulações grátis usadas ·{" "}
          {nextIsFree
            ? <>a próxima é <b className="ok">grátis</b></>
            : <>a próxima custa <b className="am">{SIMULATOR_CREDIT_COST} crédito</b> (saldo: {credits.toLocaleString("pt-BR")})</>}
        </div>
        {error ? <p className="sim-error">{error}</p> : null}
      </Panel>

      {res && a ? (
        <>
          {/* ======== faixa de contexto da viagem ======== */}
          <div className="sim-hud">
            <span className="sim-hud-chip warn">SIMULAÇÃO · DADOS ATÉ {fmtDay(res.simDate)}</span>
            <span className="sim-hud-chip">{res.symbol} · {res.timeframe.toUpperCase()}</span>
            <span className="sim-hud-chip">RELÓGIO SIMULADO <b>{simClock != null ? fmtStamp(simClock) : "—"}</b></span>
            <span className="sim-hud-chip">{a.period ? `janela analisada ${a.period}` : `${res.pastTotal} candles fechados`}</span>
          </div>

          {/* ======== veredito "como se fosse aquele dia" ======== */}
          <Panel>
            <PanelLabel>O que a IA teria dito em {fmtDay(res.simDate)}</PanelLabel>
            <div className="sim-verdict">
              <div className="sim-vd-main">
                <div className="sim-vd-big" style={{ color: toneColor(tone), textShadow: tone === "neu" ? "none" : `0 0 34px color-mix(in srgb, ${toneColor(tone)} 36%, transparent)` } as CSSProperties}>
                  {SIGNAL_PT[a.signal]}
                </div>
                <p className="sim-vd-sub">{a.summary}</p>
                <div className="sim-vd-meta">
                  <span>Força <b>{Math.round(a.strength)}</b>/100</span>
                  <span>Confluência <b>{a.confluence}</b>/10</span>
                  <span>Votos <b className="ok">{a.votes.buy}</b>·{a.votes.neutral}·<b className="no">{a.votes.sell}</b></span>
                  {a.tp1Prob != null && a.stopProb != null ? (
                    <span>TP1 <b className="ok">{Math.round(a.tp1Prob * 100)}%</b> · stop <b className="no">{Math.round(a.stopProb * 100)}%</b></span>
                  ) : null}
                </div>
              </div>
              {seal ? (
                <div className="sim-vd-seal" style={{ ["--sc" as string]: seal.color }}>
                  <span className="led" />
                  <span className="txt">{seal.label}<small>backtest até a data · n={a.decisiveTrades}</small></span>
                </div>
              ) : null}
            </div>
            {plan ? (
              <div className="ladder" style={{ marginTop: 14 }}>
                <div className="rung tp"><span className="tag">TP3</span><div className="dist"><i style={{ width: w(rOf(plan.takeProfit3)) }} /></div><span className="px">{fmtPrice(plan.takeProfit3)}</span><span className="rr">R {rOf(plan.takeProfit3).toFixed(1)}</span></div>
                <div className="rung tp"><span className="tag">TP2</span><div className="dist"><i style={{ width: w(rOf(plan.takeProfit2)) }} /></div><span className="px">{fmtPrice(plan.takeProfit2)}</span><span className="rr">R {rOf(plan.takeProfit2).toFixed(1)}</span></div>
                <div className="rung tp"><span className="tag">TP1</span><div className="dist"><i style={{ width: w(rOf(plan.takeProfit1)) }} /></div><span className="px">{fmtPrice(plan.takeProfit1)}</span><span className="rr">R {rOf(plan.takeProfit1).toFixed(1)}</span></div>
                <div className="rung entry"><span className="tag">ENTRADA</span><div className="dist"><i style={{ width: "50%" }} /></div><span className="px">{fmtPrice(plan.entry)}</span><span className="rr">{plan.side === "buy" ? "compra" : "venda"}</span></div>
                <div className="rung sl"><span className="tag">STOP</span><div className="dist"><i style={{ width: w(1) }} /></div><span className="px">{fmtPrice(plan.stopLoss)}</span><span className="rr">R −1.0</span></div>
              </div>
            ) : (
              <p className="note" style={{ marginTop: 12 }}>
                Naquele dia o motor ficou <b>neutro</b> — sem plano operacional. Você ainda pode avançar o tempo e ver
                o que o mercado fez em seguida.
              </p>
            )}
          </Panel>

          {/* ======== gráfico + controles do tempo ======== */}
          <Panel>
            <PanelLabel>Gráfico · o futuro entra à direita conforme você avança</PanelLabel>
            <SimChart
              past={res.pastCandles}
              future={res.futureCandles}
              cutoffMs={res.cutoffMs}
              revealed={revealed}
              plan={plan}
              currentStop={state?.currentStop ?? plan?.stopLoss ?? null}
            />
            <div className="sim-controls">
              <span className="sim-step">candle <b>{revealed}</b>/{total} revelados</span>
              <div className="sim-btns">
                <button type="button" className="btn" onClick={() => setRevealed((v) => Math.min(total, v + 1))} disabled={exhausted && revealed >= total}>+1 candle</button>
                <button type="button" className="btn" onClick={() => setRevealed((v) => Math.min(total, v + 5))} disabled={revealed >= total}>+5</button>
                <button type="button" className="btn" onClick={() => setPlaying((p) => !p)} disabled={exhausted}>{playing ? "❚❚ pausar" : "▶ reproduzir"}</button>
                <button type="button" className="btn primary" onClick={() => { setPlaying(false); setRevealed(resolvedAt >= 0 ? resolvedAt + 1 : total); }} disabled={revealed >= total}>
                  ⏭ revelar desfecho
                </button>
              </div>
            </div>
            {visibleEvents.length > 0 ? (
              <div className="sim-events">
                {visibleEvents.map((ev) => (
                  <div className={`sim-ev ${ev.tone}`} key={`${ev.i}-${ev.text}`}>
                    <span className="when">+{ev.i + 1} candles · {fmtStamp(res.futureCandles[ev.i]!.time)}</span>
                    <span className="what">{ev.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          {/* ======== desfecho ======== */}
          {plan && done && state?.outcome ? (
            <Panel>
              <PanelLabel>Desfecho do plano · resolvido com o mesmo motor do track record</PanelLabel>
              <div className={`sim-outcome ${state.pnlR != null && state.pnlR > 0 ? "win" : state.pnlR != null && state.pnlR < 0 ? "loss" : "flat"}`}>
                <div className="so-big">{OUTCOME_PT[state.outcome] ?? state.outcome}</div>
                <div className="so-stats">
                  <span>Resultado <b>{state.pnlR != null ? signedR(state.pnlR) : "—"}</b></span>
                  <span>Duração <b>{state.durationCandles}</b> candles</span>
                  {state.exitPrice != null ? <span>Saída <b>{fmtPrice(state.exitPrice)}</b></span> : null}
                </div>
                <p className="note">
                  Saída escalonada real: 1/3 da posição em cada alvo, stop sobe sozinho (0×0 após TP1, TP1 após TP2) —
                  as mesmas regras do track record público. Resultado em <b>R</b> (múltiplos do risco inicial).
                </p>
              </div>
            </Panel>
          ) : plan && revealed >= total && !done ? (
            <Panel>
              <PanelLabel>Desfecho do plano</PanelLabel>
              <p className="note">
                Todos os candles disponíveis foram revelados e o plano <b>seguia aberto</b> (nenhum alvo/stop tocado e a
                janela de 60 candles ainda não fechou). Escolha uma data um pouco mais antiga para ver um desfecho completo.
              </p>
            </Panel>
          ) : null}

          <p className="sim-foot">
            🕰 Simulação histórica de {fmtDay(res.simDate)} · a análise usou <b>apenas</b> candles fechados até essa data ·
            desempenho passado não garante resultado futuro.
          </p>
        </>
      ) : null}
    </div>
  );
}
