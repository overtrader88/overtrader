/**
 * WEGD — Wyckoff, Elliott, Gann, Dow Theory.
 *
 * 4 metodologias classicas de analise institucional/discricionaria,
 * implementadas algoritmicamente com PROBABILIDADE (nao afirmativo).
 *
 * Diferencial vs Vortex: nos mostramos "75% provavel onda 3" em vez de
 * "esta na onda 3" — mais honesto e auditavel.
 *
 *   - Wyckoff   : fase de mercado (Accumulation / Markup / Distribution / Markdown)
 *                 via Volume Spread Analysis (VSA) simplificada
 *   - Elliott   : zigzag + heuristica de ondas impulsivas (1-2-3-4-5) e corretivas (A-B-C)
 *   - Gann      : angulos 1x1 / 2x1 / 1x2 a partir do ultimo swing significativo
 *   - Dow Theory: tendencia primaria via higher highs/lows + confirmacao volume
 */
import type { Candle } from "@/lib/market/types";

// ============================================================
// TYPES
// ============================================================

export type WyckoffPhase =
  | "accumulation" // mercado em consolidacao com volume alto (institucionais comprando)
  | "markup" //  alta consistente apos accumulation
  | "distribution" //  consolidacao no topo (institucionais vendendo)
  | "markdown" //  baixa consistente apos distribution
  | "transition"; //  zona ambigua

export type DowTrend = "primary_uptrend" | "primary_downtrend" | "sideways";

export interface WyckoffResult {
  phase: WyckoffPhase;
  /** 0-100 — confianca na identificacao da fase */
  confidence: number;
  /** Texto curto explicativo */
  description: string;
}

export interface ElliottResult {
  /** Onda atual provavel */
  currentWave:
    | "wave_1"
    | "wave_2"
    | "wave_3"
    | "wave_4"
    | "wave_5"
    | "wave_a"
    | "wave_b"
    | "wave_c"
    | "indefinido";
  /** 0-100 — probabilidade dessa identificacao */
  probability: number;
  /** Tipo: impulsivo (1-5) ou corretivo (A-B-C) */
  type: "impulsive" | "corrective" | "unknown";
  description: string;
}

export interface GannResult {
  /** Angulo 1x1 (referencia principal) */
  angle1x1: number;
  /** Nivel atual em relacao ao angulo 1x1: above = forca, below = fraqueza */
  positionVs1x1: "above" | "below" | "on";
  /** Niveis projetados nos angulos principais (a partir do ultimo swing) */
  levels: {
    angle: string;
    price: number;
  }[];
  description: string;
}

export interface DowResult {
  primaryTrend: DowTrend;
  confirmed: boolean;
  description: string;
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
}

export interface WegdResult {
  wyckoff: WyckoffResult;
  elliott: ElliottResult;
  gann: GannResult;
  dow: DowResult;
  /** Resumo unificado pra UI e LLM */
  summary: string;
}

// ============================================================
// HELPERS
// ============================================================

function sma(arr: number[], period: number): number {
  const slice = arr.slice(-period);
  if (slice.length === 0) return 0;
  return slice.reduce((s, x) => s + x, 0) / slice.length;
}

function findSwings(candles: Candle[], lookback = 3): Array<{ index: number; price: number; type: "high" | "low" }> {
  const swings: Array<{ index: number; price: number; type: "high" | "low" }> = [];
  if (candles.length < lookback * 2 + 1) return swings;
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) swings.push({ index: i, price: c.high, type: "high" });
    else if (isLow) swings.push({ index: i, price: c.low, type: "low" });
  }
  return swings;
}

// ============================================================
// WYCKOFF
// ============================================================

/**
 * Identifica a fase de Wyckoff via VSA simplificado:
 *   - Accumulation: range estreito + volume acima da media (consolidacao com interesse)
 *   - Markup: candles ascendentes com volume crescente
 *   - Distribution: range estreito no topo + volume alto
 *   - Markdown: candles descendentes
 *   - Transition: ambiguo
 */
