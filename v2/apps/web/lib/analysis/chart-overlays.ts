/**
 * Overlays do gráfico — função PURA que mapeia a análise (níveis de risco + SMC +
 * harmônicos) numa lista curada de linhas de preço pro candlestick.
 *
 * Mostra o PLANO OPERACIONAL (entrada/stop/TPs) + contexto institucional (OB/FVG ativos)
 * + PRZ harmônica, limitado p/ não poluir. Cores em hex (canvas não lê CSS var).
 */
import { signalSide } from "@tradeai/shared";
import type { FullAnalysis } from "./full";
import type { ChartZone } from "@/lib/charts/zone-primitive";
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
    if (nl.above != null) lines.push({ price: nl.above, color: C.bear, title: `↑ ${nl.aboveLabel} ${fmtPct(nl.abovePct!)}`, dashed: false });
    if (nl.below != null) lines.push({ price: nl.below, color: C.bull, title: `↓ ${nl.belowLabel} ${fmtPct(nl.belowPct!)}`, dashed: false });
  }
  // (OB e FVG são CAIXAS preenchidas — buildChartZones — não linhas.)

  // SMC: TODAS as outras zonas de liquidez (densidade) + estrutura (swings + BOS/CHoCH).
  if (dto.smc) {
    for (const lz of dto.smc.liquidityZones ?? []) {
      if (nl && (lz.level === nl.above || lz.level === nl.below)) continue; // já destacadas acima
      const above = lz.type === "buy_stops_above";
      lines.push({ price: lz.level, color: above ? "rgba(255,107,138,0.55)" : "rgba(43,212,158,0.55)", title: lz.swept ? "Liq ✓" : "Liq", dashed: true });
    }
    const ms = dto.smc.marketStructure ?? "consolidating";
    const tag = ms.includes("choch") ? "CHoCH" : ms.includes("bos") ? "BOS" : "";
    const bull = ms.startsWith("bullish");
    if (dto.smc.lastSwingHigh) lines.push({ price: dto.smc.lastSwingHigh.price, color: "#8b97ad", title: bull && tag ? `${tag} ↑ (máx)` : "Máx. estrutura", dashed: true });
    if (dto.smc.lastSwingLow) lines.push({ price: dto.smc.lastSwingLow.price, color: "#8b97ad", title: !bull && tag ? `${tag} ↓ (mín)` : "Mín. estrutura", dashed: true });
  }

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

export interface WyckoffOverlays {
  lines: ChartLine[];
  zones: ChartZone[];
}

/**
 * Híbrido aprovado: além dos MARCADORES na vela, desenha os eventos Wyckoff
 * RECENTES (até os 3 últimos) como referência de PREÇO. Eventos do mesmo lado e
 * próximos (≤0,6%) viram UMA zona (demanda/oferta); isolados viram linha.
 * Mantém o gráfico limpo — só o que ainda é relevante.
 */
export function buildWyckoffOverlays(dto: FullAnalysis): WyckoffOverlays {
  const lines: ChartLine[] = [];
  const zones: ChartZone[] = [];
  const evs = (dto.wyckoffEvents ?? []).filter((e) => Number.isFinite(e.price)).slice(-3);
  if (!evs.length) return { lines, zones };

  const used = new Array(evs.length).fill(false);
  for (let i = 0; i < evs.length; i++) {
    if (used[i]) continue;
    const base = evs[i]!;
    const group = [base];
    used[i] = true;
    for (let j = i + 1; j < evs.length; j++) {
      const e = evs[j]!;
      if (!used[j] && e.side === base.side && Math.abs(e.price - base.price) / base.price <= 0.006) {
        group.push(e); used[j] = true;
      }
    }
    const bull = base.side === "bull";
    const col = bull ? C.bull : C.bear;
    if (group.length >= 2) {
      const prices = group.map((e) => e.price);
      const types = [...new Set(group.map((e) => e.type))].join("/");
      zones.push({
        top: Math.max(...prices), bottom: Math.min(...prices),
        from: Math.min(...group.map((e) => e.time)) / 1000,
        fill: bull ? "rgba(43,212,158,0.12)" : "rgba(255,107,138,0.12)",
        border: bull ? "rgba(43,212,158,0.7)" : "rgba(255,107,138,0.7)",
        label: `${types} · ${bull ? "demanda" : "oferta"}`,
      });
    } else {
      lines.push({ price: base.price, color: col, title: base.type, dashed: true });
    }
  }
  return { lines, zones };
}
