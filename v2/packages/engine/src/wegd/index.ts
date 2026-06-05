/**
 * WEGD — Wyckoff, Elliott, Gann, Dow Theory. Portado do v1, com params no
 * `EngineConfig.wegd` e rótulo honesto.
 *
 * HONESTIDADE: estas são metodologias DISCRICIONÁRIAS implementadas por
 * heurística. `confidence`/`probability` são escores heurísticos, NÃO
 * probabilidades calibradas. `kind: "qualitative"` + disclaimer deixam claro.
 */
import type { Candle } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import { findSwingPoints, type SwingPoint } from "../math/swings";

export type WyckoffPhase = "accumulation" | "markup" | "distribution" | "markdown" | "transition";
export type DowTrend = "primary_uptrend" | "primary_downtrend" | "sideways";

export interface WyckoffResult { phase: WyckoffPhase; confidence: number; description: string; }
export interface ElliottResult {
  currentWave: "wave_1" | "wave_2" | "wave_3" | "wave_4" | "wave_5" | "wave_a" | "wave_b" | "wave_c" | "indefinido";
  probability: number; type: "impulsive" | "corrective" | "unknown"; description: string;
}
export interface GannResult {
  angle1x1: number; positionVs1x1: "above" | "below" | "on";
  levels: { angle: string; price: number }[]; description: string;
}
export interface DowResult {
  primaryTrend: DowTrend; confirmed: boolean; description: string;
  higherHighs: number; higherLows: number; lowerHighs: number; lowerLows: number;
}
export interface WegdResult {
  kind: "qualitative";
  wyckoff: WyckoffResult; elliott: ElliottResult; gann: GannResult; dow: DowResult;
  summary: string; disclaimer: string;
}

type WegdConfig = EngineConfig["wegd"];
const QUALITATIVE = "Wyckoff/Elliott/Gann/Dow são leituras discricionárias por heurística (contexto qualitativo). Os percentuais são escores heurísticos, não probabilidades calibradas.";

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Conta higher-highs / higher-lows / lower-highs / lower-lows comparando swings
 * CONSECUTIVOS DO MESMO TIPO (highs com highs, lows com lows). Corrige o v1, que
 * comparava por paridade de índice e só capturava um dos tipos em séries alternadas.
 */
function countStructure(swings: SwingPoint[], window = 4): { hh: number; hl: number; lh: number; ll: number } {
  const highs = swings.filter((s) => s.type === "high").slice(-window);
  const lows = swings.filter((s) => s.type === "low").slice(-window);
  let hh = 0;
  let hl = 0;
  let lh = 0;
  let ll = 0;
  for (let i = 1; i < highs.length; i++) {
    if (highs[i]!.price > highs[i - 1]!.price) hh++;
    else lh++;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i]!.price > lows[i - 1]!.price) hl++;
    else ll++;
  }
  return { hh, hl, lh, ll };
}

function analyzeWyckoff(candles: Candle[], cfg: WegdConfig): WyckoffResult {
  if (candles.length < cfg.minCandles) return { phase: "transition", confidence: 30, description: "Dados insuficientes." };
  const last30 = candles.slice(-30);
  const last10 = candles.slice(-10);
  const closes = last30.map((c) => c.close);
  const closeAvg = mean(closes);
  const closeMin = Math.min(...closes);
  const closeMax = Math.max(...closes);
  const rangePct = closeAvg > 0 ? ((closeMax - closeMin) / closeAvg) * 100 : 0;
  const volAvg30 = mean(last30.map((c) => c.volume));
  const volAvg10 = mean(last10.map((c) => c.volume));
  const volRatio = volAvg30 > 0 ? volAvg10 / volAvg30 : 1;
  const first10 = last10[0]!.close;
  const slope = first10 > 0 ? (last10[last10.length - 1]!.close - first10) / first10 : 0;
  const posInRange = closeMax > closeMin ? ((last10[last10.length - 1]!.close - closeMin) / (closeMax - closeMin)) * 100 : 50;
  const isRanging = rangePct < cfg.wyckoffRangePct;
  const isTrending = Math.abs(slope) > cfg.wyckoffTrendSlope;

  if (isTrending && slope > 0) return { phase: "markup", confidence: Math.min(100, Math.round(50 + slope * 500)), description: `Alta consistente: +${(slope * 100).toFixed(1)}%. Volume ${volRatio > cfg.wyckoffVolRatio ? "crescente" : "normal"}.` };
  if (isTrending && slope < 0) return { phase: "markdown", confidence: Math.min(100, Math.round(50 + Math.abs(slope) * 500)), description: `Baixa consistente: ${(slope * 100).toFixed(1)}%. Volume ${volRatio > cfg.wyckoffVolRatio ? "crescente" : "normal"}.` };
  if (isRanging && volRatio > cfg.wyckoffVolRatio && posInRange < 40) return { phase: "accumulation", confidence: Math.min(100, Math.round(50 + (volRatio - 1) * 50)), description: `Consolidação no fundo com volume ${(volRatio * 100).toFixed(0)}% da média — possível acumulação.` };
  if (isRanging && volRatio > cfg.wyckoffVolRatio && posInRange > 60) return { phase: "distribution", confidence: Math.min(100, Math.round(50 + (volRatio - 1) * 50)), description: `Consolidação no topo com volume ${(volRatio * 100).toFixed(0)}% da média — possível distribuição.` };
  return { phase: "transition", confidence: 40, description: "Mercado em transição, sem fase clara." };
}

