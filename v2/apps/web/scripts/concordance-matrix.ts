/**
 * MEDIÇÃO (Pacote B, achado 2 — FASE 1, zero mudança de produto): matriz de
 * concordância PAR-A-PAR entre os 20 votos de indicadores sobre o histórico.
 * Se EMA20/SMA50/VWMA20 concordam >95% do tempo, são ~1 indicador — e a
 * confluência 6/10 é um detector de tendência disfarçado. Read-only: replay
 * incremental (mesma matemática do backtest, paridade testada), sem tocar em
 * motor nem em amostra forward.
 *
 *   pnpm --filter @tradeai/web measure:concordance
 */
import type { Timeframe } from "@tradeai/shared";
import type { Candle } from "@tradeai/shared";
import {
  DEFAULT_ENGINE_CONFIG, precomputeBase, indicatorValuesAt, buildIndicatorResults, NAMES,
} from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";

const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });
const CRYPTO = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "LINKUSDT"];
const CASES: { symbol: string; tf: Timeframe; total: number }[] = [
  ...CRYPTO.map((symbol) => ({ symbol, tf: "4h" as Timeframe, total: 11000 })),
  ...["BTCUSDT", "ETHUSDT", "SOLUSDT"].map((symbol) => ({ symbol, tf: "1d" as Timeframe, total: 2600 })),
];
const START = DEFAULT_ENGINE_CONFIG.backtest.minCandlesForEngine; // 200 — mesmo warm-up do backtest

/** Nomes curtos p/ a matriz caber no terminal. */
const SHORT: Record<string, string> = {
  [NAMES.ema20]: "EMA20", [NAMES.ema50]: "EMA50", [NAMES.ema200]: "EMA200", [NAMES.sma50]: "SMA50",
  [NAMES.vwma20]: "VWMA20", [NAMES.rsi]: "RSI", [NAMES.macd]: "MACD", [NAMES.stoch]: "Stoch",
  [NAMES.cci]: "CCI", [NAMES.williamsR]: "W%R", [NAMES.awesome]: "AO", [NAMES.mfi]: "MFI",
  [NAMES.roc]: "ROC", [NAMES.adx]: "ADX", [NAMES.supertrend]: "SuperT", [NAMES.trix]: "TRIX",
  [NAMES.bollinger]: "Boll", [NAMES.atr]: "ATR", [NAMES.obv]: "OBV", [NAMES.cmf]: "CMF",
};

interface PairCount { both: number; agree: number }

async function main(): Promise<void> {
  console.log("\n=== Matriz de concordância par-a-par dos 20 votos (replay histórico) ===");
  let names: string[] = [];
  const pair = new Map<string, PairCount>(); // "i|j" com i<j (índices em names)
  const opinion = new Map<string, { total: number; directional: number }>();

  for (const cs of CASES) {
    let candles: Candle[];
    try {
      candles = await fetchBinanceHistory(cs.symbol, cs.tf, cs.total, jsonFetcher);
    } catch (e) {
      console.log(`  ${cs.symbol} ${cs.tf}: FALHOU (${e instanceof Error ? e.message : e})`);
      continue;
    }
    if (candles.length < START + 50) { console.log(`  ${cs.symbol} ${cs.tf}: só ${candles.length} candles — pulado`); continue; }
    const base = precomputeBase(candles);
    let scanned = 0;
    for (let i = START; i < candles.length; i++) {
      const inds = buildIndicatorResults(indicatorValuesAt(candles, i, base), DEFAULT_ENGINE_CONFIG);
      if (names.length === 0) names = inds.map((x) => x.name);
      const votes = inds.map((x) => x.vote);
      for (let a = 0; a < votes.length; a++) {
        const va = votes[a]!;
        const op = opinion.get(names[a]!) ?? { total: 0, directional: 0 };
        op.total++;
        if (va !== "NEUTRAL") op.directional++;
        opinion.set(names[a]!, op);
        if (va === "NEUTRAL") continue;
        for (let b = a + 1; b < votes.length; b++) {
          const vb = votes[b]!;
          if (vb === "NEUTRAL") continue;
          const key = `${a}|${b}`;
          const pc = pair.get(key) ?? { both: 0, agree: 0 };
          pc.both++;
          if (va === vb) pc.agree++;
          pair.set(key, pc);
        }
      }
      scanned++;
    }
    console.log(`  ${cs.symbol} ${cs.tf}: ${candles.length} candles, ${scanned} análises`);
  }
  if (names.length === 0) { console.log("sem dados\n"); return; }

  const short = (n: string): string => SHORT[n] ?? n;
  const agreePct = (a: number, b: number): number | null => {
    const pc = pair.get(a < b ? `${a}|${b}` : `${b}|${a}`);
    return pc && pc.both >= 500 ? (pc.agree / pc.both) * 100 : null;
  };

  // ---- taxa de opinião (quem vota direcional com que frequência) ----
  console.log("\n--- Taxa de opinião direcional (voto ≠ NEUTRAL) ---");
  for (const n of names) {
    const op = opinion.get(n)!;
    console.log(`  ${short(n).padEnd(8)} ${((op.directional / op.total) * 100).toFixed(1).padStart(6)}%`);
  }

  // ---- matriz compacta ----
  console.log("\n--- Matriz de concordância (%, sobre candles em que AMBOS opinaram; · = amostra <500) ---");
  const dir = names.filter((n) => (opinion.get(n)!.directional / opinion.get(n)!.total) > 0.01);
  const idxOf = new Map(names.map((n, i) => [n, i]));
  console.log("          " + dir.map((n) => short(n).padStart(7)).join(""));
  for (const na of dir) {
    const row = dir.map((nb) => {
      if (na === nb) return "   —".padStart(7);
      const p = agreePct(idxOf.get(na)!, idxOf.get(nb)!);
      return (p === null ? "·" : p.toFixed(0)).padStart(7);
    });
    console.log(short(na).padEnd(10) + row.join(""));
  }

  // ---- pares redundantes ----
  const pairs: { a: string; b: string; pct: number; n: number }[] = [];
  for (const [key, pc] of pair) {
    if (pc.both < 500) continue;
    const [ia, ib] = key.split("|").map(Number);
    pairs.push({ a: names[ia!]!, b: names[ib!]!, pct: (pc.agree / pc.both) * 100, n: pc.both });
  }
  pairs.sort((x, y) => y.pct - x.pct);
  console.log("\n--- Pares com concordância ≥90% (candidatos a 1 indicador só) ---");
  for (const p of pairs.filter((x) => x.pct >= 90)) {
    console.log(`  ${short(p.a).padEnd(8)} × ${short(p.b).padEnd(8)} ${p.pct.toFixed(1).padStart(6)}%  (n=${p.n})`);
  }
  console.log("\n--- 10 pares MAIS discordantes (informação de verdade) ---");
  for (const p of pairs.slice(-10)) {
    console.log(`  ${short(p.a).padEnd(8)} × ${short(p.b).padEnd(8)} ${p.pct.toFixed(1).padStart(6)}%  (n=${p.n})`);
  }
  console.log("\nLeitura: concordância >90-95% ⇒ os dois votos carregam a MESMA informação e a");
  console.log("confluência crua (aligned/20) os conta como evidência independente. FASE 2 (shadow");
  console.log("metric familyConfluence) só se a redundância se confirmar aqui.\n");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
