/**
 * 8 gates de qualidade (A–H), dirigidos pelo `EngineConfig`.
 *
 * Cada gate carrega `calibrated: false` enquanto o threshold for herdado do v1
 * sem estudo empírico — honestidade explícita. A calibração entra no M2.
 */
import type { Candle } from "@tradeai/shared";
import { isActionable } from "@tradeai/shared";
import type { EngineConfig } from "../config";
import type { GateResult, IndicatorResult, RiskOutput, SignalOutput } from "../types";
import type { RegimeInfo } from "../regime";

function avgVolume(candles: Candle[], n: number): number {
  const slice = candles.slice(-n);
  if (slice.length === 0) return 0;
  let s = 0;
  for (const c of slice) s += c.volume;
  return s / slice.length;
}

export function computeGates(
  candles: Candle[],
  signal: SignalOutput,
  indicators: IndicatorResult[],
  risk: RiskOutput,
  regimeInfo: RegimeInfo,
  config: EngineConfig,
): GateResult[] {
  const g = config.gates;
  const actionable = isActionable(signal.signal);
  const gates: GateResult[] = [];

  // A — Confluência mínima
  gates.push({
    id: "A",
    name: "Confluência mínima",
    passed: signal.confluence >= g.minConfluence,
    detail: `Confluência ${signal.confluence}/10 ${signal.confluence >= g.minConfluence ? "(suficiente)" : `(abaixo do mínimo de ${g.minConfluence})`}`,
  });

  // B — Tendência presente (ADX)
  const adxOk = regimeInfo.adxValue > g.minAdx;
  gates.push({
    id: "B",
    name: "Tendência presente",
    passed: adxOk,
    detail: `ADX ${regimeInfo.adxValue.toFixed(1)} ${adxOk ? `≥ ${g.minAdx}` : `< ${g.minAdx} (sem tendência clara)`}`,
  });

  // C — Volume saudável (média 10 vs 30)
  const avg10 = avgVolume(candles, 10);
  const avg30 = avgVolume(candles, 30);
  const volOk = avg10 > avg30 * 0.7;
  gates.push({
    id: "C",
    name: "Volume saudável",
    passed: volOk,
    detail: volOk ? "Volume recente próximo da média" : "Volume recente abaixo da média — possível baixa liquidez",
  });

  // D — R:R mínimo (só para sinais acionáveis)
  const rrOk = !actionable || risk.rr1 >= g.minRr1;
  gates.push({
    id: "D",
    name: `R:R mínimo 1:${g.minRr1}`,
    passed: rrOk,
    detail: !actionable ? "Não aplicável (sinal não acionável)" : `R:R ${risk.rr1.toFixed(2)} ${rrOk ? "OK" : "abaixo do mínimo"}`,
  });

  // E — Volatilidade ativa (Bollinger bandwidth)
  const bb = indicators.find((i) => i.name.startsWith("Bollinger"));
  const bw = bb && typeof bb.value === "object" ? (bb.value as { bandwidth: number }).bandwidth : 0;
  const bwOk = bw > g.minBandwidth;
  gates.push({
    id: "E",
    name: "Volatilidade ativa",
    passed: bwOk,
    detail: bwOk ? `Bandwidth ${(bw * 100).toFixed(2)}%` : "Bandas muito apertadas — espera consolidação",
  });

  // F — Força mínima (só para sinais acionáveis)
  const fOk = !actionable || signal.strength >= g.minStrength;
  gates.push({
    id: "F",
    name: "Força mínima do sinal",
    passed: fOk,
    detail: !actionable ? "Não aplicável (sinal não acionável)" : `Força ${signal.strength}/100 ${signal.strength >= g.minStrength ? "OK" : "fraca"}`,
  });

  // G — Regime adequado (bloqueia transitional)
  const regimeOk = regimeInfo.regime !== "transitional";
  gates.push({
    id: "G",
    name: "Regime de mercado",
    passed: regimeOk,
    detail:
      regimeInfo.regime === "trending" ? `Mercado em tendência (ADX ${regimeInfo.adxValue.toFixed(1)})`
        : regimeInfo.regime === "ranging" ? `Mercado lateral (ADX ${regimeInfo.adxValue.toFixed(1)}) — favorece mean-reversion`
          : regimeInfo.regime === "explosive" ? `Volatilidade explosiva (ATR ${regimeInfo.atrRatio.toFixed(2)}x média)`
            : `Regime ambíguo (ADX ${regimeInfo.adxValue.toFixed(1)}) — espera definição`,
  });

  // H — Volatilidade não explosiva
  const volNotExplosive = regimeInfo.atrRatio < config.regime.atrExplosiveRatio;
  gates.push({
    id: "H",
    name: "Volatilidade controlada",
    passed: volNotExplosive,
    detail: `ATR ${regimeInfo.atrRatio.toFixed(2)}x da média — ${volNotExplosive ? "normal" : "risco de whipsaws"}`,
  });

  return gates;
}

/** Gates considerados críticos: falhar neles faz downgrade do sinal. */
export const CRITICAL_GATE_IDS = ["A", "D"] as const;
