/**
 * Motor de análise — ENGINE V1 (LEAN).
 *
 * Espelha a estrutura ENGINE V5 do Vortex (que descobrimos via engenharia
 * reversa), mas com algoritmos abertos, auditáveis e em camadas claras:
 *
 *   1. INDICADORES (20) — calculados em paralelo
 *   2. VOTAÇÃO       — cada indicador vota BUY/SELL/NEUTRAL com peso
 *   3. SINAL         — sinal final + força (0-100) + confluência (0-10)
 *   4. RISCO         — entry/SL/TP1/TP2/TP3 baseado em ATR e estrutura
 *   5. GATES (6)     — filtros de qualidade que ANULAM o sinal se falham
 *   6. EXPLICAÇÃO    — narrativa heurística (será trocada por LLM no Sprint 4)
 *
 * Diferencial vs Vortex:
 *   - Cada indicador retorna seu voto e o porquê (auditável)
 *   - Gates podem ser configuráveis pelo usuário (futuro)
 *   - Score / confluência são quantificados (SHAP-style no Sprint 4)
 */

import type {
  AnalysisInput,
  AnalysisResult,
  GateResult,
  IndicatorResult,
  RiskOutput,
  SignalDirection,
  SignalOutput,
} from "./types";
import { ratioToSignal, signalSide, isActionable, signalLabel } from "./signal-utils";
import { analyzeSmc } from "./smc";
import { runMonteCarlo } from "./monte-carlo";
import { analyzeSeasonality } from "./seasonality";
import { buildDualScenarios } from "./dual-scenarios";
import { detectHarmonics } from "./harmonics";
import { analyzeWegd } from "./wegd";
import {
  adx,
  atr,
  awesome,
  bollinger,
  cci,
  cmf,
  ema,
  macd,
  mfi,
  obv,
  roc,
  rsi,
  sma,
  stoch,
  supertrend,
  trix,
  vwma,
  williamsR,
} from "./indicators";

export const ENGINE_VERSION = "v1.1-adaptive";

// ============================================================
// 0) CLASSIFICACAO DE REGIME DE MERCADO (v1.1)
// ============================================================

/**
 * Regimes de mercado possiveis:
 *   - trending: ADX >= 25, direcao clara. Favorece sinais trend-following.
 *   - ranging:  ADX < 20, mercado lateral. Favorece sinais mean-reversion.
 *   - transitional: ADX entre 20-25, zona ambigua. Reduz forca de qualquer sinal.
 *   - explosive: ATR atual >= 2x ATR medio. Mercado ruidoso, whipsaws frequentes.
 */
export type MarketRegime =
  | "trending"
  | "ranging"
  | "transitional"
  | "explosive";

function computeMarketRegime(candles: AnalysisInput["candles"]): {
  regime: MarketRegime;
  adxValue: number;
  atrCurrent: number;
  atrAvg: number;
  atrRatio: number;
} {
  const adxR = adx(candles, 14);
  const atrCurrent = atr(candles, 14);

  // ATR media dos ultimos 50 candles (recalcula janela por janela)
  let atrSum = 0;
  const window = Math.min(50, candles.length - 14);
  for (let i = candles.length - window; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    if (slice.length >= 15) {
      atrSum += atr(slice, 14);
    }
  }
  const atrAvg = window > 0 ? atrSum / window : atrCurrent;
  const atrRatio = atrAvg > 0 ? atrCurrent / atrAvg : 1;

  let regime: MarketRegime;
  if (atrRatio >= 2.0) {
    regime = "explosive";
  } else if (adxR.adx >= 25) {
    regime = "trending";
  } else if (adxR.adx < 20) {
    regime = "ranging";
  } else {
    regime = "transitional";
  }

  return {
    regime,
    adxValue: adxR.adx,
    atrCurrent,
    atrAvg,
    atrRatio,
  };
}

/**
 * Classifica cada indicador como "trend-following" ou "mean-reversion".
 * Usado pra adaptar pesos por regime de mercado.
 */
