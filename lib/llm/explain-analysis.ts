/**
 * Função de alto nível: pega um AnalysisResult e gera a explicação narrada via LLM.
 *
 * Robusto: se o LLM falhar (sem API key, rate limit, timeout), retorna null
 * e a aplicação cai pra explicação heurística automaticamente.
 */
import type { AnalysisResult } from "@/lib/analysis/types";
import { getLlmClient, isLlmAvailable } from "./openai-client";
import { buildExplainPrompt, getSystemPrompt } from "./explain-prompt";

export interface LlmExplanation {
  /** Texto narrativo em PT-BR (4 parágrafos) */
  text: string;
  /** Modelo usado */
  model: string;
  /** Tokens consumidos */
  inputTokens: number;
  outputTokens: number;
  /** Custo estimado em USD */
  costUsd: number;
  /** Tempo de geração em ms */
  durationMs: number;
  /** Timestamp ISO da geração */
  generatedAt: string;
}

/**
 * Gera explicação narrada para um AnalysisResult.
 *
 * @returns explicação ou null em caso de falha. Nunca lança — fail-safe.
 */
export async function explainAnalysisWithLlm(
  result: AnalysisResult
): Promise<LlmExplanation | null> {
  if (!isLlmAvailable()) {
    return null;
  }

  try {
    const client = getLlmClient();
    const response = await client.generate({
      system: getSystemPrompt(),
      user: buildExplainPrompt(result),
      maxTokens: 700,
      temperature: 0.4,
    });

    // Custo aproximado para GPT-4o-mini
    const costUsd =
      (response.inputTokens / 1_000_000) * 0.15 +
      (response.outputTokens / 1_000_000) * 0.6;

    return {
      text: response.text,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd,
      durationMs: response.durationMs,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Loga mas não derruba a análise. UI cai pra explicação heurística.
    console.error("[llm] explainAnalysis falhou:", err);
    return null;
  }
}
