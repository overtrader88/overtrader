/**
 * MEDIÇÃO (Pacote B, achado 6 — FASE 1, risco zero em prod): auditoria do
 * BIND-RATE dos 8 gates (A–H) por replay histórico multi-ativo. Gate com
 * pass-rate >95% não filtra nada (é ruído de UI / falsa checagem) — critério
 * pré-registrado do achado 6. Read-only: mesma matemática do backtest
 * (replay incremental com paridade testada), nenhum motor tocado.
 *
 *   pnpm --filter @tradeai/web measure:gates
 */
import { isActionable, signalSide, type Timeframe, type AssetType, type Candle } from "@tradeai/shared";
import {
  DEFAULT_ENGINE_CONFIG, precomputeBase, indicatorValuesAt, regimeAt,
  buildIndicatorResults, computeSignal, computeRiskFrom, computeGates, CRITICAL_GATE_IDS,
} from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";
import { getCandles, realProviders } from "../lib/market/providers";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();
const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });
const START = DEFAULT_ENGINE_CONFIG.backtest.minCandlesForEngine; // 200
const GATE_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const GATE_NAMES: Record<string, string> = {
  A: "Confluência mínima", B: "Tendência (ADX)", C: "Volume saudável", D: "R:R mínimo",
  E: "Volatilidade ativa", F: "Força mínima", G: "Regime adequado", H: "Vol. não explosiva",
};

interface CaseDef { symbol: string; assetType: AssetType; tf: Timeframe; total: number }
const CASES: CaseDef[] = [
  { symbol: "BTCUSDT", assetType: "crypto", tf: "4h", total: 11000 },
  { symbol: "ETHUSDT", assetType: "crypto", tf: "4h", total: 11000 },
  { symbol: "SOLUSDT", assetType: "crypto", tf: "4h", total: 9000 },
  { symbol: "BTCUSDT", assetType: "crypto", tf: "1d", total: 2600 },
  { symbol: "ETHUSDT", assetType: "crypto", tf: "1d", total: 2600 },
  // Não-cripto (TwelveData; precisa de TWELVEDATA_API_KEY — falha vira skip)
  { symbol: "XAUUSD", assetType: "commodities", tf: "4h", total: 3000 },
  { symbol: "EURUSD", assetType: "forex", tf: "4h", total: 3000 },
  { symbol: "SPX", assetType: "indices", tf: "4h", total: 3000 },
  { symbol: "XAUUSD", assetType: "commodities", tf: "1d", total: 2000 },
  { symbol: "EURUSD", assetType: "forex", tf: "1d", total: 2000 },
  { symbol: "SPX", assetType: "indices", tf: "1d", total: 2000 },
];

interface Tally { total: number; pass: Record<string, number>; passActionable: Record<string, number>; actionable: number; downgraded: number }
const newTally = (): Tally => ({
  total: 0,
  pass: Object.fromEntries(GATE_IDS.map((g) => [g, 0])),
  passActionable: Object.fromEntries(GATE_IDS.map((g) => [g, 0])),
  actionable: 0, downgraded: 0,
});

function scan(candles: Candle[], tally: Tally): void {
  const cfg = DEFAULT_ENGINE_CONFIG;
  const base = precomputeBase(candles);
  for (let i = START; i < candles.length; i++) {
    const values = indicatorValuesAt(candles, i, base);
    const indicators = buildIndicatorResults(values, cfg);
    const regimeInfo = regimeAt(i, base, cfg);
    const signal = computeSignal(indicators, cfg, regimeInfo.regime);
    const risk = computeRiskFrom(values.lastClose, base.atr14[i - 1] ?? NaN, signal.signal, cfg);
    const volWindow = candles.slice(Math.max(0, i - 29), i + 1);
    const gates = computeGates(volWindow, signal, indicators, risk, regimeInfo, cfg);
    const actionable = isActionable(signal.signal) && signalSide(signal.signal) !== "neutral";
    tally.total++;
    if (actionable) tally.actionable++;
    let criticalFail = false;
    for (const g of gates) {
      if (g.passed) {
        tally.pass[g.id] = (tally.pass[g.id] ?? 0) + 1;
        if (actionable) tally.passActionable[g.id] = (tally.passActionable[g.id] ?? 0) + 1;
      } else if ((CRITICAL_GATE_IDS as readonly string[]).includes(g.id) && actionable) {
        criticalFail = true;
      }
    }
    if (criticalFail) tally.downgraded++;
  }
}

async function main(): Promise<void> {
  console.log("\n=== Bind-rate dos 8 gates (replay histórico multi-ativo) ===");
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const global = newTally();
  const perCase: { label: string; tally: Tally }[] = [];

  for (const cs of CASES) {
    let candles: Candle[];
    try {
      candles = cs.assetType === "crypto"
        ? await fetchBinanceHistory(cs.symbol, cs.tf, cs.total, jsonFetcher)
        : await getCandles(cs.symbol, cs.assetType, cs.tf, cs.total, { providers, minCandles: 300 });
    } catch (e) {
      console.log(`  ${cs.symbol} ${cs.tf}: FALHOU (${e instanceof Error ? e.message : e})`);
      continue;
    }
    if (candles.length < START + 50) { console.log(`  ${cs.symbol} ${cs.tf}: só ${candles.length} candles — pulado`); continue; }
    const t = newTally();
    scan(candles, t);
    scan(candles, global);
    perCase.push({ label: `${cs.symbol} ${cs.tf}`, tally: t });
    console.log(`  ${cs.symbol} ${cs.tf}: ${candles.length} candles, ${t.total} análises`);
  }
  if (global.total === 0) { console.log("sem dados\n"); return; }

  const pct = (n: number, d: number): string => (d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—");
  console.log("\n--- Pass-rate por gate (AGREGADO; 'acionável' = sinal BUY/SELL antes do downgrade) ---");
  console.log("gate".padEnd(6) + "nome".padEnd(22) + "pass geral".padEnd(13) + "pass acionável".padEnd(16) + ">95%?");
  for (const g of GATE_IDS) {
    const overall = (global.pass[g] ?? 0) / global.total;
    const act = global.actionable > 0 ? (global.passActionable[g] ?? 0) / global.actionable : 0;
    console.log(
      g.padEnd(6) + GATE_NAMES[g]!.padEnd(22) + pct(global.pass[g] ?? 0, global.total).padEnd(13) +
      pct(global.passActionable[g] ?? 0, global.actionable).padEnd(16) +
      (overall > 0.95 && act > 0.95 ? "SIM — não filtra nada" : ""),
    );
  }
  console.log(`\nAnálises: ${global.total} · acionáveis: ${global.actionable} (${pct(global.actionable, global.total)})`);
  console.log(`Downgrade por gate crítico (A/D) em acionáveis: ${pct(global.downgraded, global.actionable)}`);

  console.log("\n--- Pass-rate por caso (gate: geral | acionável) ---");
  console.log("caso".padEnd(14) + GATE_IDS.map((g) => g.padStart(12)).join(""));
  for (const c of perCase) {
    const cells = GATE_IDS.map((g) => {
      const o = pct(c.tally.pass[g] ?? 0, c.tally.total);
      const a = pct(c.tally.passActionable[g] ?? 0, c.tally.actionable);
      return `${o}|${a}`.padStart(12);
    });
    console.log(c.label.padEnd(14) + cells.join(""));
  }
  console.log("\nCritério pré-registrado (achado 6): gate com pass-rate >95% é recalibrado ou");
  console.log("removido — mas SÓ com esta medição em mãos; nada foi alterado nos motores.\n");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
