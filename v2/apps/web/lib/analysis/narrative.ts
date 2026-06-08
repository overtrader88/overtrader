/**
 * Geração da leitura em linguagem natural (OpenAI), GROUNDED nos números medidos.
 * Extraída da rota /api/narrative para ser reusada também pelo Relatório Executivo
 * (PDF). Recebe o DTO já calculado e devolve o texto — ou `null` em qualquer falha
 * (sem key, timeout, IA fora): o chamador degrada gracioso.
 */
import { toNarrativeFacts } from "./narrative-facts";
import { withTimeout } from "@/lib/http/with-timeout";
import { computeClassReading, buildClassPlan, type ClassExtras } from "./engines";
import type { FullAnalysis } from "./full";
import type { AssetType } from "@tradeai/shared";

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

/** Sistema do MOTOR 2 — narração da leitura POR CLASSE, independente do motor padrão. */
export const CLASS_NARRATIVE_SYSTEM = [
  "Você é o analista do MOTOR 2 (leitura POR CLASSE DE ATIVO) do Overtrader — ferramenta de ANÁLISE e transparência, não consultoria.",
  "Escreva uma leitura em português do Brasil, 120–180 palavras, tom técnico e sóbrio, descrevendo a leitura por classe do ativo.",
  "REGRAS INVIOLÁVEIS:",
  "1) Este motor é INDEPENDENTE do motor padrão; NÃO cite, compare nem mencione 'o outro motor' ou o 'motor padrão'.",
  "2) Baseie-se na metodologia da família (o que manda / apoia / cruzamentos / cuidados) e nos fatores a favor/contra fornecidos.",
  "3) O Motor 2 NÃO tem backtest próprio (sem selo de qualidade): diga explicitamente que a calibração é medida no track record forward, e que cabe cautela.",
  "4) Cite os DADOS reais da classe que foram usados (ex.: funding/OI, DXY, VIX, juros, COT, TVL on-chain, breadth, estoques, fundamentos) quando presentes, e os dados ainda pendentes.",
  "5) O plano (entrada/stop/alvos) é por ATR — explique que é geométrico, não calibrado por backtest.",
  "6) Nunca prometa lucro nem invente números além dos fornecidos. Termine lembrando que é análise, não recomendação. Sem emojis.",
].join("\n");

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** Chamada crua ao chat da OpenAI (gpt-4o-mini). `null` em qualquer falha. */
async function callOpenAI(key: string, system: string, userContent: string): Promise<string | null> {
  try {
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          max_tokens: 420,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
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

/** Gera a narrativa do MOTOR PADRÃO a partir do DTO. `null` se a IA não estiver configurada ou falhar. */
export async function generateNarrative(dto: FullAnalysis): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return callOpenAI(key, NARRATIVE_SYSTEM, `Dados da análise (JSON):\n${JSON.stringify(toNarrativeFacts(dto))}\n\nEscreva a leitura honesta.`);
}

// ===================== MOTOR LLM (decisão pela IA) =====================
export interface LlmDecision { side: "buy" | "sell" | "neutral"; conviction: number; rationale: string }

const LLM_DECISION_SYSTEM = [
  "Você é um MOTOR DE DECISÃO de trading. A partir dos dados MEDIDOS, decida a direção e a convicção.",
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\"}.",
  "conviccao = sua confiança na direção (0–100; 50 = indeciso).",
  "Pondere a CONFLUÊNCIA dos indicadores, a estrutura (SMC), o multi-timeframe, o regime e os dados macro/da classe fornecidos.",
  "Seja honesto: sinais conflitantes ou fracos → 'neutro' ou convicção baixa. NÃO invente dados além dos fornecidos.",
  "NÃO escreva nada fora do JSON.",
].join("\n");

/** Fatos BRUTOS p/ a decisão da LLM — sem o veredito do Motor 1 (independência). */
function toDecisionFacts(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): unknown {
  const a = dto.analysis;
  return {
    ativo: a.meta.asset, timeframe: a.meta.timeframe, classe: assetType,
    regime: a.meta?.regime ?? null, adx: a.meta?.adxValue ?? null,
    indicadores: (a.indicators ?? []).map((i) => ({ nome: i.name, cat: i.category, voto: i.vote, valor: typeof i.value === "number" ? i.value : null })),
    smc: dto.smc ? { vies: dto.smc.bias, estrutura: dto.smc.marketStructure } : null,
    multiTimeframe: dto.multiTimeframe ? { score: dto.multiTimeframe.confluenceScore, alinhamento: dto.multiTimeframe.alignment } : null,
    monte_carlo_prob_alta: dto.montecarlo ? dto.montecarlo.winRateUp.value : null,
    wyckoff: dto.wegd?.wyckoff?.phase ?? null, dow: dto.wegd?.dow?.primaryTrend ?? null,
    dados_classe: {
      dxy: extras.macro?.dxy ?? null, vix: extras.macro?.vix ?? null, juros_10y: extras.macro?.us10y ?? null,
      cot: extras.cot ? { netPctOI: extras.cot.netPctOfOi, vies: extras.cot.bias } : null,
      onchain_tvl: extras.onchain?.tvlUsd ? { tendencia: extras.onchain.tvlTrend } : null,
      breadth: extras.breadth ?? null,
      estoques_petroleo: extras.oil ? { vies: extras.oil.bias } : null,
      fundamentos: extras.fundamental ? { receitaYoY: extras.fundamental.revenueGrowthYoY, margem: extras.fundamental.netMarginTTM } : null,
    },
  };
}

/** Decisão do MOTOR LLM (estruturada, temp 0). `null` se IA off/falha. Independente do Motor 1. */
export async function generateLlmDecision(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          max_tokens: 160,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: LLM_DECISION_SYSTEM },
            { role: "user", content: `Dados medidos (JSON):\n${JSON.stringify(toDecisionFacts(dto, assetType, extras))}\n\nDecida.` },
          ],
        }),
      }),
      20000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ChatResponse;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const j = JSON.parse(raw) as { lado?: string; conviccao?: number; racional?: string };
    const lado = String(j.lado ?? "").toLowerCase();
    const side: LlmDecision["side"] = lado.startsWith("compra") ? "buy" : lado.startsWith("venda") ? "sell" : "neutral";
    const conviction = Math.max(0, Math.min(100, Number(j.conviccao) || 0));
    return { side, conviction, rationale: typeof j.racional === "string" ? j.racional.slice(0, 240) : "" };
  } catch {
    return null;
  }
}

