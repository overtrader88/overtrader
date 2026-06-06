/**
 * Confluência AO VIVO — cruza os sinais que mais importam para uma decisão de
 * entrada e diz, em uma frase, se eles se REFORÇAM ou se CONFLITAM. PURO.
 *
 * Diferente do Setup Score (placar 0–100 com todos os sistemas), aqui o foco é a
 * leitura operacional que a IA fala ao vivo: combos de eventos Wyckoff recentes
 * (ex.: "SOS + LPS"), posição do preço frente às EMAs (20/50/200) e o bias SMC,
 * todos comparados com a direção do sinal. Ex.: "SOS + LPS + preço acima da
 * EMA50 → entrada compradora reforçada". Honesto: confirmação de contexto, não
 * probabilidade calibrada.
 */
import type { FullAnalysis } from "./full";

export interface ConfluenceFactor {
  label: string;
  side: "bull" | "bear" | "neu";
}

export interface LiveConfluence {
  side: "buy" | "sell" | "neutral";
  reinforced: boolean;          // 3+ fatores fortes alinhados ao sinal, sem contra
  agreeCount: number;
  againstCount: number;
  factors: ConfluenceFactor[];  // todos os fatores avaliados (com lado)
  verdict: string;              // ex.: "entrada compradora reforçada"
  phrase: string;               // frase pronta para narração/bullet
}

function indicatorValue(dto: FullAnalysis, nameStartsWith: string): number | null {
  const ind = dto.analysis?.indicators?.find((i) => i.name.startsWith(nameStartsWith));
  if (!ind) return null;
  const v = (ind as { value: unknown }).value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function computeLiveConfluence(dto: FullAnalysis, livePrice?: number | null): LiveConfluence {
  const sig = dto.analysis?.signal?.signal ?? "NEUTRAL";
  const side: LiveConfluence["side"] = sig.includes("BUY") ? "buy" : sig.includes("SELL") ? "sell" : "neutral";
  const dir = side === "buy" ? 1 : side === "sell" ? -1 : 0;

  const price = (livePrice && Number.isFinite(livePrice)) ? livePrice : (dto.montecarlo?.currentPrice ?? dto.analysis?.risk?.entry ?? null);
  const factors: ConfluenceFactor[] = [];
  const sideOf = (vote: number): "bull" | "bear" | "neu" => (vote > 0 ? "bull" : vote < 0 ? "bear" : "neu");

  // 1) Combo de eventos Wyckoff recentes (até os 3 últimos)
  const recent = (dto.wyckoffEvents ?? []).slice(-3);
  if (recent.length) {
    const bull = recent.filter((e) => e.side === "bull").length;
    const bear = recent.filter((e) => e.side === "bear").length;
    const net = bull - bear;
    const combo = [...new Set(recent.map((e) => e.type))].join(" + ");
    if (net !== 0) factors.push({ label: combo, side: sideOf(net) });
  }

  // 2) Preço vs EMAs (20/50/200)
  const ema20 = indicatorValue(dto, "EMA (20)");
  const ema50 = indicatorValue(dto, "EMA (50)");
  const ema200 = indicatorValue(dto, "EMA (200)");
  if (price != null && ema50 != null) factors.push({ label: `preço ${price >= ema50 ? "acima" : "abaixo"} da EMA50`, side: price >= ema50 ? "bull" : "bear" });
  if (price != null && ema200 != null) factors.push({ label: `preço ${price >= ema200 ? "acima" : "abaixo"} da EMA200`, side: price >= ema200 ? "bull" : "bear" });
  // Empilhamento das médias (tendência clara)
  if (ema20 != null && ema50 != null && ema200 != null) {
    if (ema20 > ema50 && ema50 > ema200) factors.push({ label: "EMAs empilhadas para cima", side: "bull" });
    else if (ema20 < ema50 && ema50 < ema200) factors.push({ label: "EMAs empilhadas para baixo", side: "bear" });
  }

  // 3) Bias SMC institucional
  if (dto.smc) {
    const b = dto.smc.bias;
    if (b === "bullish" || b === "bearish") factors.push({ label: `SMC ${b === "bullish" ? "comprador" : "vendedor"}`, side: b === "bullish" ? "bull" : "bear" });
  }

  // Contagem a favor / contra a direção do sinal
  let agreeCount = 0, againstCount = 0;
  const agreeLabels: string[] = [];
  if (dir !== 0) {
    for (const f of factors) {
      const v = f.side === "bull" ? 1 : f.side === "bear" ? -1 : 0;
      if (v === 0) continue;
      if (v === dir) { agreeCount++; agreeLabels.push(f.label); }
      else againstCount++;
    }
  }

  const reinforced = side !== "neutral" && agreeCount >= 3 && againstCount === 0;
  const dirWord = side === "buy" ? "compradora" : "vendedora";

  let verdict: string;
  if (side === "neutral") verdict = "sem direção definida — aguardar";
  else if (reinforced) verdict = `entrada ${dirWord} reforçada`;
  else if (againstCount > agreeCount) verdict = "sinais mistos — cautela";
  else if (agreeCount >= 2) verdict = `confluência ${dirWord} moderada`;
  else verdict = "confirmação fraca";

  let phrase: string;
  if (side === "neutral") {
    phrase = "Confirmações cruzadas: sem direção definida — sistemas sem consenso, aguardar definição.";
  } else if (agreeLabels.length) {
    const list = agreeLabels.slice(0, 3).join(", ");
    phrase = `Confirmações cruzadas: ${list} alinhados — ${verdict}.`;
  } else {
    phrase = `Confirmações cruzadas: ${verdict} (sinais não confirmam a direção).`;
  }

  return { side, reinforced, agreeCount, againstCount, factors, verdict, phrase };
}