function indicatorType(
  name: string
): "trend" | "mean-reversion" | "neutral" {
  // Trend-following: usam direcao das medias e momentum direcional
  const trend = [
    "EMA (20)",
    "EMA (50)",
    "EMA (200)",
    "SMA (50)",
    "VWMA (20)",
    "ADX (14)",
    "Supertrend (ATR10, 3)",
    "TRIX (14)",
    "MACD (12,26,9)",
    "ROC (14)",
    "Awesome Oscillator",
    "OBV",
    "CMF (20)",
  ];
  // Mean-reversion: extremos, sobrecomprado/sobrevendido, retorno a media
  const meanRev = [
    "RSI (14)",
    "Stochastic (14,3,3)",
    "CCI (20)",
    "Williams %R (14)",
    "MFI (14)",
    "Bollinger Bands (20, 2σ)",
  ];
  if (trend.includes(name)) return "trend";
  if (meanRev.includes(name)) return "mean-reversion";
  return "neutral";
}

// ============================================================
// 1) INDICADORES → VOTOS
// ============================================================

/**
 * Calcula os 20 indicadores e converte cada um num voto direcional.
 */
function computeIndicators(candles: AnalysisInput["candles"]): IndicatorResult[] {
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1].close;

  const results: IndicatorResult[] = [];

  // ---------- MÉDIAS MÓVEIS (5) ----------
  const ema20 = ema(closes, 20).at(-1)!;
  const ema50 = ema(closes, 50).at(-1)!;
  const ema200 = ema(closes, 200).at(-1)!;
  const sma50 = sma(closes, 50).at(-1)!;
  const vwma20 = vwma(candles, 20);

  results.push({
    name: "EMA (20)",
    category: "Médias Móveis",
    value: ema20,
    vote: last > ema20 ? "BUY" : "SELL",
    note: `Preço ${last > ema20 ? "acima" : "abaixo"} da EMA 20`,
  });
  results.push({
    name: "EMA (50)",
    category: "Médias Móveis",
    value: ema50,
    vote: last > ema50 ? "BUY" : "SELL",
    note: `Preço ${last > ema50 ? "acima" : "abaixo"} da EMA 50`,
  });
  results.push({
    name: "EMA (200)",
    category: "Médias Móveis",
    value: ema200,
    vote: last > ema200 ? "BUY" : "SELL",
    note: `Tendência de longo prazo ${last > ema200 ? "de alta" : "de baixa"}`,
  });
  results.push({
    name: "SMA (50)",
    category: "Médias Móveis",
    value: sma50,
    vote: last > sma50 ? "BUY" : "SELL",
  });
  results.push({
    name: "VWMA (20)",
    category: "Médias Móveis",
    value: vwma20,
    vote: Number.isNaN(vwma20) ? "NEUTRAL" : last > vwma20 ? "BUY" : "SELL",
    note: "Média ponderada por volume",
  });

  // ---------- OSCILADORES (8) ----------
  const rsiVal = rsi(closes, 14);
  results.push({
    name: "RSI (14)",
    category: "Osciladores",
    value: rsiVal,
    vote: rsiVal > 60 ? "BUY" : rsiVal < 40 ? "SELL" : "NEUTRAL",
    note: rsiVal > 70 ? "Sobrecomprado" : rsiVal < 30 ? "Sobrevendido" : "Neutro",
  });

  const macdR = macd(closes);
  results.push({
    name: "MACD (12,26,9)",
    category: "Osciladores",
    value: macdR,
    vote:
      macdR.histogram > 0
        ? "BUY"
        : macdR.histogram < 0
          ? "SELL"
          : "NEUTRAL",
    note: `Histograma ${macdR.histogram > 0 ? "positivo" : "negativo"}`,
  });

  const st = stoch(candles);
  results.push({
    name: "Stochastic (14,3,3)",
    category: "Osciladores",
    value: st,
    vote: st.k > st.d && st.k < 80 ? "BUY" : st.k < st.d && st.k > 20 ? "SELL" : "NEUTRAL",
  });

  const cciVal = cci(candles, 20);
  results.push({
    name: "CCI (20)",
    category: "Osciladores",
    value: cciVal,
    vote: cciVal > 100 ? "BUY" : cciVal < -100 ? "SELL" : "NEUTRAL",
  });

  const wr = williamsR(candles, 14);
  results.push({
    name: "Williams %R (14)",
    category: "Osciladores",
    value: wr,
    vote: wr > -20 ? "SELL" : wr < -80 ? "BUY" : "NEUTRAL",
    note: wr > -20 ? "Sobrecomprado" : wr < -80 ? "Sobrevendido" : "Neutro",
  });

  const awesomeVal = awesome(candles);
  results.push({
    name: "Awesome Oscillator",
    category: "Osciladores",
    value: awesomeVal,
    vote: awesomeVal > 0 ? "BUY" : awesomeVal < 0 ? "SELL" : "NEUTRAL",
  });

  const mfiVal = mfi(candles, 14);
  results.push({
    name: "MFI (14)",
    category: "Osciladores",
    value: mfiVal,
    vote: mfiVal > 60 ? "BUY" : mfiVal < 40 ? "SELL" : "NEUTRAL",
  });

  const rocVal = roc(closes, 14);
  results.push({
    name: "ROC (14)",
    category: "Osciladores",
    value: rocVal,
    vote: rocVal > 0 ? "BUY" : rocVal < 0 ? "SELL" : "NEUTRAL",
  });

  // ---------- TENDÊNCIA (3) ----------
  const adxR = adx(candles, 14);
  results.push({
    name: "ADX (14)",
    category: "Tendência",
    value: adxR,
    vote:
      adxR.adx > 25
        ? adxR.plusDI > adxR.minusDI
          ? "BUY"
          : "SELL"
        : "NEUTRAL",
    note:
      adxR.adx > 25
        ? `Tendência forte (ADX ${adxR.adx.toFixed(1)})`
        : "Sem tendência clara",
  });

  const stR = supertrend(candles, 10, 3);
  results.push({
    name: "Supertrend (ATR10, 3)",
    category: "Tendência",
    value: stR.value,
    vote: stR.trend === "up" ? "BUY" : "SELL",
  });

  const trixVal = trix(closes, 14);
  results.push({
    name: "TRIX (14)",
    category: "Tendência",
    value: trixVal,
    vote: trixVal > 0 ? "BUY" : trixVal < 0 ? "SELL" : "NEUTRAL",
  });

  // ---------- VOLATILIDADE (2) ----------
  const bb = bollinger(closes, 20, 2);
  results.push({
    name: "Bollinger Bands (20, 2σ)",
    category: "Volatilidade",
    value: bb,
    vote: last < bb.lower ? "BUY" : last > bb.upper ? "SELL" : "NEUTRAL",
    note: last < bb.lower ? "Abaixo da banda inferior" : last > bb.upper ? "Acima da banda superior" : "Dentro das bandas",
  });

  const atrVal = atr(candles, 14);
  results.push({
    name: "ATR (14)",
    category: "Volatilidade",
    value: atrVal,
    vote: "NEUTRAL",
    note: `Volatilidade atual: ${atrVal.toFixed(2)}`,
  });

  // ---------- VOLUME (2) ----------
  const obvR = obv(candles);
  results.push({
    name: "OBV",
    category: "Volume",
    value: obvR,
    vote: obvR.slope > 5 ? "BUY" : obvR.slope < -5 ? "SELL" : "NEUTRAL",
    note: `Inclinação ${obvR.slope.toFixed(1)}%`,
  });

  const cmfVal = cmf(candles, 20);
  results.push({
    name: "CMF (20)",
    category: "Volume",
    value: cmfVal,
    vote: cmfVal > 0.05 ? "BUY" : cmfVal < -0.05 ? "SELL" : "NEUTRAL",
    note: cmfVal > 0 ? "Pressão compradora" : "Pressão vendedora",
  });

  return results;
}

