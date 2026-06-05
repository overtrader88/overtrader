/**
 * Cenarios Compra E Venda lado a lado — diferencial vs Vortex.
 *
 * Em vez de mostrar SO o lado do sinal final, calculamos AMBOS os lados
 * (hipotetico) e damos a probabilidade de cada TP ser atingido com base
 * em volatilidade historica.
 *
 * Util porque:
 *   - Trader pode ver o lado contrario pra ter ideia do risco se errar a direcao
 *   - Probabilidade por TP (1, 2, 3) ajuda a calibrar tamanho de posicao
 *   - Mostrar transparencia: "vendendo voce tem X% de chance no TP1"
 *
 * Calculo da probabilidade: usa volatilidade historica (sigma dos log returns)
 * e calcula a chance de o preco atingir o nivel TP em N candles via funcao
 * de distribuicao normal acumulada (NCDF approx).
 */
import type { Candle } from "@/lib/market/types";

export interface ScenarioTp {
  /** Preço alvo */
  price: number;
  /** Distancia em % do preço atual */
  distancePct: number;
  /** Probabilidade (0-100) do preço atingir esse alvo no horizonte */
  probability: number;
}

export interface ScenarioSide {
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: ScenarioTp;
  tp2: ScenarioTp;
  tp3: ScenarioTp;
  /** Probabilidade do stop ser atingido (informacao defensiva) */
  stopProbability: number;
  /** Score geral do cenario (probabilidade ponderada * R-multiple ponderado) */
  score: number;
}

export interface DualScenarios {
  buy: ScenarioSide;
  sell: ScenarioSide;
  /** Qual lado tem maior score */
  recommended: "buy" | "sell";
  /** Diferenca de score entre os 2 lados */
  edge: number;
  horizonCandles: number;
}

/**
 * Aproximacao da CDF normal padrao (com erro < 7.5e-8).
 * Necessaria pra calcular P(preço atinge nivel) sob hipotese GBM.
 *
 * Fonte: Abramowitz & Stegun, formula 26.2.17
 */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calcula log returns dos candles.
 */
function logReturns(candles: Candle[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    if (prev > 0 && curr > 0) r.push(Math.log(curr / prev));
  }
  return r;
}

function stats(arr: number[]): { mean: number; sigma: number } {
  if (arr.length === 0) return { mean: 0, sigma: 0 };
  const m = arr.reduce((sum, x) => sum + x, 0) / arr.length;
  const variance =
    arr.length > 1
      ? arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1)
      : 0;
  return { mean: m, sigma: Math.sqrt(variance) };
}

/**
 * Probabilidade do preço atingir o nivel `target` em `steps` candles,
 * sob hipotese de Geometric Brownian Motion com drift e sigma calibrados.
 *
 * Para "preço atinge nivel": queremos P(max preço > target | side=buy)
 * ou P(min preço < target | side=sell).
 *
 * Aproximacao usada: barreira simples via reflection principle do GBM
 *   P(max > L) = 2 * (1 - Phi(d))  para drift baixo
 * onde d = (ln(L/S) - mu * t) / (sigma * sqrt(t))
 *
 * Para o objetivo deste sistema (probabilidade indicativa, nao precificacao
 * de derivativos), essa aproximacao e suficiente.
 */
function probabilityOfTouching(
  currentPrice: number,
  target: number,
  side: "buy" | "sell",
  drift: number,
  sigma: number,
  steps: number
): number {
  if (sigma <= 0 || steps <= 0 || currentPrice <= 0 || target <= 0) return 0;

  const totalSigma = sigma * Math.sqrt(steps);
  const totalDrift = drift * steps;
  const logRatio = Math.log(target / currentPrice);

  if (side === "buy") {
    // P(preço sobe ate target alguma vez nos proximos N candles)
    if (target <= currentPrice) return 100;
    const d = (logRatio - totalDrift) / totalSigma;
    // Reflection: P(max > target) = 1 - Phi(d) + exp(2*mu*ln(L/S)/sigma^2) * Phi(-d_alt)
    // Simplificacao: usar P(end > target) * 2 como aproximacao do max
    const p = 2 * (1 - normalCdf(d));
    return Math.max(0, Math.min(100, p * 100));
  } else {
    // P(preço cai ate target alguma vez nos proximos N candles)
    if (target >= currentPrice) return 100;
    const d = (logRatio - totalDrift) / totalSigma;
    const p = 2 * normalCdf(d);
    return Math.max(0, Math.min(100, p * 100));
  }
}

