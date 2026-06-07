/**
 * MOTOR 2 — "Por classe de ativo" (PURO). NÃO altera o motor principal.
 *
 * Reaproveita os MESMOS dados reais que o Motor 1 já computou (indicadores/votos,
 * SMC, multi-timeframe, Wyckoff, Monte Carlo) e os RE-PONDERA conforme a
 * metodologia de cada família de ativo (tabela do produto): o que "manda", o que
 * "apoia", os cruzamentos-chave e os cuidados. Honesto: não inventa dado — o que
 * a classe pede e ainda não integramos aparece em `pending` (próximas ondas).
 */
import type { AssetType } from "@tradeai/shared";
import type { FullAnalysis } from "./full";
import type { BinanceDerivatives } from "@/lib/market/derivatives-binance";
import type { MacroContext } from "@/lib/market/macro-yahoo";
import type { FmpFundamental } from "@/lib/market/fmp";
import type { CotPositioning } from "@/lib/market/cot-cftc";
import type { FundamentalResult } from "@/lib/market/defillama";

/** Dados externos reais já buscados (por onda) que o Motor 2 pode usar. */
export interface ClassExtras {
  derivatives?: BinanceDerivatives | null;
  macro?: MacroContext | null;
  fundamental?: FmpFundamental | null;
  cot?: CotPositioning | null;
  onchain?: FundamentalResult | null;
}

export type EngineId = "padrao" | "classe";
export const ENGINES: { id: EngineId; label: string; hint: string }[] = [
  { id: "padrao", label: "Motor padrão", hint: "Ponderação geral (15 camadas)" },
  { id: "classe", label: "Motor por classe", hint: "Metodologia por família de ativo" },
];
export function isEngine(v: unknown): v is EngineId {
  return v === "padrao" || v === "classe";
}

/** Pesos por categoria de indicador + camadas, por classe. 0 = não pesa. */
interface ClassWeights {
  // categorias de indicadores (do motor)
  "Médias Móveis": number;
  Osciladores: number;
  Tendência: number;
  Volatilidade: number;
  Volume: number;
  // camadas
  smc: number;
  mtf: number;
  wyckoff: number;
  montecarlo: number;
}

export interface ClassMethodology {
  label: string;
  manda: string;
  apoio: string;
  cruzamentos: string;
  cuidados: string;
  weights: ClassWeights;
  /** dados recomendados pela classe que ainda NÃO integramos (honestidade). */
  pending: string[];
}

const W = (p: Partial<ClassWeights>): ClassWeights => ({
  "Médias Móveis": 1, Osciladores: 1, Tendência: 1, Volatilidade: 1, Volume: 1,
  smc: 1, mtf: 1, wyckoff: 1, montecarlo: 1, ...p,
});

