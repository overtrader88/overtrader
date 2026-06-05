/**
 * Sentimento de notícias via LLM (GPT-4o-mini) — funciona em qualquer idioma
 * (resolve o gap de PT dos provedores). Lê os títulos, devolve sentimento agregado
 * + score + um resumo macro curto em PT-BR.
 *
 * Custo ~R$ 0,003/análise. Fail-safe: sem OPENAI_API_KEY, erro ou JSON inválido → null
 * (a rota cai no agregado dos scores do provedor). Parser puro + caller injetável (testável).
 */
import { z } from "zod";
import { withTimeout } from "../http/with-timeout";
import type { NewsItem } from "./world-news";

export interface NewsLlmSentiment {
  overall: "bullish" | "bearish" | "neutral" | "mixed";
  /** -1 (muito bearish) a +1 (muito bullish). */
  score: number;
  /** Resumo macro em PT-BR (2-3 frases). */
  summary: string;
}

const SCHEMA = z.object({
  overall: z.enum(["bullish", "bearish", "neutral", "mixed"]),
  score: z.number().min(-1).max(1),
  summary: z.string().min(1),
});

const SYSTEM = [
  "Você resume notícias financeiras para o CONTEXTO MACRO de uma análise técnica (ferramenta de análise, não recomendação de investimento).",
  "REGRAS:",
  "1. Leia os títulos fornecidos do ativo.",
  "2. Classifique o sentimento agregado: bullish, bearish, neutral ou mixed.",
  "3. Resuma em 2-3 frases curtas (máx. 60 palavras), PT-BR natural, sem hype nem chavões.",
  "4. NÃO faça previsões nem prometa resultado — apenas descreva o cenário observado.",
  "5. score: número de -1 (muito bearish) a +1 (muito bullish).",
  'FORMATO DE SAÍDA (JSON estrito, sem markdown): {"overall":"bullish|bearish|neutral|mixed","score":number,"summary":"texto"}',
].join("\n");

/** Parse PURO da resposta do LLM (tolera cercas ```json). null se inválido. */
export function parseSentimentJson(content: string): NewsLlmSentiment | null {
  const cleaned = content.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = SCHEMA.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type ChatCaller = (system: string, user: string) => Promise<string | null>;

/** Caller real do OpenAI (gpt-4o-mini). Sem key/erro → null. */
async function openAiCaller(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 220,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      }),
      15000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Resume o sentimento das notícias. `caller` injetável p/ teste. null se indisponível. */
export async function summarizeNewsSentiment(
  asset: string,
  items: NewsItem[],
  caller: ChatCaller = openAiCaller,
): Promise<NewsLlmSentiment | null> {
  if (items.length === 0) return null;
  const list = items.slice(0, 10).map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join("\n");
  const user = `ATIVO: ${asset}\n\nNOTÍCIAS RECENTES:\n${list}\n\nGere o JSON de sentimento conforme as regras.`;
  const content = await caller(SYSTEM, user);
  return content ? parseSentimentJson(content) : null;
}
