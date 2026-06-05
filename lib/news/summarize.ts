/**
 * Resume noticias do ativo em um contexto macro de 2-3 frases com sentimento.
 *
 * Usa o GPT-4o-mini ja configurado (mesmo cliente do explain-analysis).
 * Custo: ~R$ 0,002 por resumo (uma chamada adicional por analise completa).
 *
 * Fail-safe: se LLM indisponivel ou erro, retorna null.
 */
import { getLlmClient } from "@/lib/llm/openai-client";
import type { NewsItem } from "./providers";

export interface NewsSentiment {
  /** Sentimento agregado das noticias */
  overall: "bullish" | "bearish" | "neutral" | "mixed";
  /** Score numerico -1 a +1 (negativo = bearish) */
  score: number;
  /** Resumo em PT-BR 2-3 frases */
  summary: string;
  /** Quantas noticias foram analisadas */
  newsCount: number;
}

const SYSTEM_PROMPT = `Voce e um analista que resume noticias financeiras pra contexto macro de uma analise tecnica.

REGRAS:
1. Leia as noticias fornecidas (titulos e leads)
2. Identifique o sentimento agregado: bullish, bearish, neutral ou mixed
3. Resuma em 2-3 frases CURTAS (max 60 palavras total) o panorama macro
4. Use PT-BR natural, sem hype nem chavoes
5. Cite eventos especificos se relevantes (decisoes do Fed, regulacao, etc)
6. NAO faca previsoes — apenas descreva o cenario observado

FORMATO DE SAIDA OBRIGATORIO (JSON estrito, sem markdown):
{
  "overall": "bullish" | "bearish" | "neutral" | "mixed",
  "score": numero entre -1 e 1,
  "summary": "string em PT-BR com 2-3 frases"
}`;

export async function summarizeNews(
  asset: string,
  news: NewsItem[]
): Promise<NewsSentiment | null> {
  if (news.length === 0) return null;

  const client = getLlmClient();
  if (!client.isConfigured()) return null;

  // Monta o prompt com as noticias compactas
  const newsContext = news
    .slice(0, 10)
    .map(
      (n, i) =>
        `${i + 1}. [${n.sentiment ?? "neutral"}] ${n.title}${
          n.summary ? ` — ${n.summary.slice(0, 100)}` : ""
        } (${n.source})`
    )
    .join("\n");

  const userPrompt = `ATIVO: ${asset}\n\nNOTICIAS RECENTES:\n${newsContext}\n\nGere o JSON de sentimento conforme as regras.`;

  try {
    const response = await client.generate({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 200,
      temperature: 0.2, // baixa pra ser consistente
    });

    // Parse JSON estrito (LLM as vezes coloca markdown ```json...)
    const cleaned = response.text
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      overall?: string;
      score?: number;
      summary?: string;
    };

    if (!parsed.overall || !parsed.summary) return null;

    const overall =
      parsed.overall === "bullish" ||
      parsed.overall === "bearish" ||
      parsed.overall === "neutral" ||
      parsed.overall === "mixed"
        ? parsed.overall
        : "neutral";

    return {
      overall,
      score: typeof parsed.score === "number" ? Math.max(-1, Math.min(1, parsed.score)) : 0,
      summary: parsed.summary,
      newsCount: news.length,
    };
  } catch (err) {
    console.warn("[news] summarize falhou:", err);
    return null;
  }
}
