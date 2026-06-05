/**
 * Sinal CONDICIONAL por regime (experimento de edge — brainstorm #3).
 *
 * Tese (literatura): momentum/trend-following funciona em TENDÊNCIA; mean-reversion
 * (fade de extremos) funciona em LATERAL. A votação genérica dos 20 indicadores
 * mistura as duas semânticas e se anula. Aqui escolhemos a lógica certa por regime:
 *   - trending → segue a tendência (médias + DI + MACD na direção)
 *   - ranging  → faz fade de extremos (RSI/Bollinger/Williams/Stoch sobrev./sobrec.)
 *   - transitional/explosive → NEUTRO (não opera ruído)
 *
 * Puro e determinístico. Ativado por `config.signal.conditionalByRegime`.
 */
import type { MarketRegime, SignalOutput } from "../types";
import type { EngineConfig } from "../config";
import type { IndicatorValues } from "../indicators";
import { ratioToSignal } from "./levels";

/** +1 = condição compradora, -1 = vendedora, 0 = neutra/indefinida. */
function dir(cond: boolean, anti: boolean): -1 | 0 | 1 {
  if (cond) return 1;
  if (anti) return -1;
  return 0;
}

export function computeConditionalSignal(
  v: IndicatorValues,
  regime: MarketRegime,
  config: EngineConfig,
): SignalOutput {
  const neutral: SignalOutput = { signal: "NEUTRAL", strength: 0, confluence: 0, votes: { buy: 0, sell: 0, neutral: 0 } };
  if (regime === "transitional" || regime === "explosive") return neutral;

  const last = v.lastClose;
  let checks: Array<-1 | 0 | 1>;

  if (regime === "trending") {
    // Trend-following: tudo na direção da tendência.
    checks = [
      dir(v.ema50 > v.ema200, v.ema50 < v.ema200),
      dir(last > v.ema20, last < v.ema20),
      dir(last > v.ema50, last < v.ema50),
      dir(v.adx14.plusDI > v.adx14.minusDI, v.adx14.minusDI > v.adx14.plusDI),
      dir(v.macd.histogram > 0, v.macd.histogram < 0),
    ];
  } else {
    // ranging → mean-reversion (fade de extremos): oversold compra, overbought vende.
    const { mrOversold, mrOverbought } = config.signal;
    checks = [
      dir(v.rsi14 < mrOversold, v.rsi14 > mrOverbought),
      dir(last < v.bollinger.lower, last > v.bollinger.upper),
      dir(v.williamsR14 < -80, v.williamsR14 > -20),
      dir(v.stoch.k < 20, v.stoch.k > 80),
      dir(last < v.bollinger.middle && v.rsi14 < 45, last > v.bollinger.middle && v.rsi14 > 55),
    ];
  }

  let buy = 0;
  let sell = 0;
  for (const c of checks) {
    if (c === 1) buy++;
    else if (c === -1) sell++;
  }
  const total = buy + sell;
  if (total === 0) return { ...neutral, votes: { buy: 0, sell: 0, neutral: checks.length } };

  const ratio = buy / total;
  const side: "buy" | "sell" = buy >= sell ? "buy" : "sell";
  const agree = Math.max(buy, sell);

  // ---- Filtros de confluência (confirmações) ----
  const f = config.signal.filters;
  const fail = (): SignalOutput => ({ ...neutral, votes: { buy, sell, neutral: checks.length - total } });
  if (agree < f.minAgree) return fail();
  if (f.macroAlign && !Number.isNaN(v.ema200)) {
    if (side === "buy" && last <= v.ema200) return fail();
    if (side === "sell" && last >= v.ema200) return fail();
  }
  if (f.volumeConfirm) {
    if (side === "buy" && v.obv.slope <= 0) return fail();
    if (side === "sell" && v.obv.slope >= 0) return fail();
  }

  const signal = ratioToSignal(ratio);
  const strength = Math.round(Math.abs(ratio - 0.5) * 200);
  const confluence = Math.min(10, Math.round((agree / checks.length) * 10));

  return { signal, strength, confluence, votes: { buy, sell, neutral: checks.length - total } };
}
