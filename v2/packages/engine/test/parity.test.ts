import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/analysis/run";
import { precomputeBase, runAnalysisAt } from "../src/backtest/precompute";
import { DEFAULT_ENGINE_CONFIG } from "../src/config";
import type { AnalysisInput } from "../src/types";
import { seededWalk } from "./fixtures/candles";

/**
 * Paridade EXATA: o caminho incremental (runAnalysisAt + séries pré-computadas)
 * tem que produzir os MESMOS sinal/risco/regime que runAnalysis(slice). É o que
 * autoriza o backtest a usar o caminho rápido sem perder credibilidade.
 */
describe("paridade incremental × runAnalysis", () => {
  for (const seed of [1, 2, 3]) {
    it(`bate exatamente em todos os índices (seed ${seed})`, () => {
      const candles = seededWalk(700, seed);
      const input: AnalysisInput = { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", candles };
      const base = precomputeBase(candles);

      let checked = 0;
      for (let i = DEFAULT_ENGINE_CONFIG.minCandles; i < candles.length; i += 1) {
        const slow = runAnalysis({ ...input, candles: candles.slice(0, i + 1) });
        const fast = runAnalysisAt(candles, i, base, DEFAULT_ENGINE_CONFIG);

        expect(fast.signal.signal).toBe(slow.signal.signal);
        expect(fast.signal.strength).toBe(slow.signal.strength);
        expect(fast.signal.confluence).toBe(slow.signal.confluence);
        expect(fast.regime).toBe(slow.meta.regime);
        expect(fast.risk).toEqual(slow.risk);
        checked++;
      }
      expect(checked).toBeGreaterThan(400);
    });
  }
});
