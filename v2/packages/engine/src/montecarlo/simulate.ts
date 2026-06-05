/**
 * Núcleo de simulação GBM (Geometric Brownian Motion), determinístico via seed.
 *
 * Uma passada gera, por trajetória, o PREÇO FINAL (endpoint) e — quando recebe
 * `levels` — o desfecho de FIRST-PASSAGE (qual barreira o preço toca primeiro).
 * Observação honesta: a passagem é avaliada nos passos discretos (fim de cada
 * candle simulado), não intra-candle — aproximação padrão de simulação discreta.
 */
import type { Candle } from "@tradeai/shared";
import { mean, sampleStdev } from "../stats";
import { mulberry32, gaussianSampler } from "../math/random";

export interface BarrierLevels {
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
}

export interface PassageCounts {
  /** Trajetórias que tocaram cada TP ANTES do stop. */
  tp1Before: number;
  tp2Before: number;
  tp3Before: number;
  /** Trajetórias que bateram o stop ANTES do TP1. */
  slBeforeTp1: number;
  /** Soma de R sob a regra "sai no TP1 ou no SL" (para R esperado). */
  sumR: number;
}

export interface SimulateResult {
  currentPrice: number;
  driftPerStep: number;
  volatilityPerStep: number;
  endpoints: number[];
  /** Presente apenas quando `levels` é passado. */
  passage?: PassageCounts;
}

export interface SimulateParams {
  candles: Candle[];
  horizon: number;
  simulations: number;
  seed: number;
  levels?: BarrierLevels;
}

/** Estima drift e sigma (por passo) a partir dos log-returns dos candles. */
export function logReturnStats(candles: Candle[]): { drift: number; sigma: number; currentPrice: number } {
  const closes = candles.map((c) => c.close);
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  return {
    drift: mean(rets),
    sigma: sampleStdev(rets),
    currentPrice: closes[closes.length - 1]!,
  };
}

export function simulate(params: SimulateParams): SimulateResult {
  const { candles, horizon, simulations, seed, levels } = params;
  const { drift, sigma, currentPrice } = logReturnStats(candles);

  const rng = mulberry32(seed);
  const gauss = gaussianSampler(rng);

  const endpoints: number[] = new Array(simulations);
  const passage: PassageCounts | undefined = levels
    ? { tp1Before: 0, tp2Before: 0, tp3Before: 0, slBeforeTp1: 0, sumR: 0 }
    : undefined;

  const risk = levels ? Math.abs(levels.entry - levels.stopLoss) : 0;
  const rr1 = levels && risk > 0 ? Math.abs(levels.tp1 - levels.entry) / risk : 0;

  for (let s = 0; s < simulations; s++) {
    let logSum = 0;
    // passos da passagem (índice do passo em que cada barreira é tocada; -1 = nunca)
    let slStep = -1;
    let tp1Step = -1;
    let tp2Step = -1;
    let tp3Step = -1;

    for (let step = 0; step < horizon; step++) {
      logSum += drift + sigma * gauss();
      if (!levels) continue;
      const price = currentPrice * Math.exp(logSum);
      if (levels.side === "buy") {
        if (slStep === -1 && price <= levels.stopLoss) slStep = step;
        if (tp1Step === -1 && price >= levels.tp1) tp1Step = step;
        if (tp2Step === -1 && price >= levels.tp2) tp2Step = step;
        if (tp3Step === -1 && price >= levels.tp3) tp3Step = step;
      } else {
        if (slStep === -1 && price >= levels.stopLoss) slStep = step;
        if (tp1Step === -1 && price <= levels.tp1) tp1Step = step;
        if (tp2Step === -1 && price <= levels.tp2) tp2Step = step;
        if (tp3Step === -1 && price <= levels.tp3) tp3Step = step;
      }
    }

    const endpoint = currentPrice * Math.exp(logSum);
    endpoints[s] = endpoint;

    if (levels && passage) {
      const before = (tpStep: number): boolean =>
        tpStep !== -1 && (slStep === -1 || tpStep <= slStep);
      if (before(tp1Step)) passage.tp1Before++;
      if (before(tp2Step)) passage.tp2Before++;
      if (before(tp3Step)) passage.tp3Before++;
      if (slStep !== -1 && (tp1Step === -1 || slStep < tp1Step)) passage.slBeforeTp1++;

      // R sob regra exit-tp1: TP1 antes do SL → +rr1; SL antes → -1; senão → endpoint
      if (tp1Step !== -1 && (slStep === -1 || tp1Step <= slStep)) {
        passage.sumR += rr1;
      } else if (slStep !== -1) {
        passage.sumR += -1;
      } else {
        const r = levels.side === "buy"
          ? (endpoint - levels.entry) / risk
          : (levels.entry - endpoint) / risk;
        passage.sumR += r;
      }
    }
  }

  return { currentPrice, driftPerStep: drift, volatilityPerStep: sigma, endpoints, passage };
}
