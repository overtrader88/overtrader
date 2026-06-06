"use client";

import { useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { EquityCurve } from "@/components/ui/equity-curve";
import type { BacktestView } from "@/lib/analysis/backtest-view";
import {
  STRATEGY_OPTIONS, PERIOD_OPTIONS, RISK_PRESETS, DEFAULT_BACKTEST_PARAMS, type PeriodMonths,
} from "@/lib/analysis/backtest-params";

interface QualityBanner { status: "green" | "yellow" | "red" | "grey"; reason: string }
export interface BacktestRun {
  backtest: BacktestView;
  quality: QualityBanner;
  equityCurve: number[];
}

const SEAL: Record<string, { label: string; sub: string; color: string }> = {
  green: { label: "VALIDADO", sub: "SELO VERDE", color: "var(--bull)" },
  yellow: { label: "RESSALVA", sub: "SELO AMARELO", color: "var(--amber)" },
  red: { label: "REPROVADO", sub: "SELO VERMELHO", color: "var(--bear)" },
  grey: { label: "INSUFICIENTE", sub: "SEM SELO", color: "var(--ink-faint)" },
};

const pct = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

/**
 * Backtest sob demanda (Fase B3) — o usuário escolhe estratégia / período / R:R
 * e roda o backtest parametrizado. Recomputa o selo HONESTO para os parâmetros
 * (verde só quando o limite inferior do IC sustenta). Começa com o resultado
 * padrão da análise; re-rodar troca os números.
 */
export function BacktestLab({
  symbol, assetType, timeframe, initial,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  initial: BacktestRun;
}) {
  const [strategy, setStrategy] = useState(DEFAULT_BACKTEST_PARAMS.strategy);
  const [months, setMonths] = useState<PeriodMonths>(DEFAULT_BACKTEST_PARAMS.months);
  const [riskPresetId, setRiskPresetId] = useState(DEFAULT_BACKTEST_PARAMS.riskPresetId);
  const [run, setRun] = useState<BacktestRun>(initial);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function execute() {
    setState("loading");
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, assetType, timeframe, strategy, months, riskPresetId }),
      });
      if (!res.ok) throw new Error("falha");
      setRun((await res.json()) as BacktestRun);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const bt = run.backtest;
  const seal = SEAL[run.quality.status] ?? SEAL.grey!;
  const o = bt.outcomes;
  const total = o.TP1 + o.TP2 + o.TP3 + o.BE + o.SL + o.EXPIRED || 1;
  const seg = (n: number) => (n / total) * 100;
  const tp = seg(o.TP1 + o.TP2 + o.TP3), be = seg(o.BE), sl = seg(o.SL), exp = seg(o.EXPIRED);
  const pfMax = Math.max(3.5, bt.profitFactor.ci95[1]);

  return (
    <div className="bt-lab">
      <div className="bt-controls">
        <label><span>Estratégia</span>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
            {STRATEGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label><span>Período</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value) as PeriodMonths)}>
            {PERIOD_OPTIONS.map((m) => <option key={m} value={m}>{m} meses</option>)}
          </select>
        </label>
        <label><span>Perfil de risco</span>
          <select value={riskPresetId} onChange={(e) => setRiskPresetId(e.target.value)}>
            {RISK_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <button type="button" className="bt-run" onClick={execute} disabled={state === "loading"}>
          {state === "loading" ? "Rodando…" : state === "error" ? "Falhou — tentar de novo" : "Rodar backtest"}
        </button>
      </div>

      <div className="seal-head" style={{ marginTop: 4 }}>
        <span className="seal-led" style={{ background: seal.color, boxShadow: `0 0 0 4px color-mix(in srgb, ${seal.color} 18%, transparent), 0 0 16px ${seal.color}` }} />
        <span className="st" style={{ color: seal.color }}>{seal.label}<small>{seal.sub} · {bt.decisiveTrades} trades decisivos</small></span>
      </div>

      <div className="eq-head"><span>Curva de capital · R acumulado</span><b>{signed(run.equityCurve[run.equityCurve.length - 1] ?? 0)} R</b></div>
      <EquityCurve data={run.equityCurve} gradientId="eqlab" />

      <div className="ci-grid">
        <ConfidenceBadge label="Profit factor" value={bt.profitFactor.value} ci={bt.profitFactor.ci95} n={bt.profitFactor.n} method="bootstrap" min={0} max={pfMax} />
        <ConfidenceBadge label="Win rate" value={bt.winRate.value * 100} ci={[bt.winRate.ci95[0] * 100, bt.winRate.ci95[1] * 100]} n={bt.winRate.n} method="Wilson" min={0} max={100} format={pct} />
        <ConfidenceBadge label="R médio / trade" value={bt.avgR.value} ci={bt.avgR.ci95} n={bt.avgR.n} method="t-Student" min={-1} max={1.5} format={signed} tone={bt.avgR.value >= 0 ? "pos" : "neg"} />
      </div>

      <div className="outcomes">
        {tp > 0 ? <div className="seg tp" style={{ flex: `0 0 ${tp}%` }}>{tp >= 9 ? `TP ${Math.round(tp)}%` : ""}</div> : null}
        {be > 0 ? <div className="seg be" style={{ flex: `0 0 ${be}%` }}>{be >= 9 ? "BE" : ""}</div> : null}
        {sl > 0 ? <div className="seg sl" style={{ flex: `0 0 ${sl}%` }}>{sl >= 9 ? `SL ${Math.round(sl)}%` : ""}</div> : null}
        {exp > 0 ? <div className="seg exp" style={{ flex: `0 0 ${exp}%` }}>{exp >= 9 ? "EXP" : ""}</div> : null}
      </div>

      <p className="note">
        {bt.sampleSufficient
          ? `Walk-forward com ${bt.candlesScanned} candles varridos. O selo verde exige o LIMITE INFERIOR do IC acima do limiar — re-rode com outros parâmetros para testar a robustez.`
          : `Amostra insuficiente (${bt.decisiveTrades} trades decisivos; mínimo ${bt.minDecisiveTrades}) para estes parâmetros — sem veredito confiável.`}
      </p>
    </div>
  );
}
