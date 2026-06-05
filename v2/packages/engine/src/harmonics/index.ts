/**
 * Padrões Harmônicos (XABCD): Bat, Butterfly, Gartley, Crab, Cypher, Shark.
 * Portado do v1, com hardening:
 *   - tolerância no `EngineConfig.harmonics` (0.04, era 0.08 fixo — ±8% pegava
 *     quase tudo) → menos falsos positivos;
 *   - PRZ que NÃO converge é REJEITADA (o v1 fabricava uma PRZ artificial de 2%);
 *   - rótulo `kind: "qualitative"` + disclaimer — `quality` é match de Fibonacci,
 *     não probabilidade.
 */
import type { Candle } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../config";
import { findAlternatingSwings, type SwingPoint } from "../math/swings";

export type HarmonicName = "Bat" | "Butterfly" | "Gartley" | "Crab" | "Cypher" | "Shark";

export interface HarmonicPoint { index: number; price: number; }

export interface HarmonicPattern {
  name: HarmonicName;
  direction: "bullish" | "bearish";
  X: HarmonicPoint; A: HarmonicPoint; B: HarmonicPoint; C: HarmonicPoint;
  prz: { low: number; high: number };
  completion: number;
  /** 0-100 — qualidade do match dos ratios (NÃO é probabilidade). */
  quality: number;
  status: "active" | "completed";
}

export interface HarmonicResult {
  kind: "qualitative";
  patterns: HarmonicPattern[];
  summary: string;
  disclaimer: string;
}

interface PatternTemplate {
  name: HarmonicName;
  abXa: [number, number];
  bcAb: [number, number];
  cdBc: [number, number];
  adXa: [number, number];
}

const TEMPLATES: PatternTemplate[] = [
  { name: "Bat", abXa: [0.382, 0.5], bcAb: [0.382, 0.886], cdBc: [1.618, 2.618], adXa: [0.886, 0.886] },
  { name: "Butterfly", abXa: [0.786, 0.786], bcAb: [0.382, 0.886], cdBc: [1.618, 2.24], adXa: [1.27, 1.41] },
  { name: "Gartley", abXa: [0.618, 0.618], bcAb: [0.382, 0.886], cdBc: [1.13, 1.618], adXa: [0.786, 0.786] },
  { name: "Crab", abXa: [0.382, 0.618], bcAb: [0.382, 0.886], cdBc: [2.618, 3.618], adXa: [1.618, 1.618] },
  { name: "Cypher", abXa: [0.382, 0.618], bcAb: [1.13, 1.414], cdBc: [1.272, 2.0], adXa: [0.786, 0.786] },
  { name: "Shark", abXa: [0.382, 0.618], bcAb: [1.13, 1.618], cdBc: [1.618, 2.24], adXa: [0.886, 1.13] },
];

const QUALITATIVE = "Padrões harmônicos são discricionários (interpretação de pivots). 'quality' é o match de Fibonacci, não probabilidade de reversão.";

function rangeMatch(value: number, range: [number, number], tol: number): number {
  const [min, max] = range;
  if (value >= min * (1 - tol) && value <= max * (1 + tol)) {
    const mid = (min + max) / 2;
    const dist = Math.abs(value - mid) / Math.max(mid, 0.01);
    return Math.max(0, 100 - dist * 200);
  }
  return 0;
}

function tryMatch(X: SwingPoint, A: SwingPoint, B: SwingPoint, C: SwingPoint, cfg: EngineConfig["harmonics"]) {
  const xa = Math.abs(A.price - X.price);
  const ab = Math.abs(B.price - A.price);
  const bc = Math.abs(C.price - B.price);
  if (xa === 0 || ab === 0 || bc === 0) return [] as { template: PatternTemplate; quality: number }[];
  const abXa = ab / xa;
  const bcAb = bc / ab;
  const matches: { template: PatternTemplate; quality: number }[] = [];
  for (const tpl of TEMPLATES) {
    const q1 = rangeMatch(abXa, tpl.abXa, cfg.tolerance);
    const q2 = rangeMatch(bcAb, tpl.bcAb, cfg.tolerance);
    if (q1 > 0 && q2 > 0) matches.push({ template: tpl, quality: q1 * cfg.abWeight + q2 * (1 - cfg.abWeight) });
  }
  return matches;
}

