/**
 * CONSELHO DE GUERRA — chat pós-análise em que o usuário interroga a IA
 * ancorada EXCLUSIVAMENTE nos dados de UMA análise (snapshot salvo/DTO).
 * Monta os fatos reusando os mesmos extratores dos motores (decisão + níveis
 * + resumo narrativo) e responde via OpenAI (gpt-4.1, temp 0.3). Regra da
 * casa: o que não estiver nos dados, o Conselho DIZ que não tem — honestidade
 * é a marca. `null` em qualquer falha (sem key, timeout, IA fora): o chamador
 * estorna o crédito e degrada gracioso.
 */
import { withTimeout } from "@/lib/http/with-timeout";
import { toNarrativeFacts } from "./narrative-facts";
import { toDecisionFacts, toLevelsFacts } from "./narrative";
import type { FullAnalysis } from "./full";
import type { AssetType } from "@tradeai/shared";

/** Turno do chat (papel + texto). O cliente envia o histórico; o servidor capa. */
export interface WarCouncilTurn {
  role: "user" | "assistant";
  content: string;
}

/** Máximo de turnos (pergunta + resposta) mantidos no contexto do Conselho. */
export const WAR_COUNCIL_MAX_TURNS = 10;

export const WAR_COUNCIL_SYSTEM = [
  "Você é o CONSELHO DE GUERRA do Overtrader — o analista que o usuário interroga sobre UMA análise específica, já gerada.",
  "Você recebe os DADOS DA ANÁLISE (JSON) — um snapshot do momento em que ela foi gerada. Esses dados são a sua ÚNICA fonte.",
  "REGRAS INVIOLÁVEIS:",
  "1) Responda APENAS com base nos dados fornecidos. NÃO use conhecimento externo sobre o ativo, notícias, fundamentos ou o preço de agora.",
  "2) Se a pergunta pedir algo que NÃO está nos dados, diga explicitamente que esta análise não tem esse dado — honestidade é a marca da casa. Nunca invente números nem improvise.",
  "3) Campos null/ausentes no JSON = dado NÃO medido nesta análise — trate como inexistente.",
  "4) Os dados são um retrato do momento da geração; se a pergunta envolver 'agora', deixe claro que a resposta vale para aquele momento.",
  "5) Nunca prometa lucro nem garanta resultado. Comunique a incerteza citando amostra (n) e intervalo de confiança quando os dados trouxerem.",
  "6) Se a pergunta for 'devo comprar/vender?', apresente o que os dados dizem e lembre que isto é análise, não recomendação de investimento.",
  "7) Responda em português do Brasil, tom técnico e direto, no máximo ~120 palavras. Sem emojis.",
].join("\n");

/** Fatos COMPLETOS do Conselho: resumo (veredito/plano/selo/backtest), decisão
 *  bruta (indicadores/SMC/MTF) e níveis (volume/S-R/Fibonacci) — tudo do DTO,
 *  sem dados vivos (extras de classe ficam null: o snapshot não os tem). */
export function toWarCouncilFacts(dto: FullAnalysis): unknown {
  const assetType = dto.analysis.meta.assetType as AssetType;
  return {
    resumo: toNarrativeFacts(dto),
    decisao: toDecisionFacts(dto, assetType, {}),
    niveis: toLevelsFacts(dto),
    gerada_em: new Date(dto.generatedAt).toISOString(),
    periodo_dados: dto.period,
  };
}

/** Capa o histórico nos últimos N turnos (2 mensagens por turno). */
export function capWarCouncilHistory(history: WarCouncilTurn[]): WarCouncilTurn[] {
  return history.slice(-WAR_COUNCIL_MAX_TURNS * 2);
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Resposta do Conselho à pergunta, grounded no DTO. `null` em qualquer falha. */
export async function generateWarCouncilAnswer(dto: FullAnalysis, question: string, history: WarCouncilTurn[]): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_LLM_MODEL || "gpt-4.1";
  const system = `${WAR_COUNCIL_SYSTEM}\n\nDADOS DA ANÁLISE (JSON):\n${JSON.stringify(toWarCouncilFacts(dto))}`;
  try {
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 600,
          messages: [
            { role: "system", content: system },
            ...capWarCouncilHistory(history).map((t) => ({ role: t.role, content: t.content })),
            { role: "user", content: question },
          ],
        }),
      }),
      25000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ChatResponse;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
