/**
 * Prompt builder para explicação narrada de análise técnica.
 *
 * Estratégia:
 *   - Estruturamos o contexto da análise em formato compacto (token-eficiente)
 *   - System prompt define persona, estilo, regras (PT-BR, sem chavões, factual)
 *   - User prompt entrega os DADOS + pergunta
 *   - Modelo retorna texto narrativo em parágrafos curtos
 *
 * O LLM NÃO inventa números — apenas explica o que a engine decidiu, com
 * linguagem natural e contexto educacional.
 */
import type { AnalysisResult } from "@/lib/analysis/types";
import { signalLabel, signalSide } from "@/lib/analysis/signal-utils";

const SYSTEM_PROMPT = `Você é um analista de trading técnico experiente, escrevendo em português brasileiro.

REGRAS RÍGIDAS:
1. Use APENAS os dados fornecidos pela análise — nunca invente números, percentuais ou previsões.
2. Tom: factual, didático, profissional. Sem hype ("oportunidade incrível!"), sem promessas ("vai subir!").
3. Explique POR QUE o sinal foi gerado conectando indicadores → contexto → decisão.
4. Identifique RISCOS e DIVERGÊNCIAS (filtros que falharam, indicadores opostos).
5. Sempre lembre o leitor: "análise é informativa, não recomendação personalizada".
6. Comprimento: 4 parágrafos curtos, 350-500 palavras no total.
7. Estrutura sugerida:
   - Parágrafo 1: contexto geral + direção do sinal
   - Parágrafo 2: indicadores principais que sustentam o sinal (cite 2-3 dos mais relevantes)
   - Parágrafo 3: gerenciamento de risco (entry/SL/TP1, R:R) + filtros aprovados/falhados
   - Parágrafo 4: cuidados + disclaimer
8. NUNCA use markdown, bullets ou listas numeradas — apenas parágrafos em prosa.
9. NUNCA mencione "GPT", "OpenAI", "modelo de IA". Você é "o analista da plataforma".`;

/**
 * Constrói o prompt do usuário a partir do AnalysisResult.
 * Compacta o contexto para minimizar custo de tokens.
 */
