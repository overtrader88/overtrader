/**
 * Setup Score — cruza TODOS os sistemas do motor num único veredito de confiança,
 * listando o que está A FAVOR e CONTRA a direção do sinal. PURO e transparente:
 * o score é uma combinação explicável (concordância entre sistemas × qualidade do
 * selo × gates × força), NÃO uma probabilidade calibrada.
 */
import type { FullAnalysis } from "./full";

export interface SetupScore {
  score: number;                 // 0–100
  label: string;
  tone: "bull" | "bear" | "neu";
  side: "buy" | "sell" | "neutral";
  agree: string[];               // sistemas alinhados à direção do sinal
  against: string[];             // sistemas contra
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

export function computeSetupScore(dto: FullAnalysis): SetupScore {
  const a = dto.analysis;
  const sig = a.signal.signal;
  const side: SetupScore["side"] = sig.includes("BUY") ? "buy" : sig.includes("SELL") ? "sell" : "neutral";
  const dir = side === "buy" ? 1 : side === "sell" ? -1 : 0;

  const agree: string[] = [];
  const against: string[] = [];
  // vote: +1 bull, -1 bear, 0 neutro. Compara com a direção do sinal.
  const check = (label: string, vote: number) => {
    if (dir === 0 || vote === 0) return;
    if (vote === dir) agree.push(label); else against.push(label);
  };

  // Votação dos indicadores (líquida)
  if (a.signal.votes) check(`Indicadores (${a.signal.votes.buy}↑/${a.signal.votes.sell}↓)`, Math.sign(a.signal.votes.buy - a.signal.votes.sell));
  // SMC institucional
  if (dto.smc) check("SMC institucional", dto.smc.bias === "bullish" ? 1 : dto.smc.bias === "bearish" ? -1 : 0);
  // Wyckoff (fase)
  const ph = dto.wegd?.wyckoff?.phase;
  if (ph) check("Wyckoff", ph === "accumulation" || ph === "markup" ? 1 : ph === "distribution" || ph === "markdown" ? -1 : 0);
  // Monte Carlo
  if (dto.montecarlo) { const up = dto.montecarlo.winRateUp.value * 100; check("Monte Carlo", up >= 55 ? 1 : up <= 45 ? -1 : 0); }
  // Multi-timeframe (relativo: confluência alta = confirma o sinal)
  if (dto.multiTimeframe) { const cs = dto.multiTimeframe.confluenceScore; check(`Multi-timeframe (${cs}%)`, cs >= 60 ? dir : cs <= 40 ? -dir : 0); }
  // Eventos Wyckoff recentes
  const lastWy = dto.wyckoffEvents?.[dto.wyckoffEvents.length - 1];
  if (lastWy) check(`Evento ${lastWy.type}`, lastWy.side === "bull" ? 1 : -1);

  // Pontuação
  let score = 50 + (agree.length - against.length) * 9;
  const seal = dto.quality?.status;
  if (seal === "green") score += 12;
  else if (seal === "red") score -= 18;
  else if (seal === "grey") score -= 8;
  const gates = a.gates ?? [];
  if (gates.length) score += ((gates.filter((g) => g.passed).length / gates.length) - 0.5) * 16;
  score += (a.signal.strength - 50) * 0.2;
  score = clamp(Math.round(score));

  let label: string;
  let tone: SetupScore["tone"] = side === "buy" ? "bull" : side === "sell" ? "bear" : "neu";
  if (side === "neutral") { label = "Neutro — aguardar definição"; tone = "neu"; }
  else if (against.length > agree.length) { label = "Conflitante — cautela"; }
  else if (score >= 72) label = "Alta confiança";
  else if (score >= 55) label = "Confiança moderada";
  else if (score >= 40) label = "Baixa confiança";
  else label = "Fraco — evitar";

  return { score, label, tone, side, agree, against };
}
