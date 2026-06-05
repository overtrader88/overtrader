/**
 * Momentum CROSS-SECTIONAL numa cesta AMPLIADA (~25 criptos), líquido de custos
 * (turnover + funding do short), com SWEEP (split único) e WALK-FORWARD (escolhe
 * config no passado, mede no futuro — anti-overfit de verdade).
 *
 *   pnpm --filter @tradeai/web calibrate:cs
 */
import type { Timeframe } from "@tradeai/shared";
import {
  crossSectionalMomentum, walkForwardCrossSectional,
  type CsAsset, type CrossSectionalOptions, type WalkForwardOptions, type WalkForwardConfig,
} from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";

const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });

// Cesta ampliada — pares USDT líquidos com histórico longo (universo dinâmico:
// os mais novos entram conforme listam; alignUnion cuida disso).
const BASKET = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "SOLUSDT", "LINKUSDT",
  "LTCUSDT", "BCHUSDT", "ETCUSDT", "XLMUSDT", "TRXUSDT", "EOSUSDT", "XMRUSDT", "ATOMUSDT",
  "VETUSDT", "ALGOUSDT", "MATICUSDT", "AVAXUSDT", "FILUSDT", "AAVEUSDT", "UNIUSDT", "NEOUSDT", "DASHUSDT",
];
const FUNDING = 10; // % a.a. no short (estimativa conservadora p/ perp cripto)

async function fetchBasket(tf: Timeframe, total: number): Promise<CsAsset[]> {
  const out: CsAsset[] = [];
  for (const symbol of BASKET) {
    try {
      const candles = await fetchBinanceHistory(symbol, tf, total, jsonFetcher);
      if (candles.length > 200) out.push({ symbol, candles });
    } catch { /* pula ausentes */ }
  }
  return out;
}

const pad = (s: string, n: number): string => s.padEnd(n);

async function main(): Promise<void> {
  const tf: Timeframe = "1d";
  console.log(`\n=== Cross-sectional · cesta ampliada · ${tf} (líquido: turnover + funding ${FUNDING}% short) ===`);
  const assets = await fetchBasket(tf, 2800);
  console.log(`  cesta: ${assets.length} criptos`);
  if (assets.length < 6) { console.log("cesta pequena\n"); return; }

  // ---- Sweep (split único) p/ contexto ----
  type Row = { label: string; oosSharpe: number; oosRet: number; oosWr: number };
  const rows: Row[] = [];
  for (const lb of [30, 60, 90]) for (const rb of [7, 14]) for (const topK of [3, 5]) for (const ls of [false, true]) {
    const opts: CrossSectionalOptions = {
      assetType: "crypto", timeframe: tf, lookback: lb, skip: 1, rebalanceEvery: rb, topK, longShort: ls,
      costBps: 7.5, shortFundingAnnualPct: FUNDING, oosFraction: 0.3,
    };
    const r = crossSectionalMomentum(assets, opts);
    if (r.oos) rows.push({ label: `lb${lb}/rb${rb}/k${topK}/${ls ? "LS" : "LO"}`, oosSharpe: r.oos.sharpe, oosRet: r.oos.totalReturn, oosWr: r.oos.winRate.value });
  }
  rows.sort((a, b) => b.oosSharpe - a.oosSharpe);
  console.log("\n--- Sweep (split único — sujeito a viés de seleção) top 8 ---");
  console.log(pad("config", 22) + pad("OOS Sharpe", 12) + pad("OOS ret", 10) + "OOS WR");
  for (const r of rows.slice(0, 8)) {
    console.log(pad(r.label, 22) + pad(r.oosSharpe.toFixed(2), 12) + pad((r.oosRet * 100).toFixed(1) + "%", 10) + (r.oosWr * 100).toFixed(1) + "%");
  }

  // ---- WALK-FORWARD (o veredito honesto) ----
  const wf: WalkForwardOptions = {
    assetType: "crypto", timeframe: tf, skip: 1, rebalanceEvery: 7, costBps: 7.5, shortFundingAnnualPct: FUNDING, folds: 4,
  };
  const configs: WalkForwardConfig[] = [];
  for (const lookback of [30, 60, 90]) for (const topK of [3, 5]) for (const longShort of [false, true]) {
    configs.push({ lookback, topK, longShort });
  }
  console.log(`\n--- WALK-FORWARD (${wf.folds} folds, rebalance 7d, escolhe config no treino) ---`);
  const r = walkForwardCrossSectional(assets, wf, configs);
  console.log(`Períodos de teste: ${r.test.periods}`);
  console.log(`Configs escolhidas por fold: ${r.chosen.map((c) => `f${c.fold}:lb${c.lookback}/k${c.topK}/${c.longShort ? "LS" : "LO"}`).join("  ")}`);
  console.log(`OOS (walk-forward) → Sharpe ${r.test.sharpe.toFixed(2)} · retorno ${(r.test.totalReturn * 100).toFixed(1)}% · winRate ${(r.test.winRate.value * 100).toFixed(1)}% · maxDD ${(r.test.maxDrawdown * 100).toFixed(1)}%`);
  console.log("\n--- Veredito (walk-forward, líquido) ---");
  console.log(r.test.sharpe > 1 ? "Sharpe WF > 1 → edge FORTE e generalizável. Forte candidato a produto."
    : r.test.sharpe > 0.5 ? "Sharpe WF 0.5–1 → edge MODERADO que generaliza. Promissor e defensável."
    : r.test.sharpe > 0 ? "Sharpe WF 0–0.5 → edge fraco/instável; não confiável como está."
    : "Sharpe WF ≤ 0 → NÃO generaliza fora da amostra. O 0.83 do split era viés de seleção.");
  console.log("");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
