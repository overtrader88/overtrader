/**
 * Padroes Harmonicos (XABCD) — Bat, Butterfly, Gartley, Crab, Cypher, Shark.
 *
 * Algoritmo:
 *   1. Detecta swing points alternados (high → low → high → low...)
 *   2. Para cada janela de 4 swings consecutivos (X-A-B-C, sem D ainda),
 *      verifica se os ratios entre os legs batem com algum template
 *   3. Calcula D projetado (PRZ) e completion % com base no preco atual
 *   4. Retorna ate 5 padroes com melhor qualidade
 *
 * Templates Fibonacci (cada padrao tem 3-4 ratios validados):
 *   - Bat       : AB=0.382-0.5 XA  | BC=0.382-0.886 AB | CD=1.618-2.618 BC | AD=0.886 XA
 *   - Butterfly : AB=0.786 XA       | BC=0.382-0.886 AB | CD=1.618-2.24 BC  | AD=1.27 XA
 *   - Gartley   : AB=0.618 XA       | BC=0.382-0.886 AB | CD=1.13-1.618 BC  | AD=0.786 XA
 *   - Crab      : AB=0.382-0.618 XA | BC=0.382-0.886 AB | CD=2.618-3.618 BC | AD=1.618 XA
 *   - Cypher    : AB=0.382-0.618 XA | BC=1.13-1.414 AB  | CD=0.786 XC       | AD variable
 *   - Shark     : AB=0.382-0.618 XA | BC=1.13-1.618 AB  | CD=1.618-2.24 BC  | AD=0.886-1.13 XC
 *
 * Direcao bullish: X high, A low, B high, C low, D low (PRZ esperado abaixo)
 * Direcao bearish: X low, A high, B low, C high, D high (PRZ esperado acima)
 */
import type { Candle } from "@/lib/market/types";

// ============================================================
// TYPES
// ============================================================

export type HarmonicName =
  | "Bat"
  | "Butterfly"
  | "Gartley"
  | "Crab"
  | "Cypher"
  | "Shark";

export interface HarmonicPoint {
  index: number;
  price: number;
}

export interface HarmonicPattern {
  name: HarmonicName;
  /** Direcao do padrao — bullish forma fundo em D, bearish forma topo em D */
  direction: "bullish" | "bearish";
  X: HarmonicPoint;
  A: HarmonicPoint;
  B: HarmonicPoint;
  C: HarmonicPoint;
  /** PRZ — zona de reversao esperada onde D deve completar */
  prz: { low: number; high: number };
  /** 0-100% — quao perto o preco atual esta da zona D */
  completion: number;
  /** 0-100% — qualidade do match dos ratios (quanto mais perto do ideal, maior) */
  quality: number;
  /** "active" = ainda nao completou em D, "completed" = preco ja entrou na PRZ */
  status: "active" | "completed";
}

export interface HarmonicResult {
  patterns: HarmonicPattern[];
  summary: string;
}

// ============================================================
// TEMPLATES DOS PADROES
// ============================================================

interface PatternTemplate {
  name: HarmonicName;
  /** Range [min, max] do ratio AB/XA */
  abXa: [number, number];
  /** Range [min, max] do ratio BC/AB */
  bcAb: [number, number];
  /** Range [min, max] do ratio CD/BC (usado pra projetar D) */
  cdBc: [number, number];
  /** Range [min, max] do ratio AD/XA (validacao final em D) */
  adXa: [number, number];
}

const TEMPLATES: PatternTemplate[] = [
  {
    name: "Bat",
    abXa: [0.382, 0.5],
    bcAb: [0.382, 0.886],
    cdBc: [1.618, 2.618],
    adXa: [0.886, 0.886],
  },
  {
    name: "Butterfly",
    abXa: [0.786, 0.786],
    bcAb: [0.382, 0.886],
    cdBc: [1.618, 2.24],
    adXa: [1.27, 1.41],
  },
  {
    name: "Gartley",
    abXa: [0.618, 0.618],
    bcAb: [0.382, 0.886],
    cdBc: [1.13, 1.618],
    adXa: [0.786, 0.786],
  },
  {
    name: "Crab",
    abXa: [0.382, 0.618],
    bcAb: [0.382, 0.886],
    cdBc: [2.618, 3.618],
    adXa: [1.618, 1.618],
  },
  {
    name: "Cypher",
    abXa: [0.382, 0.618],
    bcAb: [1.13, 1.414],
    cdBc: [1.272, 2.0],
    adXa: [0.786, 0.786],
  },
  {
    name: "Shark",
    abXa: [0.382, 0.618],
    bcAb: [1.13, 1.618],
    cdBc: [1.618, 2.24],
    adXa: [0.886, 1.13],
  },
];

