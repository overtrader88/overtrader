/**
 * Calibração com DADOS REAIS + histórico longo. Cripto via paginação Binance
 * (milhares de candles → janela 24-36m); não-cripto via TwelveData (outputsize
 * grande, limitado pelo free tier). Lê a chave do .env.local; nunca a imprime.
 *
 *   pnpm --filter @tradeai/web calibrate:real
 */
import { readFileSync } from "node:fs";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { runCalibrationSweep, type SweepCase } from "@tradeai/engine";
import { getCandles, realProviders } from "../lib/market/providers";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";

function readEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#") || !s.includes("=")) continue;
      const i = s.indexOf("=");
      out[s.slice(0, i).trim()] = s.slice(i + 1).trim();
    }
  } catch { /* sem .env.local */ }
  return out;
}

const env = readEnvLocal();
const twelveDataKey = env.TWELVEDATA_API_KEY || undefined;
const jsonFetcher = realJsonFetcher({ timeoutMs: 20000, attempts: 3 });
const providers = realProviders({ twelveDataKey, timeoutMs: 20000, attempts: 3 });

interface Target { symbol: string; assetType: AssetType; timeframe: Timeframe; total: number }
const TARGETS: Target[] = [
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", total: 17000 }, // ~24m
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h", total: 6000 },  // ~2.7a
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1d", total: 1500 },  // ~4a
  { symbol: "EURUSD", assetType: "forex", timeframe: "1h", total: 5000 },    // free tier limita
  { symbol: "AAPL", assetType: "stocks", timeframe: "1d", total: 3000 },
];

async function fetchTarget(t: Target): Promise<SweepCase | null> {
  try {
    const candles = t.assetType === "crypto"
      ? await fetchBinanceHistory(t.symbol, t.timeframe, t.total, jsonFetcher)
      : await getCandles(t.symbol, t.assetType, t.timeframe, t.total, { providers, minCandles: 220 });
    console.log(`  fetch ok: ${t.symbol} ${t.timeframe} → ${candles.length} candles`);
    return { label: `${t.symbol} ${t.timeframe}`, input: { symbol: t.symbol, assetType: t.assetType, timeframe: t.timeframe, candles } };
  } catch (err) {
    console.log(`  fetch FALHOU: ${t.symbol} ${t.timeframe} — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`\n=== Calibração REAL + histórico longo (TwelveData: ${twelveDataKey ? "ligado" : "AUSENTE"}) ===\n`);
  const cases: SweepCase[] = [];
  for (const t of TARGETS) {
    const c = await fetchTarget(t);
    if (c) cases.push(c);
  }
  if (cases.length === 0) { console.log("\nNenhum caso — abortando.\n"); return; }

  const t0 = Date.now();
  const report = runCalibrationSweep(cases);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const pad = (s: string, n: number): string => s.padEnd(n);
  console.log("\n" + pad("Caso", 16) + pad("trades", 8) + pad("decis.", 8) + pad("amostra", 9) + pad("PF", 8) + pad("winRate", 9) + pad("OOS⊂IC", 8) + "regimes");
  for (const c of report.cases) {
    console.log(
      pad(c.label, 16) + pad(String(c.totalTrades), 8) + pad(String(c.decisiveTrades), 8) +
      pad(c.sampleSufficient ? "OK" : "baixa", 9) + pad(c.profitFactor.toFixed(2), 8) +
      pad((c.winRate * 100).toFixed(1) + "%", 9) +
      pad(c.oosWithinCI === null ? "—" : c.oosWithinCI ? "sim" : "NAO", 8) + c.regimes.join(","),
    );
  }
  console.log("\n--- Agregado ---");
  console.log(`Casos: ${report.summary.n} · backtest em ${elapsed}s`);
  console.log(`Amostra suficiente: ${report.summary.sufficientPct}% (alvo >= 80%)`);
  console.log(`OOS dentro do IC: ${report.summary.oosWithinPct}% (alvo >= 70%)\n`);
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
