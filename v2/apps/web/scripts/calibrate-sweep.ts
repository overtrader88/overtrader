/**
 * Sweep de calibração de PARÂMETROS sobre histórico real longo.
 *
 * Varre um grid de configs (gates + perfil de RR) e ranqueia pelo PF
 * OUT-OF-SAMPLE (a métrica anti-overfitting). Objetivo: descobrir se ALGUMA
 * config mostra edge robusto fora da amostra — e se supera o DEFAULT.
 *
 *   pnpm --filter @tradeai/web calibrate:sweep
 *
 * AVISO: ainda NÃO modela custos (spread/corretagem/slippage). Um PF marginal
 * (~1.1) pode virar <1 com custos. Trate como exploração, não como verdade final.
 */
import { readFileSync } from "node:fs";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { DEFAULT_ENGINE_CONFIG, runParamSweep, type ConfigVariant, type SweepCase, type EngineConfig } from "@tradeai/engine";
import { getCandles, realProviders } from "../lib/market/providers";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";

function envLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
      const s = l.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) continue;
      const i = s.indexOf("=");
      out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
    }
  } catch { /* */ }
  return out;
}

const twelveDataKey = envLocal().TWELVEDATA_API_KEY || undefined;
const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });
const providers = realProviders({ twelveDataKey, timeoutMs: 20000 });

interface Target { symbol: string; assetType: AssetType; timeframe: Timeframe; total: number }
const TARGETS: Target[] = [
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", total: 17000 },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h", total: 6000 },
  { symbol: "EURUSD", assetType: "forex", timeframe: "1h", total: 5000 },
];

function buildVariants(): ConfigVariant[] {
  const rrProfiles = [
    { tag: "RRpad", risk: { slMult: 1.2, tp1Mult: 1.8, tp2Mult: 3.0, tp3Mult: 4.5 } },
    { tag: "RRtight", risk: { slMult: 1.0, tp1Mult: 1.5, tp2Mult: 2.5, tp3Mult: 3.5 } },
    { tag: "RRwide", risk: { slMult: 1.5, tp1Mult: 2.5, tp2Mult: 4.0, tp3Mult: 6.0 } },
  ];
  const confs = [5, 6, 7];
  const adxs = [20, 25];
  const variants: ConfigVariant[] = [
    { label: "DEFAULT", config: DEFAULT_ENGINE_CONFIG },
  ];
  for (const rr of rrProfiles) {
    for (const c of confs) {
      for (const a of adxs) {
        const cfg = structuredClone(DEFAULT_ENGINE_CONFIG) as EngineConfig;
        cfg.gates.minConfluence = c;
        cfg.gates.minAdx = a;
        cfg.risk = { ...cfg.risk, ...rr.risk };
        variants.push({ label: `conf${c}/adx${a}/${rr.tag}`, config: cfg });
      }
    }
  }
  return variants;
}

async function fetchCase(t: Target): Promise<SweepCase | null> {
  try {
    const candles = t.assetType === "crypto"
      ? await fetchBinanceHistory(t.symbol, t.timeframe, t.total, jsonFetcher)
      : await getCandles(t.symbol, t.assetType, t.timeframe, t.total, { providers, minCandles: 220 });
    console.log(`  ${t.symbol} ${t.timeframe}: ${candles.length} candles`);
    return { label: `${t.symbol} ${t.timeframe}`, input: { symbol: t.symbol, assetType: t.assetType, timeframe: t.timeframe, candles } };
  } catch (e) {
    console.log(`  ${t.symbol} ${t.timeframe}: FALHOU (${e instanceof Error ? e.message : e})`);
    return null;
  }
}

async function main(): Promise<void> {
  console.log("\n=== Sweep de calibração (histórico real) ===\nBuscando histórico:");
  const cases: SweepCase[] = [];
  for (const t of TARGETS) {
    const c = await fetchCase(t);
    if (c) cases.push(c);
  }
  if (cases.length === 0) { console.log("sem casos — abortando\n"); return; }

  const variants = buildVariants();
  console.log(`\nRodando ${variants.length} configs × ${cases.length} casos...`);
  const t0 = Date.now();
  const ranked = runParamSweep(cases, variants);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  const pad = (s: string, n: number): string => s.padEnd(n);
  console.log(pad("config", 22) + pad("OOS PF (med)", 14) + pad("IS PF", 9) + pad("OOS WR", 9) + pad("OOS+>1", 8) + "amostra");
  for (const r of ranked) {
    const flag = r.label === "DEFAULT" ? "  ← default" : "";
    console.log(
      pad(r.label, 22) + pad(r.oosPfMedian.toFixed(3), 14) + pad(r.isPfMedian.toFixed(2), 9) +
      pad((r.oosWinRateMedian * 100).toFixed(1) + "%", 9) +
      pad(`${r.positiveOosCases}/${r.sufficientCases}`, 8) + `${r.sufficientCases}/${r.totalCases}` + flag,
    );
  }
  // Veredito honesto: só vale config com COBERTURA TOTAL dos casos (sem a
  // armadilha de derrubar os casos difíceis pra "melhorar" o PF).
  console.log("\n--- Veredito (OUT-OF-SAMPLE, LÍQUIDO de custos) ---");
  const fullCoverage = ranked.filter((r) => r.sufficientCases === r.totalCases);
  const robust = fullCoverage.filter((r) => r.positiveOosCases === r.sufficientCases && r.oosPfMedian > 1.0);
  console.log(`Configs com cobertura total (${cases.length}/${cases.length} casos): ${fullCoverage.length}/${ranked.length}`);
  if (robust.length > 0) {
    const b = robust[0]!;
    console.log(`Config positiva em TODOS os casos cobertos: ${b.label} → OOS PF ${b.oosPfMedian.toFixed(3)}`);
    console.log("→ Há edge líquido robusto modesto — vale aprofundar (mais ativos, walk-forward por janela).");
  } else {
    const bestFull = fullCoverage[0];
    console.log("NENHUMA config é positiva em todos os casos quando líquida de custos.");
    if (bestFull) console.log(`Melhor com cobertura total: ${bestFull.label} → OOS PF ${bestFull.oosPfMedian.toFixed(3)} (${bestFull.positiveOosCases}/${bestFull.sufficientCases} positivos)`);
    console.log("Leitura honesta: o sinal, como está, NÃO tem edge líquido robusto. Os 'survivors' são timeframes altos (4h+), e marginalmente.");
  }
  console.log("");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
