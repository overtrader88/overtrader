/**
 * Explicação heurística do sinal (placeholder — o LLM real entra na borda/web).
 * Correção vs v1: usa `gates.length` em vez de "/6" fixo (eram 8 gates).
 */
import { signalSide } from "@tradeai/shared";
import type { GateResult, IndicatorResult, RiskOutput, SignalOutput } from "../types";
import { signalLabel } from "../signal/levels";
import { NAMES } from "../signal/votes";

export function buildExplanation(
  signal: SignalOutput,
  indicators: IndicatorResult[],
  gates: GateResult[],
  risk: RiskOutput,
  asset: string,
  timeframe: string,
): { summary: string; bullets: string[] } {
  const direction = signalLabel(signal.signal).toUpperCase();
  const side = signalSide(signal.signal);
  const passed = gates.filter((g) => g.passed).length;
  const failed = gates.filter((g) => !g.passed);

  const summary =
    signal.signal === "NEUTRAL"
      ? `Sinal NEUTRO em ${asset} (${timeframe}). Indicadores divididos — recomenda-se aguardar maior clareza direcional.`
      : `Sinal de ${direction} em ${asset} (${timeframe}) com força ${signal.strength}/100 e confluência ${signal.confluence}/10. ${passed}/${gates.length} gates aprovados.`;

  const bullets: string[] = [];

  const ema200 = indicators.find((i) => i.name === NAMES.ema200);
  if (ema200) {
    const above = ema200.vote === "BUY";
    bullets.push(`Tendência de longo prazo ${above ? "ALTA" : "BAIXA"} (preço ${above ? "acima" : "abaixo"} da EMA 200).`);
  }

  const rsi = indicators.find((i) => i.name === NAMES.rsi);
  if (rsi && typeof rsi.value === "number") {
    bullets.push(`RSI (14) em ${rsi.value.toFixed(1)} — ${rsi.note ?? "neutro"}.`);
  }

  bullets.push(
    `Votação dos ${indicators.length} indicadores: ${signal.votes.buy} COMPRA · ${signal.votes.sell} VENDA · ${signal.votes.neutral} NEUTRO.`,
  );

  if (side !== "neutral") {
    bullets.push(
      `Risco/retorno do TP1: ${risk.rr1.toFixed(2)} (entrada ${risk.entry.toFixed(2)}, stop ${risk.stopLoss.toFixed(2)}, alvo 1 ${risk.takeProfit1.toFixed(2)}).`,
    );
  }

  if (failed.length > 0) {
    bullets.push(`⚠️ Filtros que falharam: ${failed.map((f) => f.name).join(", ")}. Considere o sinal com cautela.`);
  } else if (side !== "neutral") {
    bullets.push(`✅ Todos os ${gates.length} filtros de qualidade aprovados.`);
  }

  return { summary, bullets };
}
