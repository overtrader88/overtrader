/**
 * Multi-Timeframe Confluence Analysis.
 *
 * Filosofia: um sinal forte em 1h vale 10x mais se 4h e D1 estiverem alinhados
 * na mesma direcao. Esse modulo roda a engine em TFs adjacentes e calcula
 * um score de confluencia.
 *
 * Como funciona:
 *   1. Identifica os 2 TFs imediatamente acima do current
 *      (ex: current=1h → higher=4h, highest=1d)
 *   2. Busca candles dos 2 TFs adicionais (via getCandles que ja tem cache)
 *   3. Roda runAnalysis em cada
 *   4. Compara sinais e calcula confluence score
 *
 * Por que async (separado da runAnalysis principal):
 *   - runAnalysis e sync, recebe candles ja carregados
 *   - Multi-TF precisa de I/O (fetch de candles adicionais)
 *   - Roda apos a analise principal, no /api/analyze
 */
import type { AssetType, Timeframe } from "@/lib/market";
import type { SignalDirection } from "./types";
import { getCandles } from "@/lib/market";
import { runAnalysis } from "./engine";
import { signalSide } from "./signal-utils";

// ============================================================
// TYPES
// ============================================================

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  signal: SignalDirection;
  strength: number;
  confluence: number;
  side: "buy" | "sell" | "neutral";
  trendDirection: "up" | "down" | "neutral";
  bias: "bullish" | "bearish" | "neutral";
}

export type AlignmentLevel =
  | "fully_aligned" //  todos os TFs concordam na mesma direcao
  | "partially_aligned" //  2 de 3 concordam
  | "divergent" //  todos diferentes
  | "neutral"; //  todos neutros ou current neutro

export interface MultiTimeframeResult {
  current: TimeframeAnalysis;
  higher: TimeframeAnalysis | null;
  highest: TimeframeAnalysis | null;
  /** 0-100. % ponderado de TFs concordando com a direcao do current */
  confluenceScore: number;
  alignment: AlignmentLevel;
  /** Texto curto pra usar na UI e no prompt LLM */
  summary: string;
}

// ============================================================
// TIMEFRAME LADDER
// ============================================================

const TF_LADDER: Timeframe[] = ["15m", "1h", "4h", "1d", "1w", "1M"];

function getHigherTimeframes(current: Timeframe): {
  higher: Timeframe | null;
  highest: Timeframe | null;
} {
  const idx = TF_LADDER.indexOf(current);
  if (idx === -1) return { higher: null, highest: null };
  return {
    higher: TF_LADDER[idx + 1] ?? null,
    highest: TF_LADDER[idx + 2] ?? null,
  };
}

// ============================================================
// ANALYZE SINGLE TIMEFRAME (helper interno)
// ============================================================