const TOLERANCE = 0.08; // 8% de tolerancia nos ratios

// ============================================================
// SWING POINT DETECTION (alternado)
// ============================================================

interface Swing {
  index: number;
  price: number;
  type: "high" | "low";
}

/**
 * Detecta swings alternados (high-low-high-low...) usando pivots locais
 * com lookback de 3 candles.
 */
function findAlternatingSwings(candles: Candle[], lookback = 3): Swing[] {
  if (candles.length < lookback * 2 + 1) return [];

  const raw: Swing[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high)
        isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low)
        isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) raw.push({ index: i, price: c.high, type: "high" });
    else if (isLow) raw.push({ index: i, price: c.low, type: "low" });
  }

  // Filtra pra ter alternancia rigida
  const alternated: Swing[] = [];
  for (const s of raw) {
    if (alternated.length === 0 || alternated[alternated.length - 1].type !== s.type) {
      alternated.push(s);
    } else {
      // Mesmo tipo — mantem o mais extremo
      const prev = alternated[alternated.length - 1];
      if (s.type === "high" && s.price > prev.price) alternated[alternated.length - 1] = s;
      if (s.type === "low" && s.price < prev.price) alternated[alternated.length - 1] = s;
    }
  }
  return alternated;
}

// ============================================================
// MATCH DE TEMPLATES
// ============================================================

function rangeMatch(value: number, range: [number, number], tol = TOLERANCE): number {
  const [min, max] = range;
  const minTol = min * (1 - tol);
  const maxTol = max * (1 + tol);
  if (value >= minTol && value <= maxTol) {
    // Quao perto do meio do range = melhor qualidade
    const mid = (min + max) / 2;
    const dist = Math.abs(value - mid) / Math.max(mid, 0.01);
    return Math.max(0, 100 - dist * 200); // 100 quando exatamente no meio
  }
  return 0;
}

function tryMatch(
  X: Swing,
  A: Swing,
  B: Swing,
  C: Swing
): { template: PatternTemplate; quality: number }[] {
  const xa = Math.abs(A.price - X.price);
  const ab = Math.abs(B.price - A.price);
  const bc = Math.abs(C.price - B.price);

  if (xa === 0 || ab === 0 || bc === 0) return [];

  const abXa = ab / xa;
  const bcAb = bc / ab;

  const matches: { template: PatternTemplate; quality: number }[] = [];
  for (const tpl of TEMPLATES) {
    const q1 = rangeMatch(abXa, tpl.abXa);
    const q2 = rangeMatch(bcAb, tpl.bcAb);
    if (q1 > 0 && q2 > 0) {
      // Qualidade media ponderada (AB tem peso maior que BC)
      matches.push({ template: tpl, quality: q1 * 0.6 + q2 * 0.4 });
    }
  }
  return matches;
}

/**
 * Calcula a PRZ (Potential Reversal Zone) com base no template e nos pontos X,A,B,C.
 *
 * Direcao:
 *   Bullish — X eh high, A low, B high, C low → D esperado abaixo de C (fundo)
 *   Bearish — X eh low, A high, B low, C high → D esperado acima de C (topo)
 */
function calculatePrz(
  X: Swing,
  A: Swing,
  B: Swing,
  C: Swing,
  tpl: PatternTemplate
): {
  prz: { low: number; high: number };
  direction: "bullish" | "bearish";
} {
  const isBearish = X.type === "low"; // bearish completa em high em D
  const bc = Math.abs(C.price - B.price);
  const xa = Math.abs(A.price - X.price);

  // D projetado via CD = CD/BC * BC (a partir de C)
  const cdMin = bc * tpl.cdBc[0];
  const cdMax = bc * tpl.cdBc[1];

  // D projetado via AD = AD/XA * XA (a partir de X)
  // (usado como validacao do nivel — quem manda na PRZ e o CD)
  const adMin = xa * tpl.adXa[0];
  const adMax = xa * tpl.adXa[1];

  let przLow: number;
  let przHigh: number;

  if (isBearish) {
    // D acima de C — projetamos PARA CIMA do C
    przLow = C.price + Math.min(cdMin, cdMax);
    przHigh = C.price + Math.max(cdMin, cdMax);
    // Cruza com a faixa AD a partir de X
    const adZoneLow = X.price + Math.min(adMin, adMax);
    const adZoneHigh = X.price + Math.max(adMin, adMax);
    przLow = Math.max(przLow, Math.min(adZoneLow, adZoneHigh));
    przHigh = Math.min(przHigh, Math.max(adZoneLow, adZoneHigh));
  } else {
    // D abaixo de C — projetamos PARA BAIXO do C
    przLow = C.price - Math.max(cdMin, cdMax);
    przHigh = C.price - Math.min(cdMin, cdMax);
    const adZoneLow = X.price - Math.max(adMin, adMax);
    const adZoneHigh = X.price - Math.min(adMin, adMax);
    przLow = Math.max(przLow, Math.min(adZoneLow, adZoneHigh));
    przHigh = Math.min(przHigh, Math.max(adZoneLow, adZoneHigh));
  }

  // Se as faixas nao se cruzam (PRZ invalida), retorna PRZ pequena
  if (przLow > przHigh) {
    const mid = (przLow + przHigh) / 2;
    przLow = mid * 0.99;
    przHigh = mid * 1.01;
  }

  return {
    prz: { low: przLow, high: przHigh },
    direction: isBearish ? "bearish" : "bullish",
  };
}