export function buildExplainPrompt(result: AnalysisResult): string {
  const { signal, risk, indicators, gates, meta } = result;
  const side = signalSide(signal.signal);

  // Pega os indicadores mais "decisivos" — os que VOTARAM no sentido do sinal
  const sideVote = side === "buy" ? "BUY" : side === "sell" ? "SELL" : null;
  const supporting = sideVote
    ? indicators.filter((i) => i.vote === sideVote).slice(0, 5)
    : indicators.filter((i) => i.vote === "NEUTRAL").slice(0, 3);

  const opposing = sideVote
    ? indicators.filter(
        (i) => i.vote !== sideVote && i.vote !== "NEUTRAL"
      ).slice(0, 3)
    : [];

  const passedGates = gates.filter((g) => g.passed);
  const failedGates = gates.filter((g) => !g.passed);

  // Formato compacto: ~300 tokens
  const parts: string[] = [];

  parts.push(`ATIVO: ${meta.asset} | TIMEFRAME: ${meta.timeframe} | TIPO: ${meta.assetType}`);
  parts.push(
    `SINAL FINAL: ${signalLabel(signal.signal)} (força ${signal.strength}/100, confluência ${signal.confluence}/10)`
  );
  parts.push(
    `VOTAÇÃO: ${signal.votes.buy} BUY, ${signal.votes.sell} SELL, ${signal.votes.neutral} NEUTRO (entre ${indicators.length} indicadores)`
  );

  if (side !== "neutral") {
    parts.push(
      `RISCO: entrada ${risk.entry.toFixed(2)} | stop ${risk.stopLoss.toFixed(2)} | TP1 ${risk.takeProfit1.toFixed(2)} | TP2 ${risk.takeProfit2.toFixed(2)} | TP3 ${risk.takeProfit3.toFixed(2)} | R:R do TP1 = ${risk.rr1.toFixed(2)}`
    );
  }

  if (supporting.length > 0) {
    parts.push(
      `INDICADORES A FAVOR: ${supporting
        .map((i) => `${i.name}${i.note ? ` (${i.note})` : ""}`)
        .join(" | ")}`
    );
  }
  if (opposing.length > 0) {
    parts.push(
      `INDICADORES CONTRA: ${opposing
        .map((i) => `${i.name}${i.note ? ` (${i.note})` : ""}`)
        .join(" | ")}`
    );
  }

  parts.push(
    `GATES APROVADOS (${passedGates.length}/${gates.length}): ${passedGates.map((g) => g.name).join(", ") || "nenhum"}`
  );
  if (failedGates.length > 0) {
    parts.push(
      `GATES QUE FALHARAM: ${failedGates.map((g) => `${g.name} (${g.detail})`).join(" | ")}`
    );
  }

  // Sprint 9.1: contexto SMC (Smart Money Concepts) — enriquece o prompt
  if (result.smc) {
    const smc = result.smc;
    const activeOBs = smc.orderBlocks.filter((o) => !o.mitigated);
    const activeFvgs = smc.fvgs.filter((f) => f.status === "active");
    const unsweptZones = smc.liquidityZones.filter((z) => !z.swept);

    parts.push(
      `SMC: viés institucional ${smc.bias} | estrutura ${smc.marketStructure} | ` +
        `${activeOBs.length} OBs ativos | ${activeFvgs.length} FVGs ativos | ` +
        `${unsweptZones.length} zonas de liquidez não varridas`
    );
  }

  // Sprint 9.2: contexto Multi-Timeframe — confluencia entre TFs adjacentes
  if (result.multiTimeframe) {
    const mtf = result.multiTimeframe;
    parts.push(`MULTI-TIMEFRAME: ${mtf.summary}`);
  }

  // Sprint 9.3: Monte Carlo — projecao probabilistica
  if (result.monteCarlo && result.monteCarlo.simulations > 0) {
    const mc = result.monteCarlo;
    parts.push(
      `MONTE CARLO (${mc.simulations} sim): otimista ${mc.optimistic.toFixed(2)} | ` +
        `mediana ${mc.median.toFixed(2)} | pessimista ${mc.pessimistic.toFixed(2)} | ` +
        `Win Rate Alta ${mc.winRateUp.toFixed(0)}% vs Baixa ${mc.winRateDown.toFixed(0)}% | ` +
        `Vol anualizada ${mc.volatilityAnnualized.toFixed(1)}%`
    );
  }

  // Sprint 9.4: Sazonalidade historica
  if (result.seasonality && result.seasonality.yearsAnalyzed >= 1) {
    parts.push(`SAZONALIDADE: ${result.seasonality.summary}`);
  }

  // Sprint 9.5: Dual Scenarios (compra E venda probabilisticos)
  if (result.dualScenarios) {
    const ds = result.dualScenarios;
    parts.push(
      `DUAL SCENARIOS: lado recomendado=${ds.recommended} com edge ${ds.edge} pts. ` +
        `COMPRA: TP1 ${ds.buy.tp1.probability.toFixed(0)}% / TP2 ${ds.buy.tp2.probability.toFixed(0)}% / TP3 ${ds.buy.tp3.probability.toFixed(0)}%. ` +
        `VENDA: TP1 ${ds.sell.tp1.probability.toFixed(0)}% / TP2 ${ds.sell.tp2.probability.toFixed(0)}% / TP3 ${ds.sell.tp3.probability.toFixed(0)}%`
    );
  }

  // Sprint 9.6: Padroes Harmonicos
  if (result.harmonics && result.harmonics.patterns.length > 0) {
    parts.push(`HARMONICOS: ${result.harmonics.summary}`);
  }

  // Sprint 9.10: WEGD - Wyckoff/Elliott/Gann/Dow
  if (result.wegd) {
    parts.push(`WEGD: ${result.wegd.summary}`);
  }

  // Sprint 9.11: Contexto macro de noticias
  if (result.news?.sentiment) {
    const s = result.news.sentiment;
    parts.push(
      `CONTEXTO MACRO (noticias ${s.newsCount}): ${s.overall} (score ${s.score.toFixed(2)}). ${s.summary}`
    );
  }

  parts.push(
    "\nGere uma explicação narrativa em PT-BR seguindo as regras do sistema. Inclua o contexto SMC quando relevante."
  );

  return parts.join("\n");
}

/** System prompt fixo */
export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
