/**
 * "Por que NÃO operar" — o diferencial de credibilidade (Fase B2).
 *
 * O Vortex (e a maioria) só sabe dizer "opere". O Overtrader assume a posição
 * honesta: agrega, a partir do DTO já calculado, os motivos OBJETIVOS para
 * **não** entrar agora — e os transforma numa feature explícita e vendável.
 *
 * PURO e determinístico (testável sem rede). Não recomputa nada: lê os vereditos
 * que o motor já produziu (selo, backtest, cenários, sazonalidade, multi-TF).
 */
import { signalSide } from "@tradeai/shared";
import type { FullAnalysis } from "./full";

export type GuardSeverity = "block" | "caution";

export interface GuardReason {
  /** `block` = motivo forte para não operar; `caution` = ressalva a pesar. */
  severity: GuardSeverity;
  title: string;
  detail: string;
}

export interface TradeGuard {
  /** Recomenda operar? Falso se houver qualquer `block`. */
  operate: boolean;
  /** Cor herdada do selo de qualidade (green/yellow/red/grey). */
  tone: "green" | "yellow" | "red" | "grey";
  headline: string;
  reasons: GuardReason[];
  /** Pontos a favor (quando há) — para não ser só negativo. */
  pros: string[];
}

const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
const num = (x: number, d = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Constrói o veredito de "operar / não operar" com os motivos. A regra é
 * conservadora por princípio: qualquer `block` derruba a recomendação.
 */
export function buildTradeGuard(dto: FullAnalysis): TradeGuard {
  const a = dto.analysis;
  const side = signalSide(a.signal.signal);
  const reasons: GuardReason[] = [];
  const pros: string[] = [];

  // 1) Direção do sinal.
  if (side === "neutral") {
    reasons.push({
      severity: "block",
      title: "Sinal neutro",
      detail: "O motor não aponta direção com convicção suficiente — não há entrada definida.",
    });
  } else if (a.signal.signal === "WEAK_BUY" || a.signal.signal === "WEAK_SELL") {
    reasons.push({
      severity: "caution",
      title: "Sinal fraco",
      detail: `Direção ${side === "buy" ? "de compra" : "de venda"}, mas com baixa convicção (força ${a.signal.strength}/100).`,
    });
  } else {
    pros.push(`Sinal de ${side === "buy" ? "compra" : "venda"} com força ${a.signal.strength}/100 e confluência ${a.signal.confluence}/10.`);
  }

  // 2) Selo de qualidade (backtest honesto).
  const seal = dto.quality?.status;
  const bt = dto.backtest;
  if (seal === "grey") {
    reasons.push({
      severity: "block",
      title: "Amostra insuficiente",
      detail: dto.quality?.reason ?? "O backtest não tem trades decisivos suficientes para um veredito confiável.",
    });
  } else if (seal === "red") {
    reasons.push({
      severity: "block",
      title: "Backtest reprovado",
      detail: dto.quality?.reason ?? "O histórico não sustenta este sinal.",
    });
  } else if (seal === "yellow") {
    reasons.push({
      severity: "caution",
      title: "Selo com ressalva",
      detail: dto.quality?.reason ?? "O desempenho fora da amostra enfraquece — possível overfitting.",
    });
  } else if (seal === "green") {
    pros.push("Selo verde: o limite inferior do IC supera o limiar mesmo no pior caso, sem colapso out-of-sample.");
  }

  // 3) R médio por trade negativo (mesmo com amostra suficiente).
  if (bt && bt.sampleSufficient && bt.avgR.value < 0) {
    reasons.push({
      severity: "block",
      title: "Expectativa negativa",
      detail: `R médio por trade do backtest é ${num(bt.avgR.value)} (IC 95% ${num(bt.avgR.ci95[0])}–${num(bt.avgR.ci95[1])}, n=${bt.avgR.n}) — esperança matemática contra.`,
    });
  }

  // 4) Risco/retorno do TP1 abaixo de 1:1.
  if (side !== "neutral" && a.risk.rr1 < 1) {
    reasons.push({
      severity: "caution",
      title: "Risco/retorno baixo",
      detail: `R:R até o TP1 é ${num(a.risk.rr1, 1)} (abaixo de 1:1) — exige taxa de acerto alta para compensar.`,
    });
  }

  // 5) Cenário: stop mais provável que o TP1 no lado recomendado.
  const sc = dto.scenarios;
  if (sc && side !== "neutral") {
    const rec = sc.recommended === "buy" ? sc.buy : sc.sell;
    const pStop = rec.stopProbability.value;
    const pTp1 = rec.tp1.probability.value;
    if (pStop > pTp1) {
      reasons.push({
        severity: "caution",
        title: "Stop mais provável que o alvo",
        detail: `Nos cenários simulados, a chance de bater o stop antes do TP1 (${pct(pStop)}) supera a de atingir o TP1 (${pct(pTp1)}).`,
      });
    } else if (rec.expectedR > 0) {
      pros.push(`Cenário ${sc.recommended === "buy" ? "de compra" : "de venda"} com R esperado positivo (${num(rec.expectedR)}) e TP1 a ${pct(pTp1)}.`);
    }
  }

  // 6) Sazonalidade do mês atual historicamente contra (com amostra).
  const cm = dto.seasonality?.currentMonthStats;
  if (cm && cm.sufficient && side !== "neutral") {
    const [lo, hi] = cm.avgReturn.ci95;
    const seasNegative = hi < 0; // IC inteiro abaixo de zero
    if (seasNegative && side === "buy") {
      reasons.push({
        severity: "caution",
        title: "Sazonalidade desfavorável",
        detail: `O mês atual é historicamente negativo (média ${num(cm.avgReturn.value)}%, IC 95% ${num(lo, 1)}%–${num(hi, 1)}%, n=${cm.sampleSize}) — contra uma compra.`,
      });
    } else if (lo > 0 && side === "sell") {
      reasons.push({
        severity: "caution",
        title: "Sazonalidade desfavorável",
        detail: `O mês atual é historicamente positivo (média +${num(cm.avgReturn.value)}%, IC 95% ${num(lo, 1)}%–${num(hi, 1)}%, n=${cm.sampleSize}) — contra uma venda.`,
      });
    }
  }

  // 7) Timeframes divergentes (sem confluência).
  const mtf = dto.multiTimeframe;
  if (mtf && mtf.alignment === "divergent") {
    reasons.push({
      severity: "caution",
      title: "Timeframes divergentes",
      detail: "Os timeframes analisados não concordam na direção — confluência fraca.",
    });
  } else if (mtf && mtf.alignment === "fully_aligned") {
    pros.push(`Confluência multi-timeframe alinhada (score ${mtf.confluenceScore}/100).`);
  }

  const hasBlock = reasons.some((r) => r.severity === "block");
  const operate = !hasBlock && side !== "neutral";
  const tone: TradeGuard["tone"] =
    seal === "green" || seal === "yellow" || seal === "red" || seal === "grey" ? seal : operate ? "green" : "grey";

  const headline = operate
    ? reasons.length === 0
      ? "Sem impeditivos para operar — dentro dos critérios"
      : "Operável, com ressalvas a pesar"
    : "Por que NÃO operar agora";

  return { operate, tone, headline, reasons, pros };
}
