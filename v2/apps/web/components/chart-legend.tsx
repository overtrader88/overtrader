"use client";

/**
 * Legenda de cores das marcações do gráfico Overtrader. Explica o que cada
 * linha/caixa/marcador representa. Só faz sentido no modo Overtrader (o
 * TradingView tem a própria legenda).
 */
type Kind = "line" | "dash" | "box" | "up" | "down" | "bars" | "sq" | "ci";

interface Item { label: string; color: string; kind: Kind; }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Plano",
    items: [
      { label: "Entrada", color: "#54a8ff", kind: "line" },
      { label: "Stop", color: "#ff6b8a", kind: "line" },
      { label: "Alvos (TP1–3)", color: "#2bd49e", kind: "dash" },
    ],
  },
  {
    title: "Níveis",
    items: [
      { label: "Alvo/liquidez acima", color: "#ff6b8a", kind: "line" },
      { label: "Alvo/liquidez abaixo", color: "#2bd49e", kind: "line" },
      { label: "POC (volume)", color: "#ffb020", kind: "line" },
      { label: "Liquidez / outras", color: "#8b97ad", kind: "dash" },
      { label: "Estrutura · BOS/CHoCH", color: "#8b97ad", kind: "dash" },
      { label: "PRZ harmônica", color: "#ffb020", kind: "dash" },
    ],
  },
  {
    title: "Zonas (caixas)",
    items: [
      { label: "Order Block alta", color: "#2bd49e", kind: "box" },
      { label: "Order Block baixa", color: "#ff6b8a", kind: "box" },
      { label: "FVG (gap)", color: "#54a8ff", kind: "box" },
      { label: "Value Area", color: "#ffb020", kind: "box" },
    ],
  },
  {
    title: "Médias & Volume",
    items: [
      { label: "EMA 20", color: "#54a8ff", kind: "line" },
      { label: "EMA 50", color: "#ffb020", kind: "line" },
      { label: "EMA 200", color: "#9aa7bd", kind: "line" },
      { label: "Bollinger", color: "#54a8ff", kind: "dash" },
      { label: "Volume Profile", color: "#ffb020", kind: "bars" },
    ],
  },
  {
    title: "Eventos Wyckoff",
    items: [
      { label: "Spring (↑ varreu mínima)", color: "#2bd49e", kind: "up" },
      { label: "UTAD (↓ varreu máxima)", color: "#ff6b8a", kind: "down" },
      { label: "SOS · força (□ rompeu resist.)", color: "#2bd49e", kind: "sq" },
      { label: "SOW · fraqueza (□ perdeu sup.)", color: "#ff6b8a", kind: "sq" },
      { label: "AR · repique / ST · reteste (○)", color: "#9aa7bd", kind: "ci" },
      { label: "LPS (↑ último suporte)", color: "#2bd49e", kind: "up" },
      { label: "Evento recente · linha no preço", color: "#2bd49e", kind: "dash" },
      { label: "Cluster de eventos · zona", color: "#2bd49e", kind: "box" },
    ],
  },
];

function Swatch({ color, kind }: { color: string; kind: Kind }) {
  if (kind === "box") return <span className="cl-sw box" style={{ background: `${color}22`, borderColor: color }} />;
  if (kind === "dash") return <span className="cl-sw dash" style={{ borderTopColor: color }} />;
  if (kind === "bars") return <span className="cl-sw bars" style={{ color }}>▮▮▭</span>;
  if (kind === "up") return <span className="cl-sw mk" style={{ color }}>▲</span>;
  if (kind === "down") return <span className="cl-sw mk" style={{ color }}>▼</span>;
  if (kind === "sq") return <span className="cl-sw mk" style={{ color }}>■</span>;
  if (kind === "ci") return <span className="cl-sw mk" style={{ color }}>●</span>;
  return <span className="cl-sw line" style={{ background: color }} />;
}

export function ChartLegend() {
  return (
    <div className="cl">
      {GROUPS.map((g) => (
        <div className="cl-g" key={g.title}>
          <div className="cl-gt">{g.title}</div>
          {g.items.map((it) => (
            <div className="cl-it" key={it.label}><Swatch color={it.color} kind={it.kind} /><span>{it.label}</span></div>
          ))}
        </div>
      ))}
    </div>
  );
}