// ============================================================
// 2) VOTAÇÃO → SINAL
// ============================================================

function computeSignal(
  indicators: IndicatorResult[],
  regime: MarketRegime = "transitional"
): SignalOutput {
  let buy = 0,
    sell = 0,
    neutral = 0;

  // Pesos por categoria (calibragem inicial — pode ser ajustada via backtest)
  const baseWeights: Record<string, number> = {
    "Tendência": 1.5,
    "Médias Móveis": 1.2,
    "Osciladores": 1.0,
    "Volatilidade": 0.8,
    "Volume": 0.8,
  };

  // Modificadores por regime de mercado (v1.1):
  //   - trending: aumenta peso de trend-following, reduz mean-reversion
  //   - ranging:  inverte (favorece mean-reversion)
  //   - transitional: pesos neutros (mantem padrao)
  //   - explosive: zera mean-reversion (ruido alto), reduz trend tambem
  const regimeMultiplier = (
    indName: string
  ): number => {
    const t = indicatorType(indName);
    if (regime === "trending") {
      if (t === "trend") return 1.3;
      if (t === "mean-reversion") return 0.5;
    } else if (regime === "ranging") {
      if (t === "trend") return 0.6;
      if (t === "mean-reversion") return 1.4;
    } else if (regime === "explosive") {
      if (t === "trend") return 0.8;
      if (t === "mean-reversion") return 0.3; // muito ruidoso pra mean-rev
    }
    return 1.0;
  };

  let weightedBuy = 0,
    weightedSell = 0;

  for (const ind of indicators) {
    const baseW = baseWeights[ind.category] ?? 1.0;
    const w = baseW * regimeMultiplier(ind.name);
    if (ind.vote === "BUY") {
      buy++;
      weightedBuy += w;
    } else if (ind.vote === "SELL") {
      sell++;
      weightedSell += w;
    } else {
      neutral++;
    }
  }

  const total = weightedBuy + weightedSell;
  // ratio = 0 (tudo SELL) ... 0.5 (equilíbrio) ... 1.0 (tudo BUY)
  const ratio = total === 0 ? 0.5 : weightedBuy / total;

  // Mapeia ratio para os 7 níveis graduados (Compra Forte / Compra / Compra Fraca /
  // Neutro / Venda Fraca / Venda / Venda Forte)
  const signal: SignalDirection = ratioToSignal(ratio);

  // Força = quão decisiva foi a votação (0-100)
  // ratio 0.5 = 0 ; ratio 0 ou 1 = 100
  const strength = Math.round(Math.abs(ratio - 0.5) * 200);

  // Confluência = nº de indicadores votantes alinhados com o LADO do sinal (cap 10).
  // Para WEAK_BUY/BUY/STRONG_BUY conta votos BUY; idem espelhado pra SELL.
  // Para NEUTRAL conta votos NEUTRAL.
  const side = signalSide(signal);
  const aligned = side === "buy" ? buy : side === "sell" ? sell : neutral;
  const confluence = Math.min(
    10,
    Math.round((aligned / indicators.length) * 10)
  );

  return {
    signal,
    strength,
    confluence,
    votes: { buy, sell, neutral },
  };
}

