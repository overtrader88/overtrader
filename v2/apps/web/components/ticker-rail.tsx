"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/market/catalog";

const CLS_PT: Record<string, string> = {
  crypto: "Cripto",
  forex: "Forex",
  commodities: "Commodities",
  indices: "Índices",
  stocks: "Ações",
};

function shortSym(symbol: string, assetType?: string): string {
  if (assetType === "crypto") return symbol.replace(/USDT$/, "").replace(/USD$/, "");
  if (assetType === "forex" && symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}
function fmtPrice(p: number): string {
  return p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 0 : p >= 1 ? 2 : 4 });
}

/** Trilho de cotações multi-mercado, alimentado por /api/quotes (refresh 60s). */
export function TickerRail() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/quotes")
        .then((r) => r.json())
        .then((d: { quotes?: Quote[] }) => {
          if (alive) setQuotes(d.quotes ?? []);
        })
        .catch(() => {
          if (alive) setErr(true);
        });
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (err) {
    return (
      <div className="tickers">
        <div className="tk"><div className="cls">—</div><div className="sym">Cotações indisponíveis</div></div>
      </div>
    );
  }
  if (!quotes) {
    return (
      <div className="tickers">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="tk" key={`sk-${i}`}>
            <div className="cls">·</div>
            <div className="sym">—</div>
            <div className="px" style={{ fontSize: 12, color: "var(--ink-faint)" }}>carregando…</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="tickers">
      {quotes.map((q) => {
        const up = (q.changePct ?? 0) >= 0;
        return (
          <div className="tk" key={q.symbol}>
            <div className="cls">{q.assetType ? CLS_PT[q.assetType] ?? q.assetType : "—"}</div>
            <div className="sym">{shortSym(q.symbol, q.assetType)}</div>
            {q.price != null ? (
              <>
                <div className="px">{fmtPrice(q.price)}</div>
                <div className={`chg ${up ? "up" : "dn"}`}>{up ? "▲" : "▼"} {Math.abs(q.changePct ?? 0).toFixed(2)}%</div>
              </>
            ) : (
              <div className="px" style={{ fontSize: 12, color: "var(--ink-faint)" }}>indisp.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