async function analyzeOneTimeframe(
  symbol: string,
  assetType: AssetType,
  timeframe: Timeframe
): Promise<TimeframeAnalysis | null> {
  try {
    const candles = await getCandles(symbol, timeframe, 250);
    if (candles.length < 60) return null;

    const result = runAnalysis({
      symbol,
      assetType,
      timeframe,
      candles,
    });

    const side = signalSide(result.signal.signal);

    // Tendencia de longo prazo via EMA200 (ja existe nos indicadores)
    const ema200 = result.indicators.find((i) => i.name === "EMA (200)");
    const trendDirection: "up" | "down" | "neutral" = ema200
      ? ema200.vote === "BUY"
        ? "up"
        : ema200.vote === "SELL"
          ? "down"
          : "neutral"
      : "neutral";

    // Bias institucional via SMC (se disponivel)
    const bias = result.smc?.bias ?? "neutral";

    return {
      timeframe,
      signal: result.signal.signal,
      strength: result.signal.strength,
      confluence: result.signal.confluence,
      side,
      trendDirection,
      bias,
    };
  } catch (err) {
    console.warn(
      `[multi-tf] falha em ${symbol} ${timeframe}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ============================================================
// CONFLUENCE SCORING
// ============================================================

/**
 * Calcula score 0-100 com base no alinhamento entre os TFs.
 *
 * Heuristica:
 *   - Same side em todos (current + higher + highest)         → 100
 *   - Same side em current + 1 outro                          → 75
 *   - Current sozinho, outros neutros                         → 50
 *   - Current contradiz 1 dos outros                          → 33
 *   - Current contradiz ambos                                 → 10
 *   - Current neutral                                          → 50 (informativo)
 *
 * Ponderacao: higher TFs (mais distantes) pesam um pouco mais — eles
 * representam a tendencia macro.
 */
function calculateScore(
  current: TimeframeAnalysis,
  higher: TimeframeAnalysis | null,
  highest: TimeframeAnalysis | null
): { score: number; alignment: AlignmentLevel } {
  const refs = [
    { tf: current, weight: 1 },
    higher ? { tf: higher, weight: 1.3 } : null,
    highest ? { tf: highest, weight: 1.5 } : null,
  ].filter((x): x is { tf: TimeframeAnalysis; weight: number } => x !== null);

  if (current.side === "neutral") {
    // Current neutro — score informativo
    const allNeutral = refs.every((r) => r.tf.side === "neutral");
    return {
      score: 50,
      alignment: allNeutral ? "neutral" : "divergent",
    };
  }

  let totalWeight = 0;
  let agreeingWeight = 0;
  let opposingCount = 0;

  for (const r of refs) {
    totalWeight += r.weight;
    if (r.tf.side === current.side) {
      agreeingWeight += r.weight;
    } else if (r.tf.side !== "neutral") {
      // Lado oposto
      opposingCount++;
    }
  }

  const rawScore = (agreeingWeight / totalWeight) * 100;
  // Penaliza oposicao: cada TF contraditorio tira 10 pontos
  const finalScore = Math.max(0, Math.round(rawScore - opposingCount * 10));

  let alignment: AlignmentLevel;
  if (finalScore >= 90) alignment = "fully_aligned";
  else if (finalScore >= 60) alignment = "partially_aligned";
  else alignment = "divergent";

  return { score: finalScore, alignment };
}

// ============================================================
// SUMMARY TEXTUAL
// ============================================================

function buildSummary(
  current: TimeframeAnalysis,
  higher: TimeframeAnalysis | null,
  highest: TimeframeAnalysis | null,
  score: number,
  alignment: AlignmentLevel
): string {
  const sideLabel = (s: "buy" | "sell" | "neutral") =>
    s === "buy" ? "compra" : s === "sell" ? "venda" : "neutro";

  const parts: string[] = [];
  parts.push(`${current.timeframe} = ${sideLabel(current.side)}`);
  if (higher) parts.push(`${higher.timeframe} = ${sideLabel(higher.side)}`);
  if (highest) parts.push(`${highest.timeframe} = ${sideLabel(highest.side)}`);

  let header: string;
  switch (alignment) {
    case "fully_aligned":
      header = `Alinhamento total entre timeframes (score ${score}/100)`;
      break;
    case "partially_aligned":
      header = `Alinhamento parcial (score ${score}/100)`;
      break;
    case "divergent":
      header = `Divergencia entre timeframes (score ${score}/100) — opere com cautela`;
      break;
    case "neutral":
      header = `Sem direcao clara em nenhum timeframe (score ${score}/100)`;
      break;
  }

  return `${header}. ${parts.join(" · ")}`;
}

// ============================================================
// PIPELINE PRINCIPAL
// ============================================================

/**
 * Roda analise multi-timeframe pra um (asset, currentTf).
 *
 * @param symbol Asset (ex: BTCUSDT)
 * @param assetType Tipo do ativo (crypto/forex/etc)
 * @param currentTf Timeframe da analise principal
 * @param currentAnalysis Resultado ja calculado pro current (evita re-rodar)
 */
export async function analyzeMultiTimeframe(
  symbol: string,
  assetType: AssetType,
  currentTf: Timeframe,
  currentAnalysis: TimeframeAnalysis
): Promise<MultiTimeframeResult | null> {
  const { higher, highest } = getHigherTimeframes(currentTf);

  if (!higher && !highest) {
    // Ja estamos no topo (1M) — nao tem TF superior
    return null;
  }

  // Fetch + analise em paralelo dos TFs adjacentes
  const [higherAnalysis, highestAnalysis] = await Promise.all([
    higher ? analyzeOneTimeframe(symbol, assetType, higher) : null,
    highest ? analyzeOneTimeframe(symbol, assetType, highest) : null,
  ]);

  const { score, alignment } = calculateScore(
    currentAnalysis,
    higherAnalysis,
    highestAnalysis
  );

  const summary = buildSummary(
    currentAnalysis,
    higherAnalysis,
    highestAnalysis,
    score,
    alignment
  );

  return {
    current: currentAnalysis,
    higher: higherAnalysis,
    highest: highestAnalysis,
    confluenceScore: score,
    alignment,
    summary,
  };
}

/**
 * Helper: converte um AnalysisResult em TimeframeAnalysis (pra usar como current).
 */
export function toTimeframeAnalysis(
  result: import("./types").AnalysisResult
): TimeframeAnalysis {
  const ema200 = result.indicators.find((i) => i.name === "EMA (200)");
  const trendDirection: "up" | "down" | "neutral" = ema200
    ? ema200.vote === "BUY"
      ? "up"
      : ema200.vote === "SELL"
        ? "down"
        : "neutral"
    : "neutral";

  return {
    timeframe: result.meta.timeframe,
    signal: result.signal.signal,
    strength: result.signal.strength,
    confluence: result.signal.confluence,
    side: signalSide(result.signal.signal),
    trendDirection,
    bias: result.smc?.bias ?? "neutral",
  };
}