// ============================================================
// 3) RISCO (entrada, SL, TP)
// ============================================================

function computeRisk(
  candles: AnalysisInput["candles"],
  signal: SignalDirection
): RiskOutput {
  // Determina o lado da operação (compra/venda) a partir dos 7 níveis.
  const side = signalSide(signal);
  const last = candles[candles.length - 1].close;
  const atrVal = atr(candles, 14);

  // Multiplicadores baseados em ATR — v1.1-adaptive (calibrados para subir TP1 touch).
  // Mantem R:R do TP1 em 1.5 (Gate D), mas aproxima alvos da entrada:
  //   SL  = 1.2x ATR   (era 1.5 — stop mais apertado)
  //   TP1 = 1.8x ATR   (era 2.25 — alvo mais perto, mais touches esperados)
  //   TP2 = 3.0x ATR   (era 3.75)
  //   TP3 = 4.5x ATR   (era 5.25)
  //
  // Trade-off conhecido: stop mais apertado pode aumentar SL-outs prematuros
  // em mercados ruidosos. Compensado pelos novos Gates G (regime) e H (volatilidade).
  const slMult = 1.2;
  const tp1Mult = 1.8;
  const tp2Mult = 3.0;
  const tp3Mult = 4.5;

  let entry: number, stopLoss: number, takeProfit1: number, takeProfit2: number, takeProfit3: number;

  if (side === "buy") {
    entry = last;
    stopLoss = last - atrVal * slMult;
    takeProfit1 = last + atrVal * tp1Mult;
    takeProfit2 = last + atrVal * tp2Mult;
    takeProfit3 = last + atrVal * tp3Mult;
  } else if (side === "sell") {
    entry = last;
    stopLoss = last + atrVal * slMult;
    takeProfit1 = last - atrVal * tp1Mult;
    takeProfit2 = last - atrVal * tp2Mult;
    takeProfit3 = last - atrVal * tp3Mult;
  } else {
    // Neutro: apenas referência (sem trade)
    entry = last;
    stopLoss = last;
    takeProfit1 = last;
    takeProfit2 = last;
    takeProfit3 = last;
  }

  const distSL = Math.abs(entry - stopLoss);
  const distTP1 = Math.abs(takeProfit1 - entry);
  const rr1 = distSL === 0 ? 0 : distTP1 / distSL;

  return { entry, stopLoss, takeProfit1, takeProfit2, takeProfit3, rr1, distSL, distTP1 };
}

