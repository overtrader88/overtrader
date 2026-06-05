/**
 * Overlays do gráfico — função PURA que mapeia a análise (níveis de risco + SMC +
 * harmônicos) numa lista curada de linhas de preço pro candlestick.
 *
 * Mostra o PLANO OPERACIONAL (entrada/stop/TPs) + contexto institucional (OB/FVG ativos)
 * + PRZ harmônica, limitado p/ não poluir. Cores em hex (canvas não lê CSS var).
 */
import { signalSide } from "@tradeai/shared";
import type { FullAnalysis } from "./full";

export interface ChartLine {
  price: number;
  color: string;
  title: string;
  dashed: boolean;
}

const C = { cyan: "#54a8ff", bull: "#2bd49e", bear: "#ff6b8a", amber: "#ffb020" };

export function buildPriceLines(dto: FullAnalysis): ChartLine[] {
  const lines: ChartLine[] = [];
  const r = dto.analysis.risk;
  const side = signalSide(dto.analysis.signal.signal);

  // Plano operacional (só quando há direção).
  if (side !== "neutral") {
    lines.push({ price: r.entry, color: C.cyan, title: "Entrada", dashed: false });
    lines.push({ price: r.stopLoss, color: C.bear, title: "Stop", dashed: false });
    lines.push({ price: r.takeProfit1, color: C.bull, title: "TP1", dashed: true });
    lines.push({ price: r.takeProfit2, color: C.bull, title: "TP2", dashed: true });
    lines.push({ price: r.takeProfit3, color: C.bull, title: "TP3", dashed: true });
  }

  // SMC: order blocks ativos (até 2) + FVGs ativos (até 2) — linha no meio da zona.
  if (dto.smc) {
    for (const o of dto.smc.orderBlocks.filter((b) => !b.mitigated).slice(0, 2)) {
      lines.push({
        price: (o.zoneTop + o.zoneBottom) / 2,
        color: o.type === "bullish" ? C.bull : C.bear,
        title: o.type === "bullish" ? "OB+" : "OB−",
        dashed: true,
      });
    }
    for (const f of dto.smc.fvgs.filter((g) => g.status === "active").slice(0, 2)) {
      lines.push({ price: (f.zoneTop + f.zoneBottom) / 2, color: C.cyan, title: "FVG", dashed: true });
    }
  }

  // Harmônicos: PRZ do padrão mais relevante.
  if (dto.harmonics && dto.harmonics.patterns.length > 0) {
    const p = dto.harmonics.patterns[0]!;
    lines.push({ price: (p.prz.low + p.prz.high) / 2, color: C.amber, title: `PRZ ${p.name}`, dashed: true });
  }

  return lines.filter((l) => Number.isFinite(l.price));
}
