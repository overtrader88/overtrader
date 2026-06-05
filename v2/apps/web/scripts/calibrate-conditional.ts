/**
 * Mede a estratégia CONDICIONAL por regime (brainstorm #3) vs baseline, líquido
 * de custos, out-of-sample, cross-asset (6 cripto 4h). Veredito honesto.
 *
 *   pnpm --filter @tradeai/web calibrate:conditional
 */
import type { Timeframe } from "@tradeai/shared";
import {
  DEFAULT_ENGINE_CONFIG, runParamSweep, runCalibrationSweep,
  type ConfigVariant, type SweepCase, type EngineConfig,
} from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";

const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });

const CRYPTO_4H = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "LINKUSDT"];
const TF: Timeframe = "4h";
const TOTAL = 11000;

function variant(label: string, mut: (c: EngineConfig) => void): ConfigVariant {
  const c = structuredClone(DEFAULT_ENGINE_CONFIG) as EngineConfig;
  mut(c);
  return { label, config: c };
}

const VARIANTS: ConfigVariant[] = [
  { label: "BASELINE (votação)", config: DEFAULT_ENGINE_CONFIG },
  variant("COND", (c) => { c.signal.conditionalByRegime = true; }),
  variant("COND+RRtight", (c) => {
    c.signal.conditionalByRegime = true;
    c.risk = { ...c.risk, slMult: 1.0, tp1Mult: 1.5, tp2Mult: 2.5, tp3Mult: 3.5 };
  }),
  variant("COND+RRtight+conf5", (c) => {
    c.signal.conditionalByRegime = true;
    c.risk = { ...c.risk, slMult: 1.0, tp1Mult: 1.5, tp2Mult: 2.5, tp3Mult: 3.5 };
    c.gates.minConfluence = 5;
  }),
];

async function main(): Promise<void> {
  console.log("\n=== Condicional por regime vs baseline (cripto 4h, líquido, OOS) ===\nBuscando histórico:");
  const cases: SweepCase[] = [];
  for (const symbol of CRYPTO_4H) {
    try {
      const candles = await fetchBinanceHistory(symbol, TF, TOTAL, jsonFetcher);
      console.log(`  ${symbol} ${TF}: ${candles.length}`);
      cases.push({ label: `${symbol} ${TF}`, input: { symbol, assetType: "crypto", timeframe: TF, candles } });
    } catch (e) { console.log(`  ${symbol}: FALHOU (${e instanceof Error ? e.message : e})`); }
  }
  if (cases.length === 0) { console.log("sem casos\n"); return; }

  const pad = (s: string, n: number): string => s.padEnd(n);
  const ranked = runParamSweep(cases, VARIANTS);
  console.log("\n--- Ranking (OOS PF mediano, líquido) ---");
  console.log(pad("variante", 24) + pad("OOS PF", 9) + pad("IS PF", 8) + pad("OOS WR", 9) + "positivos/amostra");
  for (const r of ranked) {
    console.log(pad(r.label, 24) + pad(r.oosPfMedian.toFixed(3), 9) + pad(r.isPfMedian.toFixed(2), 8) +
      pad((r.oosWinRateMedian * 100).toFixed(1) + "%", 9) + `${r.positiveOosCases}/${r.sufficientCases}`);
  }

  // Per-asset: baseline vs melhor condicional
  const bestCond = VARIANTS.find((v) => v.label === "COND+RRtight")!;
  for (const [name, cfg] of [["BASELINE", DEFAULT_ENGINE_CONFIG], ["COND+RRtight", bestCond.config]] as const) {
    const rep = runCalibrationSweep(cases, { config: cfg });
    console.log(`\n--- Por ativo · ${name} ---`);
    console.log(pad("ativo", 14) + pad("decis.", 8) + pad("PF", 8) + pad("winRate", 9) + "OOS⊂IC");
    for (const c of rep.cases) {
      console.log(pad(c.label, 14) + pad(String(c.decisiveTrades), 8) + pad(c.profitFactor.toFixed(2), 8) +
        pad((c.winRate * 100).toFixed(1) + "%", 9) + (c.oosWithinCI === null ? "—" : c.oosWithinCI ? "sim" : "NAO"));
    }
  }

  const base = ranked.find((r) => r.label.startsWith("BASELINE"));
  const winners = ranked.filter((r) => r.sufficientCases === cases.length && r.positiveOosCases === r.sufficientCases && r.oosPfMedian > 1);
  console.log("\n--- Veredito (líquido, OOS) ---");
  console.log(`Baseline OOS PF: ${base?.oosPfMedian.toFixed(3)} (positivos ${base?.positiveOosCases}/${base?.sufficientCases})`);
  if (winners.length) {
    const w = winners[0]!;
    const delta = base ? w.oosPfMedian - base.oosPfMedian : 0;
    console.log(`Melhor robusto (positivo em TODAS as ${cases.length}): ${w.label} → OOS PF ${w.oosPfMedian.toFixed(3)} (Δ vs baseline ${delta >= 0 ? "+" : ""}${delta.toFixed(3)})`);
    console.log(delta > 0.05 ? "→ Condicional MELHOROU o edge de forma robusta. Vale aprofundar (walk-forward, mais ativos)." : "→ Ganho marginal/empate — não conclui melhora clara.");
  } else {
    console.log("→ NENHUMA variante condicional é robustamente positiva cross-asset. Hipótese #3 não se confirmou nesses dados.");
  }
  console.log("");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
