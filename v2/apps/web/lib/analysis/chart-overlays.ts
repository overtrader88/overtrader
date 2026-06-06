/**
 * Overlays do gráfico — função PURA que mapeia a análise (níveis de risco + SMC +
 * harmônicos) numa lista curada de linhas de preço pro candlestick.
 *
 * Mostra o PLANO OPERACIONAL (entrada/stop/TPs) + contexto institucional (OB/FVG ativos)
 * + PRZ harmônica, limitado p/ não poluir. Cores em hex (canvas não lê CSS var).
 */
import { signalSide } from "@tradeai/shared";
import type { FullAnalysis } from "./full";
import { nearestLiquidity } from "./liquidity";

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

  // SMC: faixas de liquidação MAIS PRÓXIMAS (acima e abaixo do preço atual) — em
  // destaque, com a distância %. São os alvos prováveis de caça de stops.
  const nl = nearestLiquidity(dto);
  if (nl) {
    const fmtPct = (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
    if (nl.above != null) lines.push({ price: nl.above, color: C.bear, title: `Liquidez ↑ ${fmtPct(nl.abovePct!)}`, dashed: false });
    if (nl.below != null) lines.push({ price: nl.below, color: C.bull, title: `Liquidez ↓ ${fmtPct(nl.belowPct!)}`, dashed: false });
  }
  // (OB e FVG são CAIXAS preenchidas — buildChartZones — não linhas.)

  // Volume Profile: POC como linha (VAH/VAL viram a caixa "Value Area").
  if (dto.volumeProfile) {
    lines.push({ price: dto.volumeProfile.poc, color: C.amber, title: "POC", dashed: false });
  }

  // Harmônicos: PRZ do padrão mais relevante.
  if (dto.harmonics && dto.harmonics.patterns.length > 0) {
    const p = dto.harmonics.patterns[0]!;
    lines.push({ price: (p.prz.low + p.prz.high) / 2, color: C.amber, title: `PRZ ${p.name}`, dashed: true });
  }

  return lines.filter((l) => Number.isFinite(l.price));
}
