"use client";

import { useEffect, useState } from "react";

/**
 * Derivativos cripto AO VIVO — busca direto da Binance Futures NO NAVEGADOR do
 * usuário (rede residencial alcança a API; o servidor da Vercel é bloqueado por
 * IP de datacenter). Público, sem key. Falha → não renderiza nada (honesto).
 */
const FAPI = "https://fapi.binance.com";

interface Deriv {
  fundingRate: number;
  fundingAnnualizedPct: number;
  oiChangePct: number | null;
  longShortRatio: number | null;
  longPct: number | null;
}

function toPerp(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.endsWith("USDT") ? s : null;
}
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function DerivativesLive({ symbol }: { symbol: string }) {
  const [d, setD] = useState<Deriv | null>(null);
  const [state, setState] = useState<"load" | "ok" | "off">("load");

  useEffect(() => {
    const sym = toPerp(symbol);
    if (!sym) { setState("off"); return; }
    let alive = true;
    (async () => {
      try {
        const [prem, oiHist, ls] = await Promise.all([
          fetch(`${FAPI}/fapi/v1/premiumIndex?symbol=${sym}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${FAPI}/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=2`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
          fetch(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=1`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        const fundingRate = num(prem?.lastFundingRate);
        if (fundingRate == null) throw new Error("no funding");
        let oiChangePct: number | null = null;
        if (Array.isArray(oiHist) && oiHist.length >= 2) {
          const prev = num(oiHist[0]?.sumOpenInterest), last = num(oiHist[oiHist.length - 1]?.sumOpenInterest);
          if (prev != null && last != null && prev > 0) oiChangePct = ((last - prev) / prev) * 100;
        }
        let longShortRatio: number | null = null, longPct: number | null = null;
        if (Array.isArray(ls) && ls.length > 0) {
          longShortRatio = num(ls[0]?.longShortRatio);
          const la = num(ls[0]?.longAccount);
          if (la != null) longPct = la * 100;
        }
        if (!alive) return;
        setD({ fundingRate, fundingAnnualizedPct: fundingRate * 3 * 365 * 100, oiChangePct, longShortRatio, longPct });
        setState("ok");
      } catch {
        if (alive) setState("off");
      }
    })();
    return () => { alive = false; };
  }, [symbol]);

  if (state === "off") return null;
  if (state === "load" || !d) {
    return (
      <div className="cls-deriv">
        <div className="cd-h">Derivativos · Binance Futures <span>ao vivo</span></div>
        <p className="note" style={{ margin: 0 }}>Carregando funding, OI e long/short…</p>
      </div>
    );
  }
  return (
    <div className="cls-deriv">
      <div className="cd-h">Derivativos · Binance Futures <span>ao vivo · seu navegador</span></div>
      <div className="cd-grid">
        <div className="cd-cell">
          <div className="k">Funding (8h)</div>
          <div className={`v ${d.fundingRate >= 0 ? "bull" : "bear"}`}>{(d.fundingRate * 100).toFixed(4)}%</div>
          <div className="s">{d.fundingAnnualizedPct >= 0 ? "+" : ""}{d.fundingAnnualizedPct.toFixed(0)}% a.a.</div>
        </div>
        {d.oiChangePct != null && (
          <div className="cd-cell">
            <div className="k">Open Interest (1h)</div>
            <div className={`v ${d.oiChangePct >= 0 ? "bull" : "bear"}`}>{d.oiChangePct >= 0 ? "+" : ""}{d.oiChangePct.toFixed(2)}%</div>
            <div className="s">{d.oiChangePct >= 0 ? "expansão" : "redução"} de contratos</div>
          </div>
        )}
        {d.longShortRatio != null && (
          <div className="cd-cell">
            <div className="k">Contas long/short</div>
            <div className="v">{d.longShortRatio.toFixed(2)}</div>
            <div className="s">{d.longPct != null ? `${d.longPct.toFixed(0)}% compradas` : ""}</div>
          </div>
        )}
      </div>
      <p className="note" style={{ margin: "6px 0 0" }}>
        Funding/contas <b>muito esticados</b> num lado sinalizam <b>exaustão</b> (leitura contrária); OI subindo confirma
        convicção. Sentimento, não gatilho isolado. <b>Ao vivo</b> da Binance.
      </p>
    </div>
  );
}
