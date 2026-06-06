/**
 * Operação SIMULADA ao vivo — reflete o plano do sinal atual como uma "posição
 * aberta" e calcula P&L / R em tempo real contra o preço corrente. PURO.
 * Não persiste nada: é o setup vigente, não um histórico de trades.
 */
import type { FullAnalysis } from "./full";

export interface LiveTrade {
  side: "buy" | "sell";
  entry: number;
  stop: number;
  tp1: number;
  price: number;
  pnlPct: number;   // P&L % na direção da operação
  r: number;        // múltiplo de R já capturado
  status: "Aberta" | "Alvo 1" | "Stopada";
}

export function computeLiveTrade(dto: FullAnalysis, livePrice?: number | null): LiveTrade | null {
  const sig = dto.analysis?.signal?.signal;
  const side: "buy" | "sell" | null = sig?.includes("BUY") ? "buy" : sig?.includes("SELL") ? "sell" : null;
  if (!side) return null;
  const r = dto.analysis.risk;
  const entry = r.entry, stop = r.stopLoss, tp1 = r.takeProfit1;
  if (![entry, stop, tp1].every(Number.isFinite)) return null;

  const price = livePrice && Number.isFinite(livePrice) ? livePrice : (dto.montecarlo?.currentPrice ?? entry);
  const dir = side === "buy" ? 1 : -1;
  const pnlPct = ((price - entry) / entry) * 100 * dir;
  const risk = Math.abs(entry - stop);
  const rMult = risk > 0 ? ((price - entry) * dir) / risk : 0;

  let status: LiveTrade["status"] = "Aberta";
  if (side === "buy") { if (price <= stop) status = "Stopada"; else if (price >= tp1) status = "Alvo 1"; }
  else { if (price >= stop) status = "Stopada"; else if (price <= tp1) status = "Alvo 1"; }

  return { side, entry, stop, tp1, price, pnlPct, r: rMult, status };
}
