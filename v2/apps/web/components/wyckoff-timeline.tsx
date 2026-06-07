"use client";

/**
 * Série histórica de eventos Wyckoff — uma faixa cronológica abaixo do gráfico.
 * Mostra TODOS os eventos detectados no período (não só os marcadores), com
 * tipo, lado (cor), preço e há quanto tempo. Os 3 mais recentes (que viram
 * linha/zona no gráfico) ganham destaque.
 */
import type { FullAnalysis } from "@/lib/analysis/full";
import { buildWyckoffSeries, eventForce } from "@/lib/analysis/wyckoff-series";

function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

export function WyckoffTimeline({ dto }: { dto: FullAnalysis }) {
  const series = buildWyckoffSeries(dto.wyckoffEvents, Date.now());
  if (!series.length) return null;

  const bull = series.filter((s) => s.side === "bull").length;
  const bear = series.length - bull;

  return (
    <section className="wt">
      <div className="wt-h">
        Eventos Wyckoff <span>· série histórica ({series.length})</span>
        <span className="wt-bal"><b className="bull">{bull}↑</b> · <b className="bear">{bear}↓</b></span>
      </div>
      <div className="wt-strip">
        {series.map((e) => (
          <div className={`wt-it ${e.side} ${e.recent ? "recent" : ""}`} key={`${e.time}-${e.type}`} title={`${e.type} · ${eventForce(e.type)} · ${fmtPrice(e.price)} · ${e.ago} atrás`}>
            <span className="wt-dot" />
            <span className="wt-t">{e.type}</span>
            <span className="wt-p">{fmtPrice(e.price)}</span>
            <span className="wt-a">{e.ago}</span>
          </div>
        ))}
      </div>
      <p className="note" style={{ fontSize: "0.72rem", marginTop: 6 }}>
        Heurística de varredura/força (Spring·SOS·LPS·AR = alta · UTAD·SOW·ST = baixa). Os 3 mais recentes (em destaque) também aparecem como linha/zona no gráfico.
      </p>
    </section>
  );
}