// ============================================================
// 4) GATES DE QUALIDADE (6)
// ============================================================

function computeGates(
  candles: AnalysisInput["candles"],
  signal: SignalOutput,
  indicators: IndicatorResult[],
  risk: RiskOutput,
  regimeInfo: ReturnType<typeof computeMarketRegime>
): GateResult[] {
  const gates: GateResult[] = [];

  // ----- GATE A: Confluência mínima (v1.1 — threshold subiu 5->6) -----
  gates.push({
    id: "A",
    name: "Confluência mínima",
    passed: signal.confluence >= 6,
    detail: `Confluência ${signal.confluence}/10 ${signal.confluence >= 6 ? "(suficiente)" : "(abaixo do mínimo de 6)"}`,
  });

  // ----- GATE B: Tendência alinhada (ADX + EMAs) -----
  const adxInd = indicators.find((i) => i.name === "ADX (14)");
  const adxVal = adxInd && typeof adxInd.value === "object" ? (adxInd.value as { adx: number }).adx : 0;
  const trendOk = adxVal > 20;
  gates.push({
    id: "B",
    name: "Tendência presente",
    passed: trendOk,
    detail: `ADX ${adxVal.toFixed(1)} ${trendOk ? "≥ 20 (tendência identificável)" : "< 20 (sem tendência clara)"}`,
  });

  // ----- GATE C: Volume saudável -----
  const last10Vol = candles.slice(-10).map((c) => c.volume);
  const avg10 = last10Vol.reduce((a, b) => a + b, 0) / 10;
  const last30 = candles.slice(-30).map((c) => c.volume);
  const avg30 = last30.reduce((a, b) => a + b, 0) / 30;
  const volOk = avg10 > avg30 * 0.7;
  gates.push({
    id: "C",
    name: "Volume saudável",
    passed: volOk,
    detail: volOk
      ? "Volume recente próximo da média"
      : "Volume recente muito abaixo da média — possível baixa liquidez",
  });

  // ----- GATE D: R:R mínimo 1:1.5 (apenas para sinais acionáveis) -----
  const actionable = isActionable(signal.signal);
  const rrOk = !actionable || risk.rr1 >= 1.5;
  gates.push({
    id: "D",
    name: "R:R mínimo 1:1.5",
    passed: rrOk,
    detail: !actionable
      ? "Não aplicável (sinal não acionável)"
      : `R:R ${risk.rr1.toFixed(2)} ${rrOk ? "OK" : "abaixo do mínimo"}`,
  });

  // ----- GATE E: Bollinger não em squeeze extremo -----
  const bbInd = indicators.find((i) => i.name === "Bollinger Bands (20, 2σ)");
  const bw =
    bbInd && typeof bbInd.value === "object"
      ? (bbInd.value as { bandwidth: number }).bandwidth
      : 0;
  const bwOk = bw > 0.01;
  gates.push({
    id: "E",
    name: "Volatilidade ativa",
    passed: bwOk,
    detail: bwOk
      ? `Bandwidth ${(bw * 100).toFixed(2)}%`
      : "Bandas muito apertadas — espera consolidação",
  });

  // ----- GATE F: Força mínima 50/100 -----
  const fNeeded = isActionable(signal.signal);
  gates.push({
    id: "F",
    name: "Força mínima do sinal",
    passed: !fNeeded || signal.strength >= 50,
    detail: !fNeeded
      ? "Não aplicável (sinal não acionável)"
      : `Força ${signal.strength}/100 ${signal.strength >= 50 ? "OK" : "fraca"}`,
  });

  // ----- GATE G: Regime de mercado adequado (v1.1) -----
  // Bloqueia sinais em regime ambiguo (transitional). Sinais em trending e
  // ranging passam — eles ja vem com pesos adaptados.
  const regimeOk = regimeInfo.regime !== "transitional";
  gates.push({
    id: "G",
    name: "Regime de mercado",
    passed: regimeOk,
    detail: (() => {
      switch (regimeInfo.regime) {
        case "trending":
          return `Mercado em tendência (ADX ${regimeInfo.adxValue.toFixed(1)})`;
        case "ranging":
          return `Mercado lateral (ADX ${regimeInfo.adxValue.toFixed(1)}) — favorece mean-reversion`;
        case "transitional":
          return `Regime ambíguo (ADX ${regimeInfo.adxValue.toFixed(1)}) — espera definição`;
        case "explosive":
          return `Volatilidade explosiva (ATR ${regimeInfo.atrRatio.toFixed(2)}x média)`;
      }
    })(),
  });

  // ----- GATE H: Volatilidade não explosiva (v1.1) -----
  // ATR atual > 2x média indica mercado erratico — sinais sao menos confiaveis
  const volNotExplosive = regimeInfo.atrRatio < 2.0;
  gates.push({
    id: "H",
    name: "Volatilidade controlada",
    passed: volNotExplosive,
    detail: volNotExplosive
      ? `ATR ${regimeInfo.atrRatio.toFixed(2)}x da média — normal`
      : `ATR ${regimeInfo.atrRatio.toFixed(2)}x da média — risco de whipsaws`,
  });

  return gates;
}

