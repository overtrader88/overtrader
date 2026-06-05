import { describe, expect, it } from "vitest";
import type { Candle } from "@tradeai/shared";
import {
  crossSectionalMomentum, walkForwardCrossSectional,
  type CsAsset, type CrossSectionalOptions, type WalkForwardOptions, type WalkForwardConfig,
} from "../src/cross-sectional";

const STEP = 4 * 3_600_000;

function asset(symbol: string, n: number, rate: number, start = 100): CsAsset {
  const candles: Candle[] = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    candles.push({ time: i * STEP, open: p, high: p * 1.001, low: p * 0.999, close: p, volume: 1000 });
    p *= 1 + rate;
  }
  return { symbol, candles };
}

const OPTS: CrossSectionalOptions = {
  assetType: "crypto", timeframe: "4h",
  lookback: 10, skip: 0, rebalanceEvery: 5, topK: 1, longShort: false,
  costBps: 7.5, shortFundingAnnualPct: 10, oosFraction: 0.3,
};

describe("crossSectionalMomentum", () => {
  it("long-only escolhe o de maior momentum (que continua subindo) → positivo", () => {
    const a = [asset("UP", 200, 0.01), asset("FLAT", 200, 0), asset("DOWN", 200, -0.01)];
    const r = crossSectionalMomentum(a, OPTS);
    expect(r.full.periods).toBeGreaterThan(20);
    expect(r.full.meanPeriodReturn.value).toBeGreaterThan(0);
    expect(r.full.winRate.value).toBeGreaterThan(0.8);
  });

  it("long-short é mais positivo que long-only no basket UP/DOWN", () => {
    const a = [asset("UP", 200, 0.01), asset("FLAT", 200, 0), asset("DOWN", 200, -0.01)];
    const lo = crossSectionalMomentum(a, OPTS);
    const ls = crossSectionalMomentum(a, { ...OPTS, longShort: true });
    expect(ls.full.meanPeriodReturn.value).toBeGreaterThan(lo.full.meanPeriodReturn.value);
  });

  it("funding do short reduz o retorno long-short", () => {
    const a = [asset("UP", 200, 0.01), asset("FLAT", 200, 0), asset("DOWN", 200, -0.01)];
    const cheap = crossSectionalMomentum(a, { ...OPTS, longShort: true, shortFundingAnnualPct: 0 });
    const pricey = crossSectionalMomentum(a, { ...OPTS, longShort: true, shortFundingAnnualPct: 50 });
    expect(pricey.full.meanPeriodReturn.value).toBeLessThan(cheap.full.meanPeriodReturn.value);
  });

  it("universo dinâmico: união de timestamps (ativo curto entra onde tem dado)", () => {
    const a = [asset("A", 200, 0.005), asset("B", 120, 0.003), asset("C", 200, -0.004)];
    const r = crossSectionalMomentum(a, OPTS);
    expect(r.alignedBars).toBe(200); // união (não interseção)
    expect(r.full.periods).toBeGreaterThan(20);
  });
});

describe("walkForwardCrossSectional", () => {
  it("escolhe config no treino e mede no teste; basket em tendência → teste positivo", () => {
    const a = [asset("UP", 400, 0.01), asset("MILD", 400, 0.003), asset("FLAT", 400, 0), asset("DOWN", 400, -0.01)];
    const wf: WalkForwardOptions = {
      assetType: "crypto", timeframe: "4h", skip: 0, rebalanceEvery: 5,
      costBps: 7.5, shortFundingAnnualPct: 10, folds: 3,
    };
    const configs: WalkForwardConfig[] = [
      { lookback: 10, topK: 1, longShort: true },
      { lookback: 20, topK: 1, longShort: true },
      { lookback: 10, topK: 2, longShort: false },
    ];
    const r = walkForwardCrossSectional(a, wf, configs);
    expect(r.test.periods).toBeGreaterThan(0);
    expect(r.chosen.length).toBeGreaterThan(0);
    expect(r.test.meanPeriodReturn.value).toBeGreaterThan(0); // tendência persistente
  });
});