export const CLASS_METHODOLOGY: Record<AssetType, ClassMethodology> = {
  crypto: {
    label: "Cripto",
    manda: "TA completa (estrutura + tendência + momentum + volume/CVD)",
    apoio: "On-chain (fluxos de exchange, MVRV) e funding/OI como sentimento",
    cruzamentos: "Estrutura + rompimento; funding+OI p/ exaustão; on-chain p/ viés macro",
    cuidados: "On-chain é ruim pra timing curto; alta alavancagem amplifica erro",
    weights: W({ Tendência: 1.6, Volume: 1.5, smc: 1.5, "Médias Móveis": 1.3, montecarlo: 0.8 }),
    pending: ["Fluxos de exchange / MVRV (on-chain avançado)", "Mapa de liquidações (CoinGlass, pago)"],
  },
  forex: {
    label: "Forex",
    manda: "Macro (juros, BC, CPI/NFP) + TA",
    apoio: "DXY, correlações (EUR/USD × DXY), COT",
    cruzamentos: "TA + calendário macro (não operar contra notícia); sessão define volatilidade",
    cuidados: "Sem funding; gap de fim de semana; spread ruim fora das sessões",
    weights: W({ Tendência: 1.6, "Médias Móveis": 1.4, mtf: 1.4, Volume: 0.5, smc: 1.1 }),
    pending: ["DXY (Yahoo — onda forex/índices)", "COT (CFTC — onda forex)", "Calendário macro (juros/CPI/NFP)"],
  },
  indices: {
    label: "Índices",
    manda: "TA + macro (juros) + breadth",
    apoio: "VIX, correlação setorial",
    cruzamentos: "Tendência + VIX (medo); breadth confirma topo/fundo",
    cuidados: "Sem 24/7; gap de abertura; risco de evento macro",
    weights: W({ Tendência: 1.6, mtf: 1.4, "Médias Móveis": 1.3, Volatilidade: 1.2 }),
    pending: ["VIX (Yahoo — onda índices)", "Breadth / advance-decline (proxy por amostra)", "Macro (juros)"],
  },
  stocks: {
    label: "Ações",
    manda: "Fundamentos (earnings, múltiplos) + TA",
    apoio: "Fluxo institucional, insider, setor",
    cruzamentos: "Tendência + volume institucional; evitar TA pura perto de earnings",
    cuidados: "Earnings quebra TA; liquidez varia; risco idiossincrático",
    weights: W({ Tendência: 1.4, Volume: 1.4, "Médias Móveis": 1.2 }),
    pending: ["Fundamentos & earnings (FMP — onda ações)", "Insider / fluxo institucional", "Calendário de earnings"],
  },
  commodities: {
    label: "Commodities",
    manda: "Oferta/demanda física + macro/geopolítica + TA",
    apoio: "COT, DXY, sazonalidade",
    cruzamentos: "Ouro × DXY e juros reais (inverso); petróleo × estoques/OPEP",
    cuidados: "Sazonalidade; rollover de contratos; choque geopolítico",
    weights: W({ Tendência: 1.5, "Médias Móveis": 1.3, mtf: 1.3, Volume: 0.6 }),
    pending: ["COT (CFTC — onda commodities)", "Estoques (EIA — petróleo/gás)", "DXY (Yahoo)"],
  },
};