function analyzeWyckoff(candles: Candle[]): WyckoffResult {
  if (candles.length < 50) {
    return {
      phase: "transition",
      confidence: 30,
      description: "Dados insuficientes.",
    };
  }

  const last30 = candles.slice(-30);
  const last10 = candles.slice(-10);
  const closes = last30.map((c) => c.close);
  const volumes = last30.map((c) => c.volume ?? 0);

  const closeAvg = closes.reduce((s, x) => s + x, 0) / closes.length;
  const closeMin = Math.min(...closes);
  const closeMax = Math.max(...closes);
  const rangePct = ((closeMax - closeMin) / closeAvg) * 100;

  const volAvg30 = sma(volumes, 30);
  const volAvg10 = volumes.slice(-10).reduce((s, x) => s + x, 0) / 10;
  const volRatio = volAvg30 > 0 ? volAvg10 / volAvg30 : 1;

  // Slope dos ultimos 10 closes (positivo = subindo)
  const slope =
    (last10[last10.length - 1].close - last10[0].close) / last10[0].close;

  // Posicao do preco no range (0 = no fundo, 100 = no topo)
  const positionInRange =
    ((last10[last10.length - 1].close - closeMin) / (closeMax - closeMin)) * 100;

  const isRanging = rangePct < 8; // < 8% de range nos 30 candles
  const isTrending = Math.abs(slope) > 0.05; // movimento > 5%

  if (isTrending && slope > 0) {
    return {
      phase: "markup",
      confidence: Math.min(100, Math.round(50 + slope * 500)),
      description: `Alta consistente: +${(slope * 100).toFixed(1)}% nos ultimos candles. Volume ${volRatio > 1.2 ? "crescente" : "normal"}.`,
    };
  }
  if (isTrending && slope < 0) {
    return {
      phase: "markdown",
      confidence: Math.min(100, Math.round(50 + Math.abs(slope) * 500)),
      description: `Baixa consistente: ${(slope * 100).toFixed(1)}% nos ultimos candles. Volume ${volRatio > 1.2 ? "crescente" : "normal"}.`,
    };
  }
  if (isRanging && volRatio > 1.2 && positionInRange < 40) {
    return {
      phase: "accumulation",
      confidence: Math.min(100, Math.round(50 + (volRatio - 1) * 50)),
      description: `Consolidacao no fundo do range com volume ${(volRatio * 100).toFixed(0)}% da media. Possivel acumulacao institucional.`,
    };
  }
  if (isRanging && volRatio > 1.2 && positionInRange > 60) {
    return {
      phase: "distribution",
      confidence: Math.min(100, Math.round(50 + (volRatio - 1) * 50)),
      description: `Consolidacao no topo do range com volume ${(volRatio * 100).toFixed(0)}% da media. Possivel distribuicao institucional.`,
    };
  }
  return {
    phase: "transition",
    confidence: 40,
    description: "Mercado em transicao, sem fase clara identificada.",
  };
}

// ============================================================
// ELLIOTT WAVES (heuristica simples)
// ============================================================

/**
 * Identifica probabilisticamente a onda atual usando contagem de swings.
 *
 * Heuristica:
 *   - Conta os ultimos swings alternados (HH/HL/LH/LL pattern)
 *   - Se preco esta em alta apos 3-4 swings ascendentes → provavel onda 3 ou 5
 *   - Se preco esta em alta apos 1-2 swings → onda 1 ou 2
 *   - Apos picos com correcoes profundas → ABC
 *
 * NAO eh contagem oficial Elliott — eh uma APROXIMACAO probabilistica.
 */
