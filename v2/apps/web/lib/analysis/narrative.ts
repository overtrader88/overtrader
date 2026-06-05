/**
 * Geração da leitura em linguagem natural (OpenAI), GROUNDED nos números medidos.
 * Extraída da rota /api/narrative para ser reusada também pelo Relatório Executivo
 * (PDF). Recebe o DTO já calculado e devolve o texto — ou `null` em qualquer falha
 * (sem key, timeout, IA fora): o chamador degrada gracioso.
 */
import { toNarrativeFacts } from "./narrative-facts";
import { withTimeout } from "@/lib/http/with-timeout";
import type { FullAnalysis } from "./full";

export const NARRATIVE_SYSTEM = [
  "Você é o analista técnico do Overtrader, uma ferramenta de ANÁLISE e transparência (não consultoria de investimento).",
  "A partir dos dados fornecidos, escreva uma leitura em português do Brasil, 120–180 palavras, tom técnico e sóbrio.",
  "REGRAS INVIOLÁVEIS:",
  "1) Nunca prometa lucro nem garanta resultado.",
  "2) Sempre comunique a incerteza — cite o tamanho de amostra (n) e o intervalo de confiança quando houver.",
  "3) Explique o SELO de qualidade: verde = histórico sustenta com folga; amarelo = ressalva (ex.: desempenho out-of-sample enfraquece); vermelho = histórico NÃO sustenta o sinal; cinza = amostra insuficiente para veredito.",
  "4) Se o selo for vermelho ou cinza, deixe explícito que o backtest não dá respaldo e que cabe cautela.",
  "5) Não invente números além dos fornecidos.",
  "6) Termine lembrando que é análise, não recomendação de investimento. Não use emojis.",
].join("\n");

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Gera a narrativa a partir do DTO. `null` se a IA não estiver configurada ou falhar. */
export async function generateNarrative(dto: FullAnalysis): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const factsJson = JSON.stringify(toNarrativeFacts(dto));
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          max_tokens: 420,
          messages: [
            { role: "system", content: NARRATIVE_SYSTEM },
            { role: "user", content: `Dados da análise (JSON):\n${factsJson}\n\nEscreva a leitura honesta.` },
          ],
        }),
      }),
      20000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