/**
 * Completion % — quao perto o preco atual esta de entrar na PRZ.
 * 0% = ainda longe de D
 * 100% = preco ja dentro da PRZ (padrao completou)
 */
function calculateCompletion(
  currentPrice: number,
  C: Swing,
  prz: { low: number; high: number },
  direction: "bullish" | "bearish"
): { completion: number; status: "active" | "completed" } {
  // Se preco ja entrou na PRZ
  if (currentPrice >= prz.low && currentPrice <= prz.high) {
    return { completion: 100, status: "completed" };
  }

  if (direction === "bearish") {
    // Preco precisa subir ate prz.low pra completar
    if (currentPrice <= C.price) return { completion: 0, status: "active" };
    const totalDist = prz.low - C.price;
    const traveled = currentPrice - C.price;
    if (totalDist <= 0) return { completion: 0, status: "active" };
    return {
      completion: Math.min(100, Math.round((traveled / totalDist) * 100)),
      status: "active",
    };
  } else {
    // Bullish — preco precisa descer ate prz.high
    if (currentPrice >= C.price) return { completion: 0, status: "active" };
    const totalDist = C.price - prz.high;
    const traveled = C.price - currentPrice;
    if (totalDist <= 0) return { completion: 0, status: "active" };
    return {
      completion: Math.min(100, Math.round((traveled / totalDist) * 100)),
      status: "active",
    };
  }
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export function detectHarmonics(candles: Candle[]): HarmonicResult {
  if (candles.length < 60) {
    return { patterns: [], summary: "Dados insuficientes pra padroes harmonicos." };
  }

  const swings = findAlternatingSwings(candles, 3);
  if (swings.length < 4) {
    return { patterns: [], summary: "Sem pivots alternados suficientes." };
  }

  const currentPrice = candles[candles.length - 1].close;
  const patterns: HarmonicPattern[] = [];

  // Verifica os ultimos 6 grupos de 4 swings (X-A-B-C)
  const maxScan = Math.min(swings.length - 3, 12);
  for (let i = swings.length - 4; i >= swings.length - 4 - maxScan && i >= 0; i--) {
    const X = swings[i];
    const A = swings[i + 1];
    const B = swings[i + 2];
    const C = swings[i + 3];

    // Verifica alternancia de tipos
    if (X.type === A.type || A.type === B.type || B.type === C.type) continue;

    const matches = tryMatch(X, A, B, C);
    if (matches.length === 0) continue;

    // Pega o melhor match
    matches.sort((a, b) => b.quality - a.quality);
    const best = matches[0];

    const { prz, direction } = calculatePrz(X, A, B, C, best.template);
    const { completion, status } = calculateCompletion(
      currentPrice,
      C,
      prz,
      direction
    );

    patterns.push({
      name: best.template.name,
      direction,
      X: { index: X.index, price: X.price },
      A: { index: A.index, price: A.price },
      B: { index: B.index, price: B.price },
      C: { index: C.index, price: C.price },
      prz,
      completion,
      quality: Math.round(best.quality),
      status,
    });
  }

  // Ordena: completos primeiro (mais relevantes), depois ativos com maior completion
  patterns.sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;
    return b.completion - a.completion;
  });

  const top = patterns.slice(0, 5);

  const summary =
    top.length === 0
      ? "Nenhum padrao harmonico identificado nos pivots recentes."
      : `${top.length} padrao(s) detectado(s): ${top
          .map(
            (p) =>
              `${p.name} ${p.direction} (${p.completion}%${p.status === "completed" ? " — completo" : ""})`
          )
          .join(", ")}`;

  return { patterns: top, summary };
}
