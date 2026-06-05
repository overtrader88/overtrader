"use client";

import { useEffect, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";

interface DefiResult {
  kind: "fundamental";
  applicability: "chain" | "protocol" | "limited" | "not_applicable";
  source: "DefiLlama";
  asOf: number;
  tvlUsd?: number;
  tvlChange30dPct?: number;
  tvlTrend?: "rising" | "stable" | "declining";
  notes: string[];
  disclaimer: string;
}

interface FmpResult {
  kind: "fmp";
  source: "FMP";
  asOf: number;
  companyName: string;
  sector?: string;
  industry?: string;
  country?: string;
  marketCapUsd?: number;
  price?: number;
  priceChangePct?: number;
  beta?: number;
  peRatioTTM?: number;
  pbRatioTTM?: number;
  evEbitdaTTM?: number;
  netMarginTTM?: number;
  grossMarginTTM?: number;
  operatingMarginTTM?: number;
  roeTTM?: number;
  roaTTM?: number;
  debtToEquityTTM?: number;
  dividendYieldTTM?: number;
  epsTTM?: number;
  fcfYieldTTM?: number;
  revenueLatest?: number;
  netIncomeLatest?: number;
  ebitdaLatest?: number;
  revenueGrowthYoY?: number;
  disclaimer: string;
}

type FundamentalResult = DefiResult | FmpResult;

type Bias = "buy" | "sell" | "neutral";
type State = "loading" | "done" | "error";

const TREND_PT: Record<string, { label: string; color: string }> = {
  rising: { label: "TVL em alta", color: "var(--bull)" },
  declining: { label: "TVL em queda", color: "var(--bear)" },
  stable: { label: "TVL estável", color: "var(--ink-faint)" },
};

/** Cruza viés técnico × tendência fundamental (espelha `fundamentalConvergence`). */
function convergence(bias: Bias | undefined, trend?: string): "converge" | "diverge" | "neutro" {
  if (!bias || bias === "neutral" || !trend || trend === "stable") return "neutro";
  if (bias === "buy") return trend === "rising" ? "converge" : "diverge";
  return trend === "declining" ? "converge" : "diverge";
}

const CONV_PT: Record<string, { label: string; color: string }> = {
  converge: { label: "Fundamento converge", color: "var(--bull)" },
  diverge: { label: "Fundamento diverge", color: "var(--bear)" },
  neutro: { label: "Fundamento neutro", color: "var(--ink-faint)" },
};

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function fmtNum(n: number, dec = 2): string { return n.toFixed(dec); }

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.18rem 0", borderBottom: "1px solid var(--border-faint, #e4e8ef)" }}>
      <span className="note" style={{ fontSize: "0.78rem" }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.82rem", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FmpCard({ d, bias }: { d: FmpResult; bias?: Bias }) {
  const growth = d.revenueGrowthYoY;
  const growthColor = growth == null ? undefined : growth > 0 ? "var(--bull)" : growth < 0 ? "var(--bear)" : undefined;
  return (
    <div className="fundamental">
      {/* Cabeçalho */}
      <div style={{ marginBottom: "0.6rem" }}>
        <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{d.companyName}</span>
        {d.sector ? <span className="note" style={{ marginLeft: "0.5rem", fontSize: "0.78rem" }}>{d.sector}{d.country ? ` · ${d.country}` : ""}</span> : null}
      </div>

      {/* Market cap + preço */}
      <div style={{ display: "flex", gap: "1.2rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
        {d.marketCapUsd != null && <span style={{ fontSize: "1.1rem", fontVariantNumeric: "tabular-nums" }}>{fmtUsd(d.marketCapUsd)} <span className="note" style={{ fontSize: "0.7rem" }}>Mkt Cap</span></span>}
        {d.price != null && (
          <span style={{ fontSize: "0.9rem", fontVariantNumeric: "tabular-nums" }}>
            ${d.price.toFixed(2)}
            {d.priceChangePct != null && (
              <span style={{ marginLeft: "0.3rem", color: d.priceChangePct >= 0 ? "var(--bull)" : "var(--bear)", fontSize: "0.8rem" }}>
                {d.priceChangePct >= 0 ? "+" : ""}{d.priceChangePct.toFixed(2)}%
              </span>
            )}
          </span>
        )}
      </div>

      {/* Valuation */}
      <div style={{ marginBottom: "0.1rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-faint)", marginTop: "0.4rem" }}>Valuation</div>
      <Row label="P/L (TTM)" value={d.peRatioTTM != null ? fmtNum(d.peRatioTTM) : null} />
      <Row label="P/VP (TTM)" value={d.pbRatioTTM != null ? fmtNum(d.pbRatioTTM) : null} />
      <Row label="EV/EBITDA (TTM)" value={d.evEbitdaTTM != null ? fmtNum(d.evEbitdaTTM) : null} />
      <Row label="EPS (TTM)" value={d.epsTTM != null ? `$${fmtNum(d.epsTTM)}` : null} />
      <Row label="Div. Yield" value={d.dividendYieldTTM != null ? fmtPct(d.dividendYieldTTM) : null} />

      {/* Rentabilidade */}
      <div style={{ marginBottom: "0.1rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-faint)", marginTop: "0.6rem" }}>Rentabilidade</div>
      <Row label="Margem Bruta" value={d.grossMarginTTM != null ? fmtPct(d.grossMarginTTM) : null} />
      <Row label="Margem Operacional" value={d.operatingMarginTTM != null ? fmtPct(d.operatingMarginTTM) : null} />
      <Row label="Margem Líquida" value={d.netMarginTTM != null ? fmtPct(d.netMarginTTM) : null} />
      <Row label="ROE (TTM)" value={d.roeTTM != null ? fmtPct(d.roeTTM) : null} />
      <Row label="ROA (TTM)" value={d.roaTTM != null ? fmtPct(d.roaTTM) : null} />
      <Row label="FCF Yield" value={d.fcfYieldTTM != null ? fmtPct(d.fcfYieldTTM) : null} />

      {/* Resultado */}
      <div style={{ marginBottom: "0.1rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-faint)", marginTop: "0.6rem" }}>Resultado (último fiscal)</div>
      <Row label="Receita" value={d.revenueLatest != null ? fmtUsd(d.revenueLatest) : null} />
      <Row label="Lucro Líquido" value={d.netIncomeLatest != null ? fmtUsd(d.netIncomeLatest) : null} />
      <Row label="EBITDA" value={d.ebitdaLatest != null ? fmtUsd(d.ebitdaLatest) : null} />
      {growth != null && (
        <Row label="Crescimento Receita YoY" value={<span style={{ color: growthColor }}>{fmtPct(growth)}</span> as unknown as string} />
      )}

      {/* Saúde */}
      <div style={{ marginBottom: "0.1rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-faint)", marginTop: "0.6rem" }}>Saúde financeira</div>
      <Row label="Dív/PL (TTM)" value={d.debtToEquityTTM != null ? fmtNum(d.debtToEquityTTM) : null} />
      <Row label="Liquidez Corrente" value={undefined} />
      {d.beta != null && <Row label="Beta" value={fmtNum(d.beta)} />}

      {/* Badge de convergência com o sinal técnico */}
      {bias && bias !== "neutral" && (
        <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--ink-faint)" }}>
          Convergência técnico-fundamentalista: não disponível (requer dados de tendência)
        </div>
      )}

      <p className="note" style={{ marginTop: "0.5rem" }}>{d.disclaimer}</p>
    </div>
  );
}

/**
 * Painel FUNDAMENTAL on-chain (DefiLlama) — TVL + tendência + badge de
 * convergência com o sinal técnico. Auto-fetch on-mount, igual ao NewsCard.
 * Observado, não probabilístico: NÃO altera o selo — é contexto complementar.
 */
export function FundamentalCard({
  symbol,
  assetType,
  timeframe,
  bias,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  bias?: Bias;
}) {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<FundamentalResult | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch("/api/fundamental", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, assetType, timeframe }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((d: { result: FundamentalResult | null }) => {
        if (alive) {
          setData(d.result);
          setState("done");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [symbol, assetType, timeframe]);

  if (state === "loading") return <p className="note">Carregando fundamentos…</p>;
  if (state === "error") return <p className="note">Não foi possível carregar fundamentos agora.</p>;
  if (!data) return <p className="note">Fundamentos indisponíveis para este ativo.</p>;

  // ── FMP (ações) ──────────────────────────────────────────────────────────
  if (data.kind === "fmp") return <FmpCard d={data} bias={bias} />;

  // ── DefiLlama (cripto) ───────────────────────────────────────────────────
  if (data.applicability === "not_applicable") {
    return <p className="note">{data.notes[0] ?? "Ativo sem fundamentos DeFi mensuráveis."} (fonte: DefiLlama)</p>;
  }

  const trend = data.tvlTrend ? TREND_PT[data.tvlTrend] : null;
  const conv = CONV_PT[convergence(bias, data.tvlTrend)] ?? CONV_PT.neutro!;
  const change = data.tvlChange30dPct;

  return (
    <div className="fundamental">
      <div className="fund-head" style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        {data.tvlUsd != null ? (
          <span style={{ fontSize: "1.4rem", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
            {fmtUsd(data.tvlUsd)} <span className="note" style={{ fontSize: "0.7rem" }}>TVL</span>
          </span>
        ) : null}
        {change != null ? (
          <span style={{ color: change > 0 ? "var(--bull)" : change < 0 ? "var(--bear)" : "var(--ink-faint)", fontVariantNumeric: "tabular-nums" }}>
            {change > 0 ? "+" : ""}
            {change}% <span className="note" style={{ fontSize: "0.7rem" }}>30d</span>
          </span>
        ) : null}
      </div>

      <div className="fund-tags" style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0", flexWrap: "wrap" }}>
        {trend ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: trend.color }} />
            {trend.label}
          </span>
        ) : null}
        {bias && bias !== "neutral" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: conv.color }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: conv.color }} />
            {conv.label}
          </span>
        ) : null}
      </div>

      {data.applicability === "limited" && data.notes[0] ? <p className="note">{data.notes[0]}</p> : null}
      <p className="note">{data.disclaimer}</p>
    </div>
  );
}