/**
 * Constroi os 2 cenarios hipoteticos (compra E venda) com mesma distancia
 * de SL/TPs (espelhada). Calcula probabilidade de cada TP.
 *
 * @param candles Historico de candles
 * @param atrMult Multiplicadores ATR usados no engine. Default igual ao engine v1.1:
 *                  SL=1.2x, TP1=1.8x, TP2=3.0x, TP3=4.5x
 * @param atr ATR(14) atual
 * @param horizonCandles Quantos candles a frente projetar (default 30)
 */
export function buildDualScenarios(
  candles: Candle[],
  atr: number,
  horizonCandles = 30,
  atrMult = { sl: 1.2, tp1: 1.8, tp2: 3.0, tp3: 4.5 }
): DualScenarios | null {
  if (candles.length < 50 || atr <= 0) return null;

  const currentPrice = candles[candles.length - 1].close;
  const returns = logReturns(candles);
  const { mean: drift, sigma } = stats(returns);

  // BUY scenario
  const buyEntry = currentPrice;
  const buyStop = currentPrice - atr * atrMult.sl;
  const buyTp1 = currentPrice + atr * atrMult.tp1;
  const buyTp2 = currentPrice + atr * atrMult.tp2;
  const buyTp3 = currentPrice + atr * atrMult.tp3;

  const buy: ScenarioSide = {
    side: "buy",
    entry: buyEntry,
    stopLoss: buyStop,
    tp1: {
      price: buyTp1,
      distancePct: ((buyTp1 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        buyTp1,
        "buy",
        drift,
        sigma,
        horizonCandles
      ),
    },
    tp2: {
      price: buyTp2,
      distancePct: ((buyTp2 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        buyTp2,
        "buy",
        drift,
        sigma,
        horizonCandles
      ),
    },
    tp3: {
      price: buyTp3,
      distancePct: ((buyTp3 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        buyTp3,
        "buy",
        drift,
        sigma,
        horizonCandles
      ),
    },
    stopProbability: probabilityOfTouching(
      currentPrice,
      buyStop,
      "sell",
      drift,
      sigma,
      horizonCandles
    ),
    score: 0,
  };

  // SELL scenario (espelhado)
  const sellEntry = currentPrice;
  const sellStop = currentPrice + atr * atrMult.sl;
  const sellTp1 = currentPrice - atr * atrMult.tp1;
  const sellTp2 = currentPrice - atr * atrMult.tp2;
  const sellTp3 = currentPrice - atr * atrMult.tp3;

  const sell: ScenarioSide = {
    side: "sell",
    entry: sellEntry,
    stopLoss: sellStop,
    tp1: {
      price: sellTp1,
      distancePct: ((sellTp1 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        sellTp1,
        "sell",
        drift,
        sigma,
        horizonCandles
      ),
    },
    tp2: {
      price: sellTp2,
      distancePct: ((sellTp2 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        sellTp2,
        "sell",
        drift,
        sigma,
        horizonCandles
      ),
    },
    tp3: {
      price: sellTp3,
      distancePct: ((sellTp3 - currentPrice) / currentPrice) * 100,
      probability: probabilityOfTouching(
        currentPrice,
        sellTp3,
        "sell",
        drift,
        sigma,
        horizonCandles
      ),
    },
    stopProbability: probabilityOfTouching(
      currentPrice,
      sellStop,
      "buy",
      drift,
      sigma,
      horizonCandles
    ),
    score: 0,
  };

  // Score = somatoria(prob * R) ponderado
  // R-multiples (com move-to-BE conceitualmente): TP1=1.5, TP2=2.5, TP3=3.75
  buy.score = Math.round(
    buy.tp1.probability * 1.5 +
      buy.tp2.probability * 2.5 +
      buy.tp3.probability * 3.75 -
      buy.stopProbability * 3 // penaliza prob alta de stop
  );
  sell.score = Math.round(
    sell.tp1.probability * 1.5 +
      sell.tp2.probability * 2.5 +
      sell.tp3.probability * 3.75 -
      sell.stopProbability * 3
  );

  return {
    buy,
    sell,
    recommended: buy.score >= sell.score ? "buy" : "sell",
    edge: Math.abs(buy.score - sell.score),
    horizonCandles,
  };
}
