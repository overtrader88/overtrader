"use client";

import { fmtIndicatorValue } from "@/lib/analysis/format-indicator";

type Vote = "BUY" | "SELL" | "NEUTRAL";
interface Indicator { name: string; category: string; value: number | Record<string, number> | null; vote: Vote; note?: string; }

const VOTE_PT: Record<Vote, { label: string; cls: string }> = {
  BUY: { label: "Compra", cls: "buy" },
  SELL: { label: "Venda", cls: "sell" },
  NEUTRAL: { label: "Neutro", cls: "neu" },
};
const CAT_ORDER = ["Médias Móveis", "Osciladores", "Tendência", "Volatilidade", "Volume"];

/** Resumo técnico: o veredito agregado dos N indicadores do motor + a lista
 *  detalhada por categoria (cada um com valor + voto). Tudo medido, grounded. */
export function TechnicalSummary({ indicators, votes }: {
  indicators: Indicator[];
  votes: { buy: number; sell: number; neutral: number };
}) {
  const total = votes.buy + votes.sell + votes.neutral || 1;
  const score = (votes.buy - votes.sell) / total;
  const verdict =
    score >= 0.4 ? { t: "COMPRA FORTE", c: "var(--bull)" } :
    score >= 0.12 ? { t: "COMPRA", c: "var(--bull)" } :
    score <= -0.4 ? { t: "VENDA FORTE", c: "var(--bear)" } :
    score <= -0.12 ? { t: "VENDA", c: "var(--bear)" } :
    { t: "NEUTRO", c: "var(--ink-soft)" };

  const byCat = CAT_ORDER
    .map((cat) => ({ cat, items: indicators.filter((i) => i.category === cat) }))
    .filter((g) => g.items.length > 0);
  // categorias fora da ordem conhecida
  const known = new Set(CAT_ORDER);
  const extra = indicators.filter((i) => !known.has(i.category));
  if (extra.length) byCat.push({ cat: "Outros", items: extra });

  const pct = (n: number) => `${(n / total) * 100}%`;

  return (
    <div className="ts">
      <div className="ts-head">
        <div className="ts-verdict" style={{ color: verdict.c }}>{verdict.t}</div>
        <div className="ts-bar">
          <span className="buy" style={{ width: pct(votes.buy) }} />
          <span className="neu" style={{ width: pct(votes.neutral) }} />
          <span className="sell" style={{ width: pct(votes.sell) }} />
        </div>
        <div className="ts-counts">
          <span className="buy">{votes.buy} compra</span>
          <span className="neu">{votes.neutral} neutro</span>
          <span className="sell">{votes.sell} venda</span>
        </div>
      </div>

      <div className="ts-cats">
        {byCat.map((g) => (
          <div className="ts-cat" key={g.cat}>
            <div className="ts-cat-h">{g.cat}</div>
            {g.items.map((ind) => {
              const v = VOTE_PT[ind.vote];
              return (
                <div className="ts-row" key={ind.name}>
                  <span className="ts-name">{ind.name}</span>
                  <span className="ts-val">{fmtIndicatorValue(ind.value)}</span>
                  <span className={`ts-vote ${v.cls}`}>{v.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
