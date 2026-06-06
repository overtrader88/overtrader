/**
 * Narração AO VIVO determinística (Fase: Trading ao Vivo). PURA — monta a leitura
 * a partir dos fatos grounded (toNarrativeFacts). Sem LLM: grátis, instantânea e
 * sempre fiel aos números (n + IC + selo). O diferencial honesto do Overtrader.
 *
 * `key` muda só quando algo relevante muda (sinal/selo/níveis) → o front só
 * re-narra/fala quando há mudança real (controla custo de voz e ruído).
 */
import type { NarrativeFacts } from "./narrative-facts";

const SIGNAL_PT: Record<string, string> = {
  STRONG_BUY: "compra forte", BUY: "compra", WEAK_BUY: "compra fraca",
  NEUTRAL: "neutro", WEAK_SELL: "venda fraca", SELL: "venda", STRONG_SELL: "venda forte",
};
const SEAL_PT: Record<string, string> = {
  green: "selo verde — histórico sustenta com folga",
  yellow: "selo amarelo — há ressalva, cautela",
  red: "selo vermelho — histórico NÃO sustenta o sinal",
  grey: "amostra insuficiente para veredito",
};

export interface LiveNarration {
  key: string;
  headline: string;
  side: "buy" | "sell" | "neutral";
  bullets: string[];
  speech: string;
}

export function buildLiveNarration(f: NarrativeFacts): LiveNarration {
  const sig = SIGNAL_PT[f.signal] ?? f.signal.toLowerCase();
  const side: "buy" | "sell" | "neutral" =
    f.signal.includes("BUY") ? "buy" : f.signal.includes("SELL") ? "sell" : "neutral";

  const bullets: string[] = [];
  const speech: string[] = [];

  speech.push(`${f.symbol}, ${f.timeframe}. Sinal de ${sig}, força ${f.strengthPct} por cento.`);
  bullets.push(`Sinal: ${sig} · força ${f.strengthPct}% · confluência ${f.confluence}`);

  if (f.regime) {
    bullets.push(`Regime: ${f.regime}${f.adx != null ? ` · ADX ${f.adx}` : ""}`);
    speech.push(`Regime de ${f.regime}${f.adx != null ? `, ADX em ${f.adx}` : ""}.`);
  }

  if (f.seal) {
    bullets.push(`Selo de qualidade: ${SEAL_PT[f.seal.status] ?? f.seal.status}`);
  }

  if (f.backtest) {
    const b = f.backtest;
    bullets.push(`Backtest: n=${b.decisiveTrades} · profit factor ${b.pf} (IC 95% ${b.pfCi[0]}–${b.pfCi[1]}) · acerto ${b.winRatePct}%`);
    if (!b.sufficient) {
      speech.push(`Atenção: amostra de ${b.decisiveTrades} operações, ainda insuficiente para um veredito firme.`);
    } else {
      speech.push(`Backtest com ${b.decisiveTrades} operações, profit factor ${b.pf}, intervalo de confiança de ${b.pfCi[0]} a ${b.pfCi[1]}, acerto de ${b.winRatePct} por cento.`);
    }
  }

  if (side !== "neutral") {
    bullets.push(`Plano: entrada ${f.entry} · stop ${f.stopLoss} · alvo ${f.takeProfit1} · R:R ${f.rr1}`);
    speech.push(`Plano operacional: entrada em ${f.entry}, stop em ${f.stopLoss}, primeiro alvo em ${f.takeProfit1}, risco-retorno de ${f.rr1}.`);
  } else {
    speech.push(`Sem plano operacional no momento: viés neutro, o ideal é aguardar definição.`);
  }

  speech.push(`Lembrando: isto é análise, não recomendação de investimento. Há risco de perda.`);

  const headline = `${f.symbol} · ${f.timeframe.toUpperCase()} — ${sig.toUpperCase()}`;
  const key = `${f.signal}|${f.seal?.status ?? "-"}|${f.entry}|${f.stopLoss}|${f.takeProfit1}`;

  return { key, headline, side, bullets, speech: speech.join(" ") };
}
