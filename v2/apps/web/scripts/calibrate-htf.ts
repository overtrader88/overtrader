/**
 * Calibração focada em TIMEFRAMES ALTOS (4h+) — onde o custo de transação morde
 * menos. Cesta maior de ativos, líquido de custos. Responde: "qual a
 * assertividade real do sinal no swing?".
 *
 *   pnpm --filter @tradeai/web calibrate:htf
 */
import { readFileSync } from "node:fs";
import type { AssetType, Timeframe } from "@tradeai/shared";
import {
  DEFAULT_ENGINE_CONFIG, runCalibrationSweep, runParamSweep,
  type ConfigVariant, type SweepCase, type EngineConfig,
} from "@tradeai/engine";
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
  // cripto 4h (histórico profundo)
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  { symbol: "BNBUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  { symbol: "SOLUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  { symbol: "XRPUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  { symbol: "LINKUSDT", assetType: "crypto", timeframe: "4h", total: 11000 },
  // cripto 1d
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1d", total: 2800 },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "1d", total: 2500 },
  // não-cripto 4h/1d (TwelveData free limita o tamanho)
  { symbol: "EURUSD", assetType: "forex", timeframe: "4h", total: 5000 },
  { symbol: "XAUUSD", assetType: "commodities", timeframe: "4h", total: 5000 },
  { symbol: "AAPL", assetType: "stocks", timeframe: "1d", total: 3000 },
];

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

function cryptoVariants(): ConfigVariant[] {
  const out: ConfigVariant[] = [{ label: "DEFAULT", config: DEFAULT_ENGINE_CONFIG }];
  const rr = [
    { tag: "RRpad", risk: { slMult: 1.2, tp1Mult: 1.8, tp2Mult: 3.0, tp3Mult: 4.5 } },
    { tag: "RRtight", risk: { slMult: 1.0, tp1Mult: 1.5, tp2Mult: 2.5, tp3Mult: 3.5 } },
  ];
  for (const c of [6, 7]) for (const a of [20, 25]) for (const p of rr) {
    const cfg = structuredClone(DEFAULT_ENGINE_CONFIG) as EngineConfig;
    cfg.gates.minConfluence = c; cfg.gates.minAdx = a; cfg.risk = { ...cfg.risk, ...p.risk };
    out.push({ label: `conf${c}/adx${a}/${p.tag}`, config: cfg });
  }
  return out;
}

async function main(): Promise<void> {
  console.log("\n=== Calibração 4h+ (LÍQUIDO de custos) ===\nBuscando histórico:");
  const cases: SweepCase[] = [];
  for (const t of TARGETS) { const c = await fetchCase(t); if (c) cases.push(c); }
  if (cases.length === 0) { console.log("sem casos\n"); return; }

  const report = runCalibrationSweep(cases);
  const pad = (s: string, n: number): string => s.padEnd(n);
  console.log("\n--- Por ativo (config DEFAULT) ---");
  console.log(pad("Caso", 16) + pad("decis.", 8) + pad("amostra", 9) + pad("PF", 8) + pad("winRate", 9) + "OOS⊂IC");
  let pos = 0, suf = 0;
  const pfs: number[] = [];
  for (const c of report.cases) {
    if (c.sampleSufficient) { suf++; pfs.push(c.profitFactor); if (c.profitFactor > 1) pos++; }
    console.log(pad(c.label, 16) + pad(String(c.decisiveTrades), 8) + pad(c.sampleSufficient ? "OK" : "baixa", 9) +
      pad(c.profitFactor.toFixed(2), 8) + pad((c.winRate * 100).toFixed(1) + "%", 9) + (c.oosWithinCI === null ? "—" : c.oosWithinCI ? "sim" : "NAO"));
  }
  pfs.sort((a, b) => a - b);
  const medPf = pfs.length ? (pfs.length % 2 ? pfs[(pfs.length - 1) / 2]! : (pfs[pfs.length / 2 - 1]! + pfs[pfs.length / 2]!) / 2) : 0;
  console.log(`\nAssertividade (DEFAULT, líquido): ${pos}/${suf} ativos com amostra são positivos (PF>1) · PF mediano ${medPf.toFixed(2)}`);

  // Sweep cross-asset só nas cripto 4h (conjunto comparável e com amostra)
  const crypto4h = cases.filter((c) => c.input.assetType === "crypto" && c.input.timeframe === "4h");
  if (crypto4h.length >= 3) {
    console.log(`\n--- Sweep cross-asset em ${crypto4h.length} cripto 4h (ranqueado por OOS PF) ---`);
    const ranked = runParamSweep(crypto4h, cryptoVariants());
    console.log(pad("config", 22) + pad("OOS PF", 9) + pad("IS PF", 8) + pad("OOS WR", 9) + "positivos");
    for (const r of ranked) {
      console.log(pad(r.label, 22) + pad(r.oosPfMedian.toFixed(3), 9) + pad(r.isPfMedian.toFixed(2), 8) +
        pad((r.oosWinRateMedian * 100).toFixed(1) + "%", 9) + `${r.positiveOosCases}/${r.sufficientCases}`);
    }
    const robust = ranked.filter((r) => r.sufficientCases === crypto4h.length && r.positiveOosCases === r.sufficientCases && r.oosPfMedian > 1);
    console.log(robust.length
      ? `\n→ Config robusta cross-asset (positiva em TODAS as ${crypto4h.length} cripto 4h): ${robust[0]!.label} (OOS PF ${robust[0]!.oosPfMedian.toFixed(3)})`
      : `\n→ Nenhuma config é positiva em TODAS as cripto 4h líquida de custos.`);
  }
  console.log("");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