function analyzeElliott(candles: Candle[]): ElliottResult {
  const swings = findSwings(candles, 3);
  if (swings.length < 4) {
    return {
      currentWave: "indefinido",
      probability: 0,
      type: "unknown",
      description: "Sem swings suficientes pra contar ondas.",
    };
  }

  const lastSwings = swings.slice(-6);
  const lastPrice = candles[candles.length - 1].close;
  const lastSwing = lastSwings[lastSwings.length - 1];

  // Verifica padrao impulsivo de alta: low → high → low (higher) → high (higher) → low (higher) → high (higher)
  // Simplificacao: olha se ultimos 4 swings formaram higher highs e higher lows
  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  for (let i = 2; i < lastSwings.length; i += 2) {
    if (lastSwings[i].type === "high" && lastSwings[i].price > lastSwings[i - 2].price)
      higherHighs++;
    if (lastSwings[i].type === "low" && lastSwings[i].price > lastSwings[i - 2].price)
      higherLows++;
    if (lastSwings[i].type === "high" && lastSwings[i].price < lastSwings[i - 2].price)
      lowerHighs++;
    if (lastSwings[i].type === "low" && lastSwings[i].price < lastSwings[i - 2].price)
      lowerLows++;
  }

  // Direcao predominante
  const isBullishImpulse = higherHighs >= 2 && higherLows >= 1;
  const isBearishImpulse = lowerHighs >= 2 && lowerLows >= 1;

  if (isBullishImpulse) {
    // Contagem aproximada
    const upMoves = higherHighs + higherLows;
    if (upMoves >= 4 && lastSwing.type === "high") {
      return {
        currentWave: "wave_5",
        probability: 60,
        type: "impulsive",
        description:
          "Provavel onda 5 impulsiva de alta — possivel exaustao a frente, vigie reversao.",
      };
    }
    if (upMoves >= 3 && lastSwing.type === "high") {
      return {
        currentWave: "wave_3",
        probability: 65,
        type: "impulsive",
        description: "Provavel onda 3 — geralmente a mais forte do impulso.",
      };
    }
    if (upMoves >= 2 && lastSwing.type === "low") {
      return {
        currentWave: "wave_4",
        probability: 55,
        type: "impulsive",
        description: "Provavel onda 4 corretiva, aguardando onda 5.",
      };
    }
    return {
      currentWave: "wave_1",
      probability: 50,
      type: "impulsive",
      description: "Inicio de movimento impulsivo de alta (onda 1 ou 2).",
    };
  }

  if (isBearishImpulse) {
    return {
      currentWave: "wave_c",
      probability: 55,
      type: "corrective",
      description: "Provavel onda C corretiva de baixa.",
    };
  }

  return {
    currentWave: "indefinido",
    probability: 40,
    type: "unknown",
    description: "Estrutura nao se encaixa claramente em padrao Elliott.",
  };
}

// ============================================================
// GANN
// ============================================================

/**
 * Calcula angulos de Gann a partir do ultimo swing significativo.
 *
 * 1x1 = preco se move 1 unidade por unidade de tempo (45 graus)
 * 2x1 = 2 unidades de preco por 1 de tempo (forte)
 * 1x2 = 1 de preco por 2 de tempo (fraco)
 *
 * Implementacao: usa o ultimo swing low/high relevante como pivot,
 * calcula projecao linear ate o candle atual.
 */
function analyzeGann(candles: Candle[]): GannResult {
  if (candles.length < 50) {
    return {
      angle1x1: 0,
      positionVs1x1: "on",
      levels: [],
      description: "Dados insuficientes.",
    };
  }

  const swings = findSwings(candles, 5);
  if (swings.length === 0) {
    return {
      angle1x1: 0,
      positionVs1x1: "on",
      levels: [],
      description: "Sem swing significativo.",
    };
  }

  const lastPrice = candles[candles.length - 1].close;
  const currentIndex = candles.length - 1;

  // Pega o ultimo swing low (referencia bullish) e o ultimo high
  const lows = swings.filter((s) => s.type === "low");
  const lastSwingLow = lows[lows.length - 1];

  if (!lastSwingLow) {
    return {
      angle1x1: 0,
      positionVs1x1: "on",
      levels: [],
      description: "Sem swing low de referencia.",
    };
  }

  // Unidade de preco: usamos ATR como proxy (1 unidade tempo = 1 candle)
  // Calcula ATR simples dos ultimos 14
  const atrCandles = candles.slice(-14);
  let atrSum = 0;
  for (const c of atrCandles) atrSum += c.high - c.low;
  const atr = atrSum / atrCandles.length;
  if (atr <= 0) {
    return {
      angle1x1: 0,
      positionVs1x1: "on",
      levels: [],
      description: "ATR invalido.",
    };
  }

  // Tempo desde o swing low (em candles)
  const timeDelta = currentIndex - lastSwingLow.index;
  if (timeDelta <= 0) {
    return {
      angle1x1: 0,
      positionVs1x1: "on",
      levels: [],
      description: "Swing recente, sem projecao significativa.",
    };
  }

  // Niveis de Gann projetados a partir do swing low
  const angle1x1 = lastSwingLow.price + timeDelta * atr; // 45 graus
  const angle2x1 = lastSwingLow.price + timeDelta * atr * 2; // 63 graus
  const angle1x2 = lastSwingLow.price + timeDelta * atr * 0.5; // 26 graus
  const angle4x1 = lastSwingLow.price + timeDelta * atr * 4; // 75 graus
  const angle1x4 = lastSwingLow.price + timeDelta * atr * 0.25; // 14 graus

  const positionVs1x1: "above" | "below" | "on" =
    lastPrice > angle1x1 * 1.005
      ? "above"
      : lastPrice < angle1x1 * 0.995
        ? "below"
        : "on";

  return {
    angle1x1,
    positionVs1x1,
    levels: [
      { angle: "4x1 (forte alta)", price: angle4x1 },
      { angle: "2x1 (alta)", price: angle2x1 },
      { angle: "1x1 (45°, referencia)", price: angle1x1 },
      { angle: "1x2 (fraco)", price: angle1x2 },
      { angle: "1x4 (correcao)", price: angle1x4 },
    ],
    description:
      positionVs1x1 === "above"
        ? `Preco ${(((lastPrice - angle1x1) / angle1x1) * 100).toFixed(1)}% acima do 1x1 — forca acima da tendencia natural.`
        : positionVs1x1 === "below"
          ? `Preco ${(((angle1x1 - lastPrice) / angle1x1) * 100).toFixed(1)}% abaixo do 1x1 — perdendo a tendencia natural.`
          : "Preco proximo ao angulo 1x1 (tendencia natural).",
  };
}