/** Gera a narrativa do MOTOR 2 (leitura por classe), grounded na leitura + dados da família. */
export async function generateClassNarrative(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const r = computeClassReading(dto, assetType, extras);
  const plan = buildClassPlan(dto, r.side);
  const facts = {
    ativo: dto.analysis.meta.asset,
    timeframe: dto.analysis.meta.timeframe,
    classe: r.methodology.label,
    leitura: r.side === "buy" ? "COMPRA" : r.side === "sell" ? "VENDA" : "NEUTRO",
    conviccao_0a100: r.score,
    rotulo: r.label,
    metodologia: { manda: r.methodology.manda, apoio: r.methodology.apoio, cruzamentos: r.methodology.cruzamentos, cuidados: r.methodology.cuidados },
    fatores_a_favor: r.agree,
    fatores_contra: r.against,
    plano_por_atr: plan ? { entrada: plan.entry, stop: plan.stopLoss, tp1: plan.takeProfit1, tp2: plan.takeProfit2, tp3: plan.takeProfit3, rr1: plan.rr1 } : null,
    dados_pendentes: r.stillPending,
    dados_reais: {
      dxy: extras.macro?.dxy ?? null,
      vix: extras.macro?.vix ?? null,
      juros_10y: extras.macro?.us10y ?? null,
      cot: extras.cot ? { contrato: extras.cot.contract, netPctOI: extras.cot.netPctOfOi, vies: extras.cot.bias, esticado: extras.cot.extreme } : null,
      onchain_tvl: extras.onchain?.tvlUsd ? { tvlUsd: extras.onchain.tvlUsd, tendencia: extras.onchain.tvlTrend } : null,
      breadth: extras.breadth ?? null,
      estoques_petroleo: extras.oil ? { variacaoPct: extras.oil.weekChangePct, vies: extras.oil.bias } : null,
      fundamentos: extras.fundamental ? { empresa: extras.fundamental.companyName, receitaYoY: extras.fundamental.revenueGrowthYoY, margem: extras.fundamental.netMarginTTM, pl: extras.fundamental.peRatioTTM } : null,
      proximo_earnings: extras.earnings ? { data: extras.earnings.date, diasAte: extras.earnings.daysAway } : null,
    },
  };
  return callOpenAI(key, CLASS_NARRATIVE_SYSTEM, `Leitura por classe (JSON):\n${JSON.stringify(facts)}\n\nEscreva a leitura honesta do Motor 2.`);
}
