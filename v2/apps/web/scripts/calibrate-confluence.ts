/**
 * Sweep de CONFLUÊNCIA sobre o sinal condicional: empilha filtros (macro EMA200,
 * volume/OBV, concordância mínima) buscando maior assertividade líquida OOS e
 * robustez cross-asset (positivo nas 6 cripto 4h). Honesto: vencedor tem que ser
 * robusto, não só o melhor número.
 *
 *   pnpm --filter @tradeai/web calibrate:confluence
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

function cond(label: string, mut: (c: EngineConfig) => void): ConfigVariant {
  const c = structuredClone(DEFAULT_ENGINE_CONFIG) as EngineConfig;
  c.signal.conditionalByRegime = true;
  mut(c);
  return { label, config: c };
}

const VARIANTS: ConfigVariant[] = [
  { label: "BASELINE", config: DEFAULT_ENGINE_CONFIG },
  cond("COND", () => {}),
  cond("COND+macro", (c) => { c.signal.filters.macroAlign = true; }),
  cond("COND+vol", (c) => { c.signal.filters.volumeConfirm = true; }),
  cond("COND+macro+vol", (c) => { c.signal.filters.macroAlign = true; c.signal.filters.volumeConfirm = true; }),
  cond("COND+macro+agree3", (c) => { c.signal.filters.macroAlign = true; c.signal.filters.minAgree = 3; }),
  cond("COND+macro+vol+agree3", (c) => { c.signal.filters.macroAlign = true; c.signal.filters.volumeConfirm = true; c.signal.filters.minAgree = 3; }),
];

async function main(): Promise<void> {
  console.log("\n=== Sweep de confluência (cripto 4h, líquido, OOS) ===\nBuscando histórico:");
  const cases: SweepCase[] = [];
  for (const symbol of CRYPTO_4H) {
    try {
      const candles = await fetchBinanceHistory(symbol, TF, TOTAL, jsonFetcher);
      console.log(`  ${symbol}: ${candles.length}`);
      cases.push({ label: `${symbol} ${TF}`, input: { symbol, assetType: "crypto", timeframe: TF, candles } });
    } catch (e) { console.log(`  ${symbol}: FALHOU (${e instanceof Error ? e.message : e})`); }
  }
  if (cases.length === 0) { console.log("sem casos\n"); return; }

  const pad = (s: string, n: number): string => s.padEnd(n);
  const ranked = runParamSweep(cases, VARIANTS);
  console.log("\n--- Ranking (OOS PF mediano, líquido) ---");
  console.log(pad("variante", 24) + pad("OOS PF", 9) + pad("OOS WR", 9) + pad("amostra", 9) + "positivos");
  for (const r of ranked) {
    console.log(pad(r.label, 24) + pad(r.oosPfMedian.toFixed(3), 9) + pad((r.oosWinRateMedian * 100).toFixed(1) + "%", 9) +
      pad(`${r.sufficientCases}/${r.totalCases}`, 9) + `${r.positiveOosCases}/${r.sufficientCases}`);
  }

  // Veredito: melhor que seja positivo em TODAS as cobertas (robusto)
  const robust = ranked.filter((r) => r.sufficientCases >= cases.length - 1 && r.positiveOosCases === r.sufficientCases && r.oosPfMedian > 1);
  const baseline = ranked.find((r) => r.label === "BASELINE");
  console.log("\n--- Veredito (líquido, OOS, robustez cross-asset) ---");
  console.log(`Baseline OOS PF ${baseline?.oosPfMedian.toFixed(3)} (positivos ${baseline?.positiveOosCases}/${baseline?.sufficientCases})`);
  if (robust.length) {
    const w = robust[0]!;
    console.log(`Melhor ROBUSTO: ${w.label} → OOS PF ${w.oosPfMedian.toFixed(3)}, WR ${(w.oosWinRateMedian * 100).toFixed(1)}%, positivo em ${w.positiveOosCases}/${w.sufficientCases}`);
    // per-asset do vencedor
    const wcfg = VARIANTS.find((v) => v.label === w.label)!.config;
    const rep = runCalibrationSweep(cases, { config: wcfg });
    console.log(`\n--- Por ativo · ${w.label} ---`);
    console.log(pad("ativo", 14) + pad("decis.", 8) + pad("PF", 8) + pad("winRate", 9) + "OOS⊂IC");
    for (const c of rep.cases) {
      console.log(pad(c.label, 14) + pad(String(c.decisiveTrades), 8) + pad(c.profitFactor.toFixed(2), 8) +
        pad((c.winRate * 100).toFixed(1) + "%", 9) + (c.oosWithinCI === null ? "—" : c.oosWithinCI ? "sim" : "NAO"));
    }
  } else {
    console.log("Nenhuma variante é robusta (positiva em ~todas). Os filtros ajudaram, mas não fecharam o caso.");
  }
  console.log("\n⚠️ Validar o vencedor com WALK-FORWARD antes de confiar — sweep grande tem viés de seleção.\n");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