/** Calcula a PRZ; retorna null se as faixas CD e AD NÃO convergem (padrão inválido). */
function calculatePrz(X: SwingPoint, A: SwingPoint, B: SwingPoint, C: SwingPoint, tpl: PatternTemplate):
  { prz: { low: number; high: number }; direction: "bullish" | "bearish" } | null {
  const isBearish = X.type === "low";
  const bc = Math.abs(C.price - B.price);
  const xa = Math.abs(A.price - X.price);
  const cdMin = bc * tpl.cdBc[0];
  const cdMax = bc * tpl.cdBc[1];
  const adMin = xa * tpl.adXa[0];
  const adMax = xa * tpl.adXa[1];

  let przLow: number;
  let przHigh: number;
  if (isBearish) {
    przLow = C.price + Math.min(cdMin, cdMax);
    przHigh = C.price + Math.max(cdMin, cdMax);
    const adLow = X.price + Math.min(adMin, adMax);
    const adHigh = X.price + Math.max(adMin, adMax);
    przLow = Math.max(przLow, Math.min(adLow, adHigh));
    przHigh = Math.min(przHigh, Math.max(adLow, adHigh));
  } else {
    przLow = C.price - Math.max(cdMin, cdMax);
    przHigh = C.price - Math.min(cdMin, cdMax);
    const adLow = X.price - Math.max(adMin, adMax);
    const adHigh = X.price - Math.min(adMin, adMax);
    przLow = Math.max(przLow, Math.min(adLow, adHigh));
    przHigh = Math.min(przHigh, Math.max(adLow, adHigh));
  }
  // Hardening: se CD e AD não concordam, o padrão é inválido — rejeita.
  if (przLow > przHigh) return null;
  return { prz: { low: przLow, high: przHigh }, direction: isBearish ? "bearish" : "bullish" };
}

function calculateCompletion(price: number, C: SwingPoint, prz: { low: number; high: number }, dir: "bullish" | "bearish"):
  { completion: number; status: "active" | "completed" } {
  if (price >= prz.low && price <= prz.high) return { completion: 100, status: "completed" };
  if (dir === "bearish") {
    if (price <= C.price) return { completion: 0, status: "active" };
    const total = prz.low - C.price;
    if (total <= 0) return { completion: 0, status: "active" };
    return { completion: Math.min(100, Math.round(((price - C.price) / total) * 100)), status: "active" };
  }
  if (price >= C.price) return { completion: 0, status: "active" };
  const total = C.price - prz.high;
  if (total <= 0) return { completion: 0, status: "active" };
  return { completion: Math.min(100, Math.round(((C.price - price) / total) * 100)), status: "active" };
}

export function detectHarmonics(candles: Candle[], config: EngineConfig["harmonics"] = DEFAULT_ENGINE_CONFIG.harmonics): HarmonicResult {
  if (candles.length < config.minCandles) {
    return { kind: "qualitative", patterns: [], summary: "Dados insuficientes p/ padrões harmônicos.", disclaimer: QUALITATIVE };
  }
  const swings = findAlternatingSwings(candles, config.swingLookback);
  if (swings.length < 4) {
    return { kind: "qualitative", patterns: [], summary: "Sem pivots alternados suficientes.", disclaimer: QUALITATIVE };
  }
  const price = candles[candles.length - 1]!.close;
  const patterns: HarmonicPattern[] = [];
  const maxScan = Math.min(swings.length - 3, config.maxScan);

  for (let i = swings.length - 4; i >= swings.length - 4 - maxScan && i >= 0; i--) {
    const X = swings[i]!;
    const A = swings[i + 1]!;
    const B = swings[i + 2]!;
    const C = swings[i + 3]!;
    if (X.type === A.type || A.type === B.type || B.type === C.type) continue;

    const matches = tryMatch(X, A, B, C, config);
    if (matches.length === 0) continue;
    matches.sort((a, b) => b.quality - a.quality);
    const best = matches[0]!;
    const przResult = calculatePrz(X, A, B, C, best.template);
    if (!przResult) continue; // PRZ inválida → padrão rejeitado
    const { prz, direction } = przResult;
    const { completion, status } = calculateCompletion(price, C, prz, direction);

    patterns.push({
      name: best.template.name, direction,
      X: { index: X.index, price: X.price }, A: { index: A.index, price: A.price },
      B: { index: B.index, price: B.price }, C: { index: C.index, price: C.price },
      prz, completion, quality: Math.round(best.quality), status,
    });
  }

  patterns.sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;
    return b.completion - a.completion;
  });
  const top = patterns.slice(0, config.maxPatterns);
  const summary = top.length === 0
    ? "Nenhum padrão harmônico válido nos pivots recentes."
    : `${top.length} padrão(s): ${top.map((p) => `${p.name} ${p.direction} (${p.completion}%${p.status === "completed" ? " — completo" : ""})`).join(", ")}`;

  return { kind: "qualitative", patterns: top, summary, disclaimer: QUALITATIVE };
}
