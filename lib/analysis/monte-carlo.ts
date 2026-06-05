/**
 * Monte Carlo Simulation pra projecao probabilistica de preco.
 *
 * Metodo: Geometric Brownian Motion (GBM)
 *   - Calcula log returns historicos
 *   - Drift = media dos log returns (deslocamento esperado)
 *   - Sigma = desvio padrao (volatilidade)
 *   - Para cada simulacao: aplica drift + ruido gaussiano sigma em N steps
 *   - Final price = ultimo close * exp(sum dos log returns simulados)
 *
 * Default: 5.000 simulacoes em 20 candles a frente — tempo de execucao ~50ms.
 * Vortex anuncia 15k mas 5k ja tem precisao estatistica suficiente (CI 95%).
 *
 * Retorna:
 *   - Cenario otimista (percentil 90)
 *   - Mediana (percentil 50)
 *   - Cenario pessimista (percentil 10)
 *   - Win rate por direcao (% de caminhos que ficaram acima/abaixo do preco atual)
 *   - Volatilidade implicita (sigma anualizada)
 */
import type { Candle } from "@/lib/market/types";

export interface MonteCarloResult {
  /** Numero de simulacoes rodadas */
  simulations: number;
  /** Quantos candles (steps) projetados a frente */
  horizonCandles: number;
  /** Preco atual (ultimo close) */
  currentPrice: number;

  /** Percentil 90 — cenario otimista (10% dos caminhos chegaram aqui ou mais) */
  optimistic: number;
  /** Percentil 50 — cenario mediano */
  median: number;
  /** Percentil 10 — cenario pessimista */
  pessimistic: number;

  /** Percentual de simulacoes que terminaram ACIMA do preco atual */
  winRateUp: number;
  /** Percentual de simulacoes que terminaram ABAIXO do preco atual */
  winRateDown: number;

  /** Sigma (volatilidade) por step. Pra cripto 1h ~ 0.5-2% */
  volatilityPerStep: number;
  /** Volatilidade anualizada (% — sigma * sqrt(steps_per_year)) */
  volatilityAnnualized: number;

  /** Drift por step (deslocamento medio esperado em log returns) */
  driftPerStep: number;

  /** Tempo de execucao em ms */
  durationMs: number;
}

/**
 * Box-Muller transform: gera numero aleatorio com distribuicao normal padrao
 * (media 0, desvio 1). Usado pra gerar o ruido gaussiano em cada step.
 */
function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Calcula log returns: ln(close[t] / close[t-1])
 * Log returns sao melhor que returns simples pra MC porque sao aditivos
 * (sum dos log returns = log do retorno acumulado).
 */
function calculateLogReturns(candles: Candle[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, x) => sum + x, 0) / arr.length;
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  const variance =
    arr.reduce((sum, x) => sum + Math.pow(x - avg, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Percentil de um array ja ordenado.
 * percentile(arr, 0.5) = mediana
 * percentile(arr, 0.9) = top 10%
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

/**
 * Roda a simulacao Monte Carlo.
 *
 * @param candles Historico de candles (precisa pelo menos 50)
 * @param horizonCandles Quantos candles projetar a frente (default 20)
 * @param simulations Numero de simulacoes (default 5.000 — bom tradeoff custo/precisao)
 * @param stepsPerYear Pra anualizar volatilidade. Default 2160 = 1h * 24 * 90 (cripto trabalha 24/7)
 */
export function runMonteCarlo(
  candles: Candle[],
  horizonCandles = 20,
  simulations = 5000,
  stepsPerYear = 2160
): MonteCarloResult {
  const t0 = Date.now();

  if (candles.length < 50) {
    const currentPrice = candles[candles.length - 1]?.close ?? 0;
    return {
      simulations: 0,
      horizonCandles,
      currentPrice,
      optimistic: currentPrice,
      median: currentPrice,
      pessimistic: currentPrice,
      winRateUp: 50,
      winRateDown: 50,
      volatilityPerStep: 0,
      volatilityAnnualized: 0,
      driftPerStep: 0,
      durationMs: Date.now() - t0,
    };
  }

  const currentPrice = candles[candles.length - 1].close;
  const logReturns = calculateLogReturns(candles);
  const drift = mean(logReturns);
  const sigma = stdDev(logReturns, drift);

  // Roda as simulacoes
  const finalPrices: number[] = new Array(simulations);
  let upCount = 0;

  for (let s = 0; s < simulations; s++) {
    let logSum = 0;
    for (let step = 0; step < horizonCandles; step++) {
      const noise = gaussian() * sigma;
      logSum += drift + noise;
    }
    const finalPrice = currentPrice * Math.exp(logSum);
    finalPrices[s] = finalPrice;
    if (finalPrice > currentPrice) upCount++;
  }

  // Ordena pra calcular percentis
  finalPrices.sort((a, b) => a - b);

  const optimistic = percentile(finalPrices, 0.9);
  const median = percentile(finalPrices, 0.5);
  const pessimistic = percentile(finalPrices, 0.1);

  const winRateUp = (upCount / simulations) * 100;
  const winRateDown = 100 - winRateUp;

  // Anualiza volatilidade
  const volatilityAnnualized = sigma * Math.sqrt(stepsPerYear) * 100;

  return {
    simulations,
    horizonCandles,
    currentPrice,
    optimistic,
    median,
    pessimistic,
    winRateUp,
    winRateDown,
    volatilityPerStep: sigma,
    volatilityAnnualized,
    driftPerStep: drift,
    durationMs: Date.now() - t0,
  };
}