export interface ClassFactor { label: string; side: "bull" | "bear" | "neu"; weight: number; }
export interface ClassReading {
  side: "buy" | "sell" | "neutral";
  score: number;        // 0–100 (confiança da leitura por classe)
  label: string;
  factors: ClassFactor[];
  agree: string[];
  against: string[];
  methodology: ClassMethodology;
  /** itens de `pending` que ainda faltam (após remover os já integrados). */
  stillPending: string[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Re-pondera os dados REAIS do dto conforme a metodologia da classe. */
export function computeClassReading(dto: FullAnalysis, assetType: AssetType, extras?: ClassExtras): ClassReading {
  const m = CLASS_METHODOLOGY[assetType] ?? CLASS_METHODOLOGY.crypto;
  const w = m.weights;
  const factors: ClassFactor[] = [];
  const integrated = new Set<string>(); // rótulos de `pending` já cobertos por dado real

  // 1) Indicadores reais, agrupados por categoria, ponderados pela classe.
  const byCat = new Map<string, number>();
  for (const ind of dto.analysis?.indicators ?? []) {
    const v = ind.vote === "BUY" ? 1 : ind.vote === "SELL" ? -1 : 0;
    byCat.set(ind.category, (byCat.get(ind.category) ?? 0) + v);
  }
  for (const [cat, net] of byCat) {
    const weight = (w as unknown as Record<string, number>)[cat] ?? 1;
    if (weight > 0 && net !== 0) factors.push({ label: cat, side: net > 0 ? "bull" : "bear", weight });
  }

  // 2) Camadas (SMC, MTF, Wyckoff, Monte Carlo) — sinais reais já calculados.
  if (dto.smc && w.smc > 0) {
    const b = dto.smc.bias;
    if (b !== "neutral") factors.push({ label: "SMC institucional", side: b === "bullish" ? "bull" : "bear", weight: w.smc });
  }
  if (dto.multiTimeframe && w.mtf > 0) {
    const cs = dto.multiTimeframe.confluenceScore;
    if (cs >= 60 || cs <= 40) factors.push({ label: `Multi-timeframe (${cs}%)`, side: cs >= 60 ? (dto.multiTimeframe.alignment.includes("bear") ? "bear" : "bull") : "neu", weight: w.mtf });
  }
  if (dto.wegd?.wyckoff && w.wyckoff > 0) {
    const ph = dto.wegd.wyckoff.phase;
    const side = ph === "accumulation" || ph === "markup" ? "bull" : ph === "distribution" || ph === "markdown" ? "bear" : "neu";
    if (side !== "neu") factors.push({ label: "Wyckoff", side, weight: w.wyckoff });
  }
  if (dto.montecarlo && w.montecarlo > 0) {
    const up = dto.montecarlo.winRateUp.value * 100;
    if (up >= 55 || up <= 45) factors.push({ label: "Monte Carlo", side: up >= 55 ? "bull" : "bear", weight: w.montecarlo });
  }

  // 2b) Derivativos cripto (funding / OI / long-short) — sentimento e exaustão.
  const d = extras?.derivatives;
  if (d) {
    integrated.add("Funding & Open Interest (Binance — onda cripto)");
    // Funding extremo = lado lotado → leitura CONTRÁRIA (exaustão).
    if (d.fundingAnnualizedPct > 30) factors.push({ label: `Funding alto (${d.fundingAnnualizedPct.toFixed(0)}% a.a. — longs lotados)`, side: "bear", weight: 0.8 });
    else if (d.fundingAnnualizedPct < -10) factors.push({ label: `Funding negativo (${d.fundingAnnualizedPct.toFixed(0)}% a.a. — shorts lotados)`, side: "bull", weight: 0.8 });
    // Razão de contas long/short extrema → contrária.
    if (d.longShortRatio != null) {
      if (d.longShortRatio >= 1.8) factors.push({ label: `Contas muito compradas (L/S ${d.longShortRatio.toFixed(2)})`, side: "bear", weight: 0.6 });
      else if (d.longShortRatio <= 0.7) factors.push({ label: `Contas muito vendidas (L/S ${d.longShortRatio.toFixed(2)})`, side: "bull", weight: 0.6 });
    }
  }

  // 2c) Macro (DXY p/ forex & commodities; VIX p/ índices) — relação direcional.
  const macro = extras?.macro;
  if (macro?.dxy != null) {
    const dxyUp = macro.dxy.changePct;
    if (assetType === "forex") {
      integrated.add("DXY (Yahoo — onda forex/índices)");
      const sym = (dto.analysis?.meta?.asset ?? "").toUpperCase().replace(/[^A-Z]/g, "");
      const base = sym.slice(0, 3), quote = sym.slice(3, 6);
      // par cotado em USD (EURUSD) é INVERSO ao DXY; par com USD na base (USDJPY) acompanha.
      const inverse = quote === "USD";
      const aligned = base === "USD";
      if ((inverse || aligned) && Math.abs(dxyUp) >= 0.25) {
        const dollarStrong = dxyUp > 0;
        const bullForAsset = aligned ? dollarStrong : !dollarStrong;
        factors.push({ label: `DXY ${dxyUp >= 0 ? "+" : ""}${dxyUp.toFixed(2)}% (dólar ${dollarStrong ? "forte" : "fraco"})`, side: bullForAsset ? "bull" : "bear", weight: 1.0 });
      }
    } else if (assetType === "commodities") {
      integrated.add("DXY (Yahoo)");
      // commodities cotadas em USD: dólar forte = vento contra (inverso).
      if (Math.abs(dxyUp) >= 0.25) factors.push({ label: `DXY ${dxyUp >= 0 ? "+" : ""}${dxyUp.toFixed(2)}% (dólar ${dxyUp > 0 ? "forte" : "fraco"})`, side: dxyUp > 0 ? "bear" : "bull", weight: 0.8 });
    }
  }
  if (macro?.vix != null && assetType === "indices") {
    integrated.add("VIX (Yahoo — onda índices)");
    const v = macro.vix;
    // VIX subindo = risk-off (baixa p/ índices); caindo = risk-on (alta).
    if (Math.abs(v.changePct) >= 3) factors.push({ label: `VIX ${v.changePct >= 0 ? "+" : ""}${v.changePct.toFixed(1)}% (${v.changePct > 0 ? "medo subindo" : "medo recuando"})`, side: v.changePct > 0 ? "bear" : "bull", weight: 1.0 });
  }

  // 2d) Fundamentos (ações) — qualidade/crescimento como viés lento.
  const fnd = extras?.fundamental;
  if (fnd && assetType === "stocks") {
    integrated.add("Fundamentos & earnings (FMP — onda ações)");
    if (fnd.revenueGrowthYoY != null && Math.abs(fnd.revenueGrowthYoY) >= 0.05) {
      factors.push({ label: `Receita YoY ${fnd.revenueGrowthYoY >= 0 ? "+" : ""}${(fnd.revenueGrowthYoY * 100).toFixed(0)}%`, side: fnd.revenueGrowthYoY > 0 ? "bull" : "bear", weight: 0.8 });
    }
    if (fnd.netMarginTTM != null && fnd.netMarginTTM < 0) {
      factors.push({ label: "Margem líquida negativa", side: "bear", weight: 0.6 });
    }
    if (fnd.roeTTM != null) {
      if (fnd.roeTTM >= 0.15) factors.push({ label: `ROE alto (${(fnd.roeTTM * 100).toFixed(0)}%)`, side: "bull", weight: 0.5 });
      else if (fnd.roeTTM < 0) factors.push({ label: "ROE negativo", side: "bear", weight: 0.5 });
    }
  }

  // 2e) COT (forex & commodities) — posicionamento dos grandes especuladores.
  const cot = extras?.cot;
  if (cot && (assetType === "forex" || assetType === "commodities")) {
    if (assetType === "forex") integrated.add("COT (CFTC — onda forex)");
    if (assetType === "commodities") integrated.add("COT (CFTC — onda commodities)");
    if (cot.bias !== "neutral") {
      const pct = (cot.netPctOfOi * 100).toFixed(0);
      factors.push({ label: `COT specs ${cot.netPctOfOi > 0 ? "comprados" : "vendidos"} (${pct}% do OI${cot.extreme ? " · esticado" : ""})`, side: cot.bias === "bull" ? "bull" : "bear", weight: cot.extreme ? 0.5 : 0.7 });
    }
  }

  // 2f) On-chain (cripto) — tendência de TVL da rede (adoção). Contexto lento.
  const oc = extras?.onchain;
  if (oc && assetType === "crypto" && (oc.applicability === "chain" || oc.applicability === "limited") && oc.tvlTrend && oc.tvlTrend !== "stable") {
    const weak = oc.applicability === "limited";
    factors.push({ label: `TVL on-chain ${oc.tvlTrend === "rising" ? "subindo" : "caindo"}${oc.tvlChange30dPct != null ? ` (${oc.tvlChange30dPct >= 0 ? "+" : ""}${oc.tvlChange30dPct}% 30d)` : ""}`, side: oc.tvlTrend === "rising" ? "bull" : "bear", weight: weak ? 0.3 : 0.5 });
  }

  // 3) Score ponderado.
  let net = 0, total = 0;
  for (const f of factors) {
    total += f.weight;
    net += (f.side === "bull" ? 1 : f.side === "bear" ? -1 : 0) * f.weight;
  }
  const ratio = total > 0 ? net / total : 0; // -1..1
  const side: ClassReading["side"] = ratio > 0.12 ? "buy" : ratio < -0.12 ? "sell" : "neutral";
  const score = clamp(Math.round(50 + ratio * 50));

  const dir = side === "buy" ? "bull" : side === "sell" ? "bear" : "neu";
  const agree = factors.filter((f) => f.side === dir).map((f) => f.label);
  const against = factors.filter((f) => f.side !== "neu" && f.side !== dir).map((f) => f.label);

  let label: string;
  if (side === "neutral") label = "Neutro — sem consenso na classe";
  else if (against.length > agree.length) label = "Conflitante — cautela";
  else if (score >= 70 || score <= 30) label = "Forte para a classe";
  else label = "Moderado para a classe";

  const stillPending = m.pending.filter((p) => !integrated.has(p));

  return { side, score, label, factors, agree, against, methodology: m, stillPending };
}