function analyzeElliott(candles: Candle[], cfg: WegdConfig): ElliottResult {
  const swings = findSwingPoints(candles, cfg.swingLookback);
  if (swings.length < 4) return { currentWave: "indefinido", probability: 0, type: "unknown", description: "Sem swings suficientes." };
  const lastSwing = swings[swings.length - 1]!;
  const { hh, hl, lh, ll } = countStructure(swings);
  const bullish = hh >= 2 && hl >= 1;
  const bearish = lh >= 2 && ll >= 1;
  if (bullish) {
    const ups = hh + hl;
    if (ups >= 4 && lastSwing.type === "high") return { currentWave: "wave_5", probability: 60, type: "impulsive", description: "Provável onda 5 — possível exaustão à frente." };
    if (ups >= 3 && lastSwing.type === "high") return { currentWave: "wave_3", probability: 65, type: "impulsive", description: "Provável onda 3 — geralmente a mais forte." };
    if (ups >= 2 && lastSwing.type === "low") return { currentWave: "wave_4", probability: 55, type: "impulsive", description: "Provável onda 4 corretiva." };
    return { currentWave: "wave_1", probability: 50, type: "impulsive", description: "Início de impulso de alta (onda 1 ou 2)." };
  }
  if (bearish) return { currentWave: "wave_c", probability: 55, type: "corrective", description: "Provável onda C corretiva de baixa." };
  return { currentWave: "indefinido", probability: 40, type: "unknown", description: "Estrutura não se encaixa claramente em Elliott." };
}

function analyzeGann(candles: Candle[], cfg: WegdConfig): GannResult {
  const empty: GannResult = { angle1x1: 0, positionVs1x1: "on", levels: [], description: "Sem projeção significativa." };
  if (candles.length < cfg.minCandles) return empty;
  const swings = findSwingPoints(candles, cfg.gannSwingLookback);
  const lows = swings.filter((s) => s.type === "low");
  const lastLow = lows[lows.length - 1];
  if (!lastLow) return empty;
  const lastPrice = candles[candles.length - 1]!.close;
  const currentIndex = candles.length - 1;
  const atrSlice = candles.slice(-cfg.gannAtrPeriod);
  const atr = mean(atrSlice.map((c) => c.high - c.low));
  if (atr <= 0) return empty;
  const dt = currentIndex - lastLow.index;
  if (dt <= 0) return empty;

  const a1x1 = lastLow.price + dt * atr;
  const pos: "above" | "below" | "on" = lastPrice > a1x1 * 1.005 ? "above" : lastPrice < a1x1 * 0.995 ? "below" : "on";
  return {
    angle1x1: a1x1, positionVs1x1: pos,
    levels: [
      { angle: "4x1 (forte alta)", price: lastLow.price + dt * atr * 4 },
      { angle: "2x1 (alta)", price: lastLow.price + dt * atr * 2 },
      { angle: "1x1 (45°, referência)", price: a1x1 },
      { angle: "1x2 (fraco)", price: lastLow.price + dt * atr * 0.5 },
      { angle: "1x4 (correção)", price: lastLow.price + dt * atr * 0.25 },
    ],
    description: pos === "above" ? `Preço ${(((lastPrice - a1x1) / a1x1) * 100).toFixed(1)}% acima do 1x1 — força.` : pos === "below" ? `Preço ${(((a1x1 - lastPrice) / a1x1) * 100).toFixed(1)}% abaixo do 1x1 — fraqueza.` : "Preço próximo do 1x1.",
  };
}

function analyzeDow(candles: Candle[], cfg: WegdConfig): DowResult {
  const swings = findSwingPoints(candles, cfg.swingLookback);
  const { hh, hl, lh, ll } = countStructure(swings);
  if (hh >= 2 && hl >= 1) {
    const confirmed = hh >= 2 && hl >= 2;
    return { primaryTrend: "primary_uptrend", confirmed, description: `${hh} HH + ${hl} HL = ${confirmed ? "alta primária CONFIRMADA" : "alta provável"}`, higherHighs: hh, higherLows: hl, lowerHighs: lh, lowerLows: ll };
  }
  if (lh >= 2 && ll >= 1) {
    const confirmed = lh >= 2 && ll >= 2;
    return { primaryTrend: "primary_downtrend", confirmed, description: `${lh} LH + ${ll} LL = ${confirmed ? "baixa primária CONFIRMADA" : "baixa provável"}`, higherHighs: hh, higherLows: hl, lowerHighs: lh, lowerLows: ll };
  }
  return { primaryTrend: "sideways", confirmed: false, description: "Sem padrão claro de HH/LL — lateral.", higherHighs: hh, higherLows: hl, lowerHighs: lh, lowerLows: ll };
}

export function analyzeWegd(candles: Candle[], config: WegdConfig = DEFAULT_ENGINE_CONFIG.wegd): WegdResult {
  const wyckoff = analyzeWyckoff(candles, config);
  const elliott = analyzeElliott(candles, config);
  const gann = analyzeGann(candles, config);
  const dow = analyzeDow(candles, config);

  const wLabel: Record<WyckoffPhase, string> = { accumulation: "Acumulação", markup: "Markup (alta)", distribution: "Distribuição", markdown: "Markdown (baixa)", transition: "Transição" };
  const dLabel: Record<DowTrend, string> = { primary_uptrend: "Alta primária", primary_downtrend: "Baixa primária", sideways: "Lateral" };
  const summary = `Wyckoff: ${wLabel[wyckoff.phase]} (${wyckoff.confidence}%) · Elliott: ${elliott.currentWave} (${elliott.probability}%) · Gann: 1x1 ${gann.positionVs1x1} · Dow: ${dLabel[dow.primaryTrend]}`;

  return { kind: "qualitative", wyckoff, elliott, gann, dow, summary, disclaimer: QUALITATIVE };
}