// ============================================================
// 5) EXPLICAÇÃO HEURÍSTICA (placeholder — Sprint 4 substituirá por LLM)
// ============================================================

function buildExplanation(
  signal: SignalOutput,
  indicators: IndicatorResult[],
  gates: GateResult[],
  risk: RiskOutput,
  asset: string,
  timeframe: string
): { summary: string; bullets: string[] } {
  const direction = signalLabel(signal.signal).toUpperCase();
  const side = signalSide(signal.signal);

  const passedGates = gates.filter((g) => g.passed).length;
  const failedGates = gates.filter((g) => !g.passed);

  const trendInd = indicators.find((i) => i.name === "EMA (200)");
  const rsiInd = indicators.find((i) => i.name === "RSI (14)");

  const summary =
    signal.signal === "NEUTRAL"
      ? `Sinal NEUTRO em ${asset} (${timeframe}). Indicadores divididos — recomenda-se aguardar maior clareza direcional.`
      : `Sinal de ${direction} em ${asset} (${timeframe}) com força ${signal.strength}/100 e confluência ${signal.confluence}/10. ${passedGates}/6 gates aprovados.`;

  const bullets: string[] = [];

  // Direção da tendência
  if (trendInd) {
    const above = trendInd.vote === "BUY";
    bullets.push(
      `Tendência de longo prazo ${above ? "ALTA" : "BAIXA"} (preço ${above ? "acima" : "abaixo"} da EMA 200).`
    );
  }

  // RSI
  if (rsiInd) {
    const rsiVal = typeof rsiInd.value === "number" ? rsiInd.value : 0;
    bullets.push(`RSI (14) em ${rsiVal.toFixed(1)} — ${rsiInd.note ?? "neutro"}.`);
  }

  // Votos
  bullets.push(
    `Votação dos 20 indicadores: ${signal.votes.buy} COMPRA · ${signal.votes.sell} VENDA · ${signal.votes.neutral} NEUTRO.`
  );

  // Risco
  if (side !== "neutral") {
    bullets.push(
      `Risco/retorno do TP1: ${risk.rr1.toFixed(2)} (entrada ${risk.entry.toFixed(2)}, stop ${risk.stopLoss.toFixed(2)}, alvo 1 ${risk.takeProfit1.toFixed(2)}).`
    );
  }

  // Gates que falharam
  if (failedGates.length > 0) {
    bullets.push(
      `⚠️ Filtros que falharam: ${failedGates.map((g) => g.name).join(", ")}. Considere o sinal com cautela.`
    );
  } else if (side !== "neutral") {
    bullets.push("✅ Todos os 6 filtros de qualidade aprovados.");
  }

  return { summary, bullets };
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

export function runAnalysis(input: AnalysisInput): AnalysisResult {
  if (input.candles.length < 60) {
    throw new Error(
      `Mínimo 60 candles necessários para análise confiável. Recebidos: ${input.candles.length}`
    );
  }

  const indicators = computeIndicators(input.candles);
  const regimeInfo = computeMarketRegime(input.candles);
  const signal = computeSignal(indicators, regimeInfo.regime);
  const risk = computeRisk(input.candles, signal.signal);
  const gates = computeGates(input.candles, signal, indicators, risk, regimeInfo);

  // Downgrade gradual quando gates críticos falham:
  //   STRONG_BUY/BUY    -> WEAK_BUY   (mantém TP/SL — trader decide se opera)
  //   STRONG_SELL/SELL  -> WEAK_SELL  (idem)
  //   WEAK_BUY/WEAK_SELL -> NEUTRAL   (sem direção -> zera risk)
  //
  // Em qualquer sinal direcional (forte ou fraco) os níveis TP/SL ficam
  // visíveis. Só ocultamos quando vira NEUTRAL (sem direção = sem plano).
  const criticalFailures = gates.filter((g) => !g.passed && ["A", "D"].includes(g.id));
  let finalSignal = signal;
  let finalRisk = risk;

  if (criticalFailures.length > 0 && signal.signal !== "NEUTRAL") {
    let downgraded: SignalDirection;

    if (signal.signal === "STRONG_BUY" || signal.signal === "BUY") {
      downgraded = "WEAK_BUY";
    } else if (signal.signal === "STRONG_SELL" || signal.signal === "SELL") {
      downgraded = "WEAK_SELL";
    } else {
      // WEAK_BUY ou WEAK_SELL -> NEUTRAL (já estava fraco e ainda falhou gates)
      downgraded = "NEUTRAL";
    }

    finalSignal = {
      ...signal,
      signal: downgraded,
      strength: Math.min(signal.strength, 50),
    };

    // Se virou NEUTRAL (perdeu a direção), zera risk para não desenhar linhas
    if (downgraded === "NEUTRAL") {
      const last = input.candles[input.candles.length - 1].close;
      finalRisk = {
        entry: last,
        stopLoss: last,
        takeProfit1: last,
        takeProfit2: last,
        takeProfit3: last,
        rr1: 0,
        distSL: 0,
        distTP1: 0,
      };
    }
    // Para WEAK_BUY/WEAK_SELL: mantém os TP/SL originais (já calculados em computeRisk
    // com signalSide() que reconhece a direção dos sinais fracos).
  }

  const explanation = buildExplanation(
    finalSignal,
    indicators,
    gates,
    finalRisk,
    input.symbol,
    input.timeframe
  );

  // Sprint 9.1: Smart Money Concepts — Order Blocks, FVG, Liquidity, BOS/CHoCH
  const smc = analyzeSmc(input.candles, regimeInfo.atrCurrent);

  // Sprint 9.3: Monte Carlo — 5k simulacoes projetando 20 candles a frente
  const monteCarlo = runMonteCarlo(input.candles, 20, 5000);

  // Sprint 9.4: Sazonalidade historica — performance media por mes
  const seasonality = analyzeSeasonality(input.candles);

  // Sprint 9.5: Cenarios Compra E Venda lado a lado com prob por TP
  const dualScenarios = buildDualScenarios(
    input.candles,
    regimeInfo.atrCurrent,
    30
  );

  // Sprint 9.6: Padroes Harmonicos (Bat, Butterfly, Gartley, Crab, Cypher, Shark)
  const harmonics = detectHarmonics(input.candles);

  // Sprint 9.10: WEGD - Wyckoff/Elliott/Gann/Dow Theory
  const wegd = analyzeWegd(input.candles);

  return {
    signal: finalSignal,
    risk: finalRisk,
    indicators,
    gates,
    smc,
    monteCarlo,
    seasonality,
    dualScenarios,
    harmonics,
    wegd,
    explanation,
    meta: {
      asset: input.symbol,
      assetType: input.assetType,
      timeframe: input.timeframe,
      candlesUsed: input.candles.length,
      generatedAt: Date.now(),
      enginVersion: ENGINE_VERSION,
      regime: regimeInfo.regime,
      adxValue: regimeInfo.adxValue,
      atrRatio: regimeInfo.atrRatio,
    },
  };
}