// ============================================================
// DOW THEORY
// ============================================================

/**
 * Tendencia primaria via higher highs + higher lows (alta) ou inverso (baixa).
 */
function analyzeDow(candles: Candle[]): DowResult {
  const swings = findSwings(candles, 3);
  const lastSwings = swings.slice(-8);

  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  for (let i = 2; i < lastSwings.length; i += 2) {
    if (lastSwings[i]?.type === "high" && lastSwings[i - 2]?.type === "high") {
      if (lastSwings[i].price > lastSwings[i - 2].price) higherHighs++;
      else lowerHighs++;
    }
    if (lastSwings[i]?.type === "low" && lastSwings[i - 2]?.type === "low") {
      if (lastSwings[i].price > lastSwings[i - 2].price) higherLows++;
      else lowerLows++;
    }
  }

  let primaryTrend: DowTrend;
  let confirmed = false;
  let description: string;

  if (higherHighs >= 2 && higherLows >= 1) {
    primaryTrend = "primary_uptrend";
    confirmed = higherHighs >= 2 && higherLows >= 2;
    description = `${higherHighs} higher highs + ${higherLows} higher lows = ${confirmed ? "tendencia primaria de alta CONFIRMADA" : "alta provavel"}`;
  } else if (lowerHighs >= 2 && lowerLows >= 1) {
    primaryTrend = "primary_downtrend";
    confirmed = lowerHighs >= 2 && lowerLows >= 2;
    description = `${lowerHighs} lower highs + ${lowerLows} lower lows = ${confirmed ? "tendencia primaria de baixa CONFIRMADA" : "baixa provavel"}`;
  } else {
    primaryTrend = "sideways";
    description = "Sem padrao claro de higher/lower highs/lows — mercado lateral.";
  }

  return {
    primaryTrend,
    confirmed,
    description,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows,
  };
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export function analyzeWegd(candles: Candle[]): WegdResult {
  const wyckoff = analyzeWyckoff(candles);
  const elliott = analyzeElliott(candles);
  const gann = analyzeGann(candles);
  const dow = analyzeDow(candles);

  // Resumo consolidado
  const wyckoffLabel: Record<WyckoffPhase, string> = {
    accumulation: "Acumulacao",
    markup: "Markup (alta)",
    distribution: "Distribuicao",
    markdown: "Markdown (baixa)",
    transition: "Transicao",
  };
  const dowLabel: Record<DowTrend, string> = {
    primary_uptrend: "Alta primaria",
    primary_downtrend: "Baixa primaria",
    sideways: "Lateral",
  };

  const summary = `Wyckoff: ${wyckoffLabel[wyckoff.phase]} (${wyckoff.confidence}%) · Elliott: ${elliott.currentWave} (${elliott.probability}%) · Gann: 1x1 ${gann.positionVs1x1} · Dow: ${dowLabel[dow.primaryTrend]}`;

  return { wyckoff, elliott, gann, dow, summary };
}
