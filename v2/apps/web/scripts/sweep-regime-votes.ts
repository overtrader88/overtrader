/**
 * Sweep GATEADO das variantes de votos-por-regime (achado 1 da revisão
 * 05/07/2026 — Pacote C). NÃO toca produção: os flags são default false e o
 * motor 'padrao' segue como CONTROLE.
 *
 * VARIANTES PRÉ-REGISTRADAS (duas, separadamente falsificáveis, para atribuir
 * o efeito — proibido sweepar limiares novos):
 *   - fade-ranging            → signal.regimeAwareVotes=true (RSI/CCI/MFI votam
 *                               fade em RANGING, reusando mrOversold/mrOverbought
 *                               35/65 do conditional.ts; CCI inverte os ±100)
 *   - fade-ranging+trend-cls  → + signal.regimeAwareTrendClass=true (RSI/Stoch/
 *                               CCI/MFI viram 'trend' no multiplicador em TRENDING)
 * CONTROLES: DEFAULT e COND (conditionalByRegime=true — se o condicional já
 * captura o ganho, a mudança na votação é redundante e morre).
 *
 * CRITÉRIO DE PROMOÇÃO (pré-registrado): a variante só vira default se o PF
 * OOS mediano superar TANTO o DEFAULT quanto o COND, com PF em ranging
 * (byRegime) melhorado. Regra 1-SE via oosPfIqr (SE ≈ IQR/1.35/√n): empate
 * dentro de 1 SE resolve por MENOS parâmetros alterados + MAIS totalDecisive.
 *
 *   pnpm --filter @tradeai/web sweep:regime-votes
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
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h", total: 8000 },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h", total: 8000 },
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1h", total: 17000 },
  { symbol: "EURUSD", assetType: "forex", timeframe: "1h", total: 5000 },
  { symbol: "XAUUSD", assetType: "commodities", timeframe: "4h", total: 5000 },
];

function withSignal(mut: (cfg: EngineConfig) => void): EngineConfig {
  const cfg = structuredClone(DEFAULT_ENGINE_CONFIG) as EngineConfig;
  mut(cfg);
  return cfg;
}

/** Variantes FIXAS (pré-registro versionado neste arquivo — nada de grid). */
function buildVariants(): ConfigVariant[] {
  return [
    { label: "DEFAULT", config: DEFAULT_ENGINE_CONFIG },
    { label: "COND", config: withSignal((c) => { c.signal.conditionalByRegime = true; }) },
    { label: "fade-ranging", config: withSignal((c) => { c.signal.regimeAwareVotes = true; }) },
    { label: "fade-ranging+trend-cls", config: withSignal((c) => { c.signal.regimeAwareVotes = true; c.signal.regimeAwareTrendClass = true; }) },
  ];
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
  console.log("\n=== Sweep votos-por-regime (variantes gateadas — Pacote C) ===\nBuscando histórico:");
  const cases: SweepCase[] = [];
  for (const t of TARGETS) {
    const c = await fetchCase(t);
    if (c) cases.push(c);
  }
  if (cases.length === 0) { console.log("sem casos — abortando\n"); return; }

  const variants = buildVariants();
  console.log(`\nRodando ${variants.length} variantes × ${cases.length} casos...`);
  const t0 = Date.now();
  const ranked = runParamSweep(cases, variants);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);

  const pad = (s: string, n: number): string => s.padEnd(n);
  console.log(pad("variante", 26) + pad("OOS PF", 9) + pad("IQR", 7) + pad("PF rang", 9) + pad("PF trend", 10) + pad("decisivos", 11) + pad("OOS+>1", 8) + "amostra");
  for (const r of ranked) {
    const flag = r.label === "DEFAULT" ? "  ← controle" : "";
    console.log(
      pad(r.label, 26) + pad(r.oosPfMedian.toFixed(3), 9) + pad(r.oosPfIqr.toFixed(2), 7) +
      pad((r.byRegime.ranging ?? NaN).toFixed(2), 9) + pad((r.byRegime.trending ?? NaN).toFixed(2), 10) +
      pad(String(r.totalDecisive), 11) + pad(`${r.positiveOosCases}/${r.sufficientCases}`, 8) +
      `${r.sufficientCases}/${r.totalCases}` + flag,
    );
  }

  // Veredito pelo critério PRÉ-REGISTRADO (não escolher o argmax cegamente).
  console.log("\n--- Veredito (critério pré-registrado) ---");
  const by = new Map(ranked.map((r) => [r.label, r]));
  const def = by.get("DEFAULT");
  const cond = by.get("COND");
  const se = (r: { oosPfIqr: number; sufficientCases: number }): number =>
    r.sufficientCases > 0 ? r.oosPfIqr / 1.35 / Math.sqrt(r.sufficientCases) : Infinity;
  for (const lbl of ["fade-ranging", "fade-ranging+trend-cls"]) {
    const v = by.get(lbl);
    if (!v || !def || !cond) continue;
    const beatsBoth = v.oosPfMedian > def.oosPfMedian && v.oosPfMedian > cond.oosPfMedian;
    const rangingBetter = (v.byRegime.ranging ?? 0) > (def.byRegime.ranging ?? 0);
    const within1Se = Math.abs(v.oosPfMedian - def.oosPfMedian) <= se(def);
    console.log(
      `${lbl}: supera DEFAULT e COND em PF OOS? ${beatsBoth ? "SIM" : "NÃO"} | ranging melhor que DEFAULT? ${rangingBetter ? "SIM" : "NÃO"}` +
      (within1Se ? " | dentro de 1 SE do DEFAULT (empate estatístico → fica o DEFAULT, menos parâmetros)" : ""),
    );
    console.log(beatsBoth && rangingBetter && !within1Se
      ? "  → candidata a promoção (checar antes o forward do motor 'condicional' vivo — evidência grátis)."
      : "  → NÃO promove; variante descartada ou segue só como flag adormecido.");
  }
  console.log("");
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
