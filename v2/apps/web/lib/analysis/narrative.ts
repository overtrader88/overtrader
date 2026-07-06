/**
 * Geração da leitura em linguagem natural (OpenAI), GROUNDED nos números medidos.
 * Extraída da rota /api/narrative para ser reusada também pelo Relatório Executivo
 * (PDF). Recebe o DTO já calculado e devolve o texto — ou `null` em qualquer falha
 * (sem key, timeout, IA fora): o chamador degrada gracioso.
 */
import { toNarrativeFacts } from "./narrative-facts";
import { withTimeout } from "@/lib/http/with-timeout";
import { SURV_START, SURV_FLOOR, type BankState } from "@/lib/signals/survival";
import { computeClassReading, buildClassPlan, type ClassExtras } from "./engines";
import { maxDurationFor } from "@/lib/signals/expiration";
import { DEFAULT_ENGINE_CONFIG } from "@tradeai/engine";
import type { FullAnalysis } from "./full";
import { TIMEFRAME_MS, isTimeframe, type AssetType } from "@tradeai/shared";

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
export interface LlmDecision {
  side: "buy" | "sell" | "neutral";
  conviction: number;
  rationale: string;
  /** Nível de referência declarado pela LLM (família VSF, era ~c1) — VALIDADO
   *  com régua dura no buildVsfPlan antes de ancorar o stop; null = ausente. */
  refLevel?: number | null;
}

/**
 * Provedores do MOTOR LLM. A decisão usa o protocolo OpenAI (chat/completions +
 * response_format json), que a DeepSeek implementa de forma compatível — por
 * isso o mesmo núcleo serve aos dois, trocando só baseURL/key/model.
 * Modelo e baseURL são tunáveis por env porque os nomes de modelo mudam (ex.: a
 * DeepSeek aposenta os aliases deepseek-chat/reasoner em 24/07/2026).
 */
interface LlmProvider { name: string; baseURL: string; apiKey: string | undefined; model: string; extraBody?: Record<string, unknown> }
function openAiProvider(): LlmProvider {
  return { name: "openai", baseURL: "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_LLM_MODEL || "gpt-4.1" };
}
function deepSeekProvider(): LlmProvider {
  // V4 vem com THINKING ligado por padrão — desligamos (modo direto): o raciocínio
  // estouraria o max_tokens e devolveria JSON truncado. Campo exclusivo da DeepSeek.
  return {
    name: "deepseek", baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY, model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    extraBody: { thinking: { type: "disabled" } },
  };
}

/**
 * Régua FIXA de convicção — compartilhada por todos os motores LLM.
 * Era ~c1 (achado 15, fase 1): a convicção deixa de ser "confiança" (vibes)
 * e vira PROBABILIDADE operacional — P(%) de tocar o TP1 antes do stop dentro
 * da janela de expiração do plano fornecido nos fatos. Calibração vira métrica
 * objetiva (reliability por bucket contra os desfechos forward). Gate (≥60) e
 * STRONG (≥80) seguem os MESMOS por ora — só a semântica do número mudou;
 * qualquer recalibração de corte espera ~100 resolvidos da era nova.
 */
const CONVICTION_RUBRIC = [
  "CALIBRAÇÃO DA CONVICÇÃO (semântica probabilística):",
  "conviccao = sua estimativa (0-100) da PROBABILIDADE de o preço tocar o TP1 ANTES do stop, dentro da janela de expiração do plano_execucao fornecido nos fatos.",
  "Sua estimativa será AUDITADA contra os desfechos reais: conviccao 70 deve acertar ~70% das vezes; 60, ~60%. Inflar ou deflacionar o número destrói a calibração — esse é o erro grave.",
  "Se a sua probabilidade estimada for menor que 60, responda 'neutro' (sem edge suficiente para o plano da casa).",
].join(" ");

/**
 * Restrições do plano no prompt (achado 16, era ~c1): o plano é FIXO e
 * determinístico — a LLM não escolhe geometria, só avalia se a tese cabe nela.
 * Instrução SUAVIZADA (sem mandato absoluto) pra não sobre-suprimir emissão;
 * monitorar taxa de emissão nas primeiras semanas.
 */
const PLAN_HORIZON_NOTE = [
  "O plano_execucao dos fatos é FIXO e determinístico (stop, alvos e expiração — a geometria NÃO é sua escolha).",
  "Considere se a resolução da tese cabe no horizonte (expira_em_candles × candle_horas) e se o stop fornecido tolera o pullback normal da própria tese;",
  "se claramente não couber ou exigir stop mais largo, prefira 'neutro'.",
].join(" ");

const LLM_DECISION_SYSTEM = [
  "Você é um MOTOR DE DECISÃO de trading. A partir dos dados MEDIDOS, decida a direção e a convicção.",
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\"}.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Pondere a CONFLUÊNCIA dos indicadores, a estrutura (SMC), o multi-timeframe, o regime e os dados macro/da classe fornecidos.",
  "Seja honesto: sinais conflitantes ou fracos → 'neutro' ou convicção baixa. NÃO invente dados além dos fornecidos.",
  "NÃO escreva nada fora do JSON.",
].join("\n");

/**
 * MOTOR LLM·CoT (achado 13, era ~c1): o JSON pede a ANÁLISE ANTES de lado e
 * convicção — num modelo autoregressivo, os tokens de deliberação saem antes
 * da decisão (no schema atual o 'racional' é justificativa post-hoc). Variante
 * A/B ao lado do `llm` (mesmo provider, gates, geometria e dedup); `llm` segue
 * como CONTROLE. A análise vira o rationale persistido (~600 chars).
 */
const LLM_COT_SYSTEM = [
  "Você é um MOTOR DE DECISÃO de trading. A partir dos dados MEDIDOS, DELIBERE por escrito e só então decida.",
  "Responda EXCLUSIVAMENTE em JSON válido, com os campos NESTA ORDEM:",
  "{\"analise\":\"3-5 frases pesando as confluências A FAVOR e o caso CONTRA (obrigatório considerar os dois lados)\",\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>}.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Pondere a CONFLUÊNCIA dos indicadores, a estrutura (SMC), o multi-timeframe, o regime e os dados macro/da classe fornecidos.",
  "Seja honesto: sinais conflitantes ou fracos → 'neutro' ou convicção baixa. NÃO invente dados além dos fornecidos.",
  "NÃO escreva nada fora do JSON.",
].join("\n");

/** Sistema do MOTOR LLM com MENTALIDADE DE SOBREVIVÊNCIA — a convicção vira tamanho
 *  de aposta; quebrar a banca = morte. Tende a ser mais seletivo (mais 'neutro'). */
const LLM_SURVIVAL_SYSTEM = [
  "Você é um MOTOR DE DECISÃO com MENTALIDADE DE SOBREVIVÊNCIA. Você opera uma conta de capital FINITO que é a SUA vida: se ela quebrar, você MORRE — não há segunda chance.",
  "Sua 'conviccao' define DIRETAMENTE o tamanho da aposta (convicção alta = aposta grande). Por isso, calibre com honestidade brutal.",
  "REGRAS DE SOBREVIVÊNCIA (nesta ordem):",
  "1) Preservar capital vem ANTES de buscar lucro. Um trade que você NÃO faz nunca te mata; uma sequência de apostas grandes em sinais fracos, sim.",
  "2) Só decida 'compra' ou 'venda' quando o edge for CLARO (confluência forte + estrutura SMC + multi-timeframe alinhados + regime a favor). Na menor dúvida: 'neutro'.",
  "3) A convicção segue a régua probabilística abaixo — estime a probabilidade com honestidade brutal; probabilidade alta em sinal comum é mentira que custa a sua vida.",
  "4) Pense assimétrico: prefira trades onde o ganho potencial é MUITO maior que a perda. Evite risco de ruína.",
  "5) Você recebe 'banca_sobrevivencia' (capital atual, drawdown, sequência recente, mortes). Após perdas seguidas ou drawdown alto, exija MAIS confluência antes de estimar probabilidades altas — proteger a vida vem primeiro.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\"}. NÃO escreva nada fora do JSON.",
].join("\n");

/** Sistema do MOTOR LLM especialista em NÍVEIS: volume + suporte/resistência + Fibonacci. */
const LLM_VSF_SYSTEM = [
  "Você é um MOTOR DE DECISÃO especialista em PRICE ACTION POR NÍVEIS. Decida com base PRINCIPALMENTE em três pilares, usando SÓ os níveis fornecidos:",
  "1) VOLUME: o POC e a área de valor (VAH/VAL) do perfil de volume são ímãs e barreiras de preço; OBV/MFI/CMF confirmam ou divergem do movimento.",
  "2) SUPORTE/RESISTÊNCIA: order blocks, zonas de liquidez e FVGs marcam ONDE o preço reage — compra perto de suporte forte, venda perto de resistência forte.",
  "3) FIBONACCI: as PRZ dos padrões harmônicos são zonas de reversão (confluência de retrações/extensões de Fibonacci).",
  "REGRAS:",
  "- O melhor trade é onde os TRÊS pilares CONFLUEM (ex.: preço numa PRZ de Fibonacci que coincide com um order block de suporte E o limite da área de valor por volume).",
  "- 'compra' perto de suporte/PRZ bullish com volume confirmando; 'venda' perto de resistência/PRZ bearish. Preço no meio do range, sem nível próximo → 'neutro'. Cada nível traz dist_atr (distância assinada em ATRs do preço atual) já calculada — use-a, não faça aritmética.",
  "- Probabilidade alta SOMENTE com confluência clara dos pilares perto do preço atual (|dist_atr| pequena). Sinal solto em um pilar só → convicção baixa ou 'neutro'. NÃO invente níveis além dos fornecidos.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\",\"nivel_referencia\":<preço EXATO de um dos níveis fornecidos que ancora a tese (o stop será atrás dele), ou null>}. NÃO escreva nada fora do JSON.",
].join("\n");

/** Stop dos motores LLM: ATR ×1.4 — o forward mostrou (padrão vs padrão-B e o
 *  Contrário TAMBÉM negativo) que o stop ×1.0 fica dentro do ruído e stopa os
 *  dois lados. Mudança versionada no engineVersion (~a14). Vive AQUI (fonte
 *  única) porque os fatos do prompt derivam stop_dist_atr dele (achado 16). */
export const LLM_ATR_SCALE = 1.4;

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Restrições INVARIANTES do plano da casa (achado 16, era ~c1) — derivadas em
 * runtime do config (nunca literais): stop em ATRs, RRs estruturais e a janela
 * de expiração REAL do juiz (mesmo mapa do cron resolve-signals). A família
 * VSF recebe a geometria verdadeira dela (stop por nível com guarda-corpo).
 */
function planFacts(dto: FullAnalysis, family: "atr" | "vsf"): unknown {
  const { slMult, tp1Mult, tp2Mult, tp3Mult } = DEFAULT_ENGINE_CONFIG.risk;
  const tfRaw = dto.analysis.meta.timeframe;
  const tf = isTimeframe(tfRaw) ? tfRaw : null;
  const stopAtr = round2(slMult * LLM_ATR_SCALE);
  return {
    ...(family === "atr"
      ? { stop_dist_atr: stopAtr }
      : { stop: `atrás do nível protegido mais próximo (folga 0.25 ATR; entre 0.6 e 2.5 ATR do preço); sem nível válido → ${stopAtr} ATR` }),
    tp1_rr: round2(tp1Mult / slMult),
    tp2_rr: round2(tp2Mult / slMult),
    tp3_rr: round2(tp3Mult / slMult),
    expira_em_candles: maxDurationFor(tfRaw),
    candle_horas: tf ? TIMEFRAME_MS[tf] / 3_600_000 : null,
  };
}

/** Contexto de TEMPO derivado do timestamp do ÚLTIMO candle — NUNCA de
 *  Date.now(): o /simulador reusa os motores com corte histórico e wall-clock
 *  quebraria a garantia sem-lookahead (achado 14, ajuste do cético). */
function timeContext(lastCandleMs: number | undefined): unknown {
  if (!lastCandleMs || !(lastCandleMs > 0)) return null;
  const d = new Date(lastCandleMs);
  const h = d.getUTCHours();
  const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
  const sessao = h < 7 ? "Ásia" : h < 12 ? "Londres" : h < 16 ? "Londres+NY" : h < 21 ? "NY" : "Ásia (abertura)";
  return { hora_utc: h, dia_semana: DIAS[d.getUTCDay()], sessao };
}

/** Fatos BRUTOS p/ a decisão da LLM — sem o veredito do Motor 1 (independência).
 *  Exportado: o Conselho de Guerra reusa os mesmos fatos p/ ancorar o chat.
 *  Era ~c1 (achados 14+16): + compressao_range20_atr, contexto_tempo e
 *  plano_execucao (escalares objetivos; SEM regra "comprimido→neutro" no prompt
 *  — o dado fala primeiro, a regra seria uma segunda mudança a testar separada). */
export function toDecisionFacts(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): unknown {
  const a = dto.analysis;
  return {
    ativo: a.meta.asset, timeframe: a.meta.timeframe, classe: assetType,
    // preço atual: sem ele a LLM não consegue situar os níveis (ex.: preço vs EMAs).
    preco_atual: a.risk?.entry ?? null,
    regime: a.meta?.regime ?? null, adx: a.meta?.adxValue ?? null,
    // compressão do range: range dos últimos 20 candles ÷ ATR (nº único que denuncia serrote)
    compressao_range20_atr: dto.compression20Atr != null ? round2(dto.compression20Atr) : null,
    contexto_tempo: timeContext(dto.lastCandleTime),
    plano_execucao: planFacts(dto, "atr"),
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

/** Ajustes por motor do protocolo de decisão (os defaults preservam os motores
 *  vigentes byte a byte): CoT precisa de folga p/ deliberar (achado 13); VSF
 *  ganhou o campo nivel_referencia (achado 17b). */
interface LlmCallOpts { maxTokens?: number; rationaleMax?: number }

/** Núcleo da decisão (estruturada, temp 0 na emissão; o MODO SOMBRA reusa com
 *  temp 0.7) via um provedor OpenAI-compatível. `null` se key ausente/falha. */
async function runLlmDecision(p: LlmProvider, dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, system: string = LLM_DECISION_SYSTEM, factsOverride?: unknown, temperature = 0, opts?: LlmCallOpts): Promise<LlmDecision | null> {
  if (!p.apiKey) return null;
  const facts = factsOverride ?? toDecisionFacts(dto, assetType, extras);
  try {
    const res = await withTimeout(
      fetch(`${p.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          temperature,
          max_tokens: opts?.maxTokens ?? 200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: `Dados medidos (JSON):\n${JSON.stringify(facts)}\n\nDecida.` },
          ],
          ...(p.extraBody ?? {}),
        }),
      }),
      25000,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ChatResponse;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const j = JSON.parse(raw) as { lado?: string; conviccao?: number; racional?: string; analise?: string; nivel_referencia?: unknown };
    const lado = String(j.lado ?? "").toLowerCase();
    const side: LlmDecision["side"] = lado.startsWith("compra") ? "buy" : lado.startsWith("venda") ? "sell" : "neutral";
    const conviction = Math.max(0, Math.min(100, Number(j.conviccao) || 0));
    // CoT (analise-first): a deliberação vira o rationale persistido; senão, o racional clássico.
    const rationaleRaw = typeof j.analise === "string" && j.analise ? j.analise : typeof j.racional === "string" ? j.racional : "";
    const nr = Number(j.nivel_referencia);
    return {
      side, conviction,
      rationale: rationaleRaw.slice(0, opts?.rationaleMax ?? 240),
      refLevel: Number.isFinite(nr) && nr > 0 ? nr : null,
    };
  } catch {
    return null;
  }
}

/** MOTOR LLM (OpenAI, gpt-4.1 por padrão). `null` se IA off/falha. Independente do Motor 1. */
export function generateLlmDecision(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  return runLlmDecision(openAiProvider(), dto, assetType, extras);
}

/** MOTOR LLM·DS (DeepSeek V4-Pro). Concorre lado a lado com o da OpenAI; `null` sem DEEPSEEK_API_KEY. */
export function generateLlmDecisionDS(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  return runLlmDecision(deepSeekProvider(), dto, assetType, extras);
}

/** MOTOR LLM·CoT (achado 13): analise-first no MESMO provider/fatos/gates do
 *  `llm` (controle). max_tokens 450 (3-5 frases PT-BR + JSON sem truncar) e a
 *  análise persiste como rationale (~600 chars). Thinking da DeepSeek segue
 *  DESLIGADO em toda parte — uma variável por vez. */
export function generateLlmDecisionCot(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  return runLlmDecision(openAiProvider(), dto, assetType, extras, LLM_COT_SYSTEM, undefined, 0, { maxTokens: 450, rationaleMax: 600 });
}

// ===================== MODO SOMBRA — self-consistency k=3 (achado 18a) =====================

/** Amostra de sombra: só lado + convicção (o racional da sombra não é persistido). */
export interface ShadowSample { side: LlmDecision["side"]; conviction: number }

/**
 * SELF-CONSISTENCY em MODO SOMBRA (achado 18, ajuste do cético): a EMISSÃO
 * continua exatamente como está (1 chamada, temp 0); esta função colhe k
 * amostras ADICIONAIS a temp 0.7 (em paralelo — latência ≈ 1 chamada) com o
 * MESMO system + fatos do motor base, e devolve lado+convicção de cada uma.
 * A concordância/dispersão vira METADADO do sinal emitido (colunas sc_* da
 * migration 0017; best-effort). Hipótese pré-registrada: sinais com convicção
 * 60-65 E dissenso interno têm WR pior — só vira filtro de emissão se
 * confirmar com ≥100 resolvidos com metadado. `null` = key ausente/tudo falhou.
 */
export async function generateLlmShadowSamples(
  provider: "gpt" | "ds", dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, k = 3,
): Promise<ShadowSample[] | null> {
  const p = provider === "gpt" ? openAiProvider() : deepSeekProvider();
  if (!p.apiKey) return null;
  try {
    const runs = await Promise.all(
      Array.from({ length: k }, () => runLlmDecision(p, dto, assetType, extras, LLM_DECISION_SYSTEM, undefined, 0.7)),
    );
    const ok = runs.filter((r): r is LlmDecision => r != null);
    return ok.length > 0 ? ok.map((r) => ({ side: r.side, conviction: r.conviction })) : null;
  } catch {
    return null;
  }
}

/** Estado da banca em formato de FATO pro prompt (ciclo fechado da sobrevivência). */
function bankFacts(bank: BankState | null | undefined): unknown {
  if (!bank) return { capital: SURV_START, situacao: "banca cheia — sem trades resolvidos ainda" };
  return {
    capital: Math.round(bank.equity * 10) / 10,
    capital_inicial: SURV_START,
    morre_abaixo_de: SURV_FLOOR,
    queda_do_pico_pct: bank.peak > 0 ? Math.round(((bank.peak - bank.equity) / bank.peak) * 100) : 0,
    pior_queda_pct: bank.maxDrawdownPct,
    ultimos_5_trades: bank.lastResults.join("") || "—", // G=ganho P=perda
    trades_da_vida_atual: bank.lifeTrades,
    mortes_anteriores: bank.deaths,
  };
}

/** Mescla o estado da banca nos fatos (a família *_surv decide VENDO a própria vida). */
const withBank = (facts: unknown, bank: BankState | null | undefined): unknown =>
  ({ ...(facts as Record<string, unknown>), banca_sobrevivencia: bankFacts(bank) });

/** MOTOR LLM SOBREVIVÊNCIA (GPT) — mesma IA, mas com mentalidade de capital finito. */
export function generateLlmDecisionSurv(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, bank?: BankState | null): Promise<LlmDecision | null> {
  return runLlmDecision(openAiProvider(), dto, assetType, extras, LLM_SURVIVAL_SYSTEM, withBank(toDecisionFacts(dto, assetType, extras), bank));
}

/** MOTOR LLM SOBREVIVÊNCIA (DeepSeek) — idem, no provedor DeepSeek. */
export function generateLlmDecisionDsSurv(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, bank?: BankState | null): Promise<LlmDecision | null> {
  return runLlmDecision(deepSeekProvider(), dto, assetType, extras, LLM_SURVIVAL_SYSTEM, withBank(toDecisionFacts(dto, assetType, extras), bank));
}

/** Fatos focados em NÍVEIS (volume + S/R + Fibonacci) — alimenta o motor VSF com os
 *  números REAIS do dto (POC/área de valor, order blocks/liquidez/FVG, PRZ harmônicas).
 *  Exportado: o Conselho de Guerra reusa os mesmos fatos p/ ancorar o chat.
 *  Era ~c1 (achado 17a): + `atr` absoluto e `dist_atr` pré-computada (assinada,
 *  em ATRs do preço) em CADA nível — a LLM não faz mais aritmética de distância.
 *  O filtro de níveis a >maxAtrDist ATRs é OPT-IN (só a família VSF passa
 *  { maxAtrDist: 3 }); evo_* e Conselho de Guerra seguem vendo tudo. POC/VAH/VAL
 *  são SEMPRE mantidos (núcleo do pilar volume), mesmo distantes. Sem ATR,
 *  omite dist_atr e não filtra (fallback: atrRatio×preço, como buildVsfPlan). */
export function toLevelsFacts(dto: FullAnalysis, opts?: { maxAtrDist?: number }): unknown {
  const a = dto.analysis;
  const price = a.risk?.entry ?? null;
  const vp = dto.volumeProfile;
  const smc = dto.smc;
  const harm = dto.harmonics;
  const atrVal = dto.atr && dto.atr > 0
    ? dto.atr
    : a.meta?.atrRatio && price ? a.meta.atrRatio * price : null;
  const distAtr = (level: number): number | null =>
    atrVal && price != null ? round2((level - price) / atrVal) : null;
  const keep = (level: number): boolean => {
    if (!opts?.maxAtrDist || !atrVal || price == null) return true;
    return Math.abs(level - price) <= opts.maxAtrDist * atrVal;
  };
  const volInd = (a.indicators ?? []).filter((i) => (i.category ?? "").toLowerCase().includes("vol"))
    .map((i) => ({ nome: i.name, voto: i.vote, valor: typeof i.value === "number" ? i.value : null }));
  return {
    ativo: a.meta.asset, timeframe: a.meta.timeframe, preco_atual: price, regime: a.meta?.regime ?? null,
    atr: atrVal,
    volume: {
      perfil: vp ? {
        poc: vp.poc, dist_atr_poc: distAtr(vp.poc),
        area_valor_alta: vp.vah, dist_atr_vah: distAtr(vp.vah),
        area_valor_baixa: vp.val, dist_atr_val: distAtr(vp.val),
      } : null,
      indicadores: volInd,
    },
    suporte_resistencia: smc ? {
      vies: smc.bias, estrutura: smc.marketStructure,
      order_blocks: (smc.orderBlocks ?? []).filter((o) => keep((o.zoneTop + o.zoneBottom) / 2)).slice(0, 4)
        .map((o) => ({ tipo: o.type, topo: o.zoneTop, base: o.zoneBottom, dist_atr: distAtr((o.zoneTop + o.zoneBottom) / 2) })),
      zonas_liquidez: (smc.liquidityZones ?? []).filter((z) => keep(z.level)).slice(0, 4)
        .map((z) => ({ tipo: z.type, nivel: z.level, varrida: z.swept, dist_atr: distAtr(z.level) })),
      fvgs: (smc.fvgs ?? []).filter((f) => keep((f.zoneTop + f.zoneBottom) / 2)).slice(0, 3)
        .map((f) => ({ tipo: f.type, topo: f.zoneTop, base: f.zoneBottom, dist_atr: distAtr((f.zoneTop + f.zoneBottom) / 2) })),
    } : null,
    fibonacci_harmonicos: harm?.patterns?.length
      ? harm.patterns.filter((p) => keep((p.prz.low + p.prz.high) / 2)).slice(0, 3)
        .map((p) => ({ direcao: p.direction, prz_baixo: p.prz.low, prz_alto: p.prz.high, dist_atr: distAtr((p.prz.low + p.prz.high) / 2), conclusao_pct: p.completion, qualidade: p.quality }))
      : null,
  };
}

/** Fatos da FAMÍLIA VSF: níveis filtrados a ≤3 ATR (ruído distante só gasta
 *  tokens) + as restrições do plano REAL dela (stop por nível, achado 16c). */
const vsfFacts = (dto: FullAnalysis): unknown => ({
  ...(toLevelsFacts(dto, { maxAtrDist: 3 }) as Record<string, unknown>),
  plano_execucao: planFacts(dto, "vsf"),
});

/** Folga de tokens da família VSF (era ~c1): o JSON ganhou `nivel_referencia`. */
const VSF_LLM_OPTS = { maxTokens: 250 } as const;

/** MOTOR VSF (GPT) — decisão por volume + suporte/resistência + Fibonacci. */
export function generateLlmDecisionVsf(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  return runLlmDecision(openAiProvider(), dto, assetType, extras, LLM_VSF_SYSTEM, vsfFacts(dto), 0, VSF_LLM_OPTS);
}

/** MOTOR VSF (DeepSeek) — idem, no provedor DeepSeek. */
export function generateLlmDecisionDsVsf(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras): Promise<LlmDecision | null> {
  return runLlmDecision(deepSeekProvider(), dto, assetType, extras, LLM_VSF_SYSTEM, vsfFacts(dto), 0, VSF_LLM_OPTS);
}

/** Sistema VSF + SOBREVIVÊNCIA: decide por níveis (vol/S-R/Fib) com mente de capital finito. */
const LLM_VSF_SURV_SYSTEM = [
  "Você é um MOTOR DE DECISÃO especialista em NÍVEIS (volume + suporte/resistência + Fibonacci) com MENTALIDADE DE SOBREVIVÊNCIA: opera uma conta de capital FINITO que é a SUA vida — se quebrar, MORRE.",
  "Decida pela confluência de três pilares, usando SÓ os níveis fornecidos:",
  "1) VOLUME: POC e área de valor (VAH/VAL) são ímãs/barreiras; OBV/MFI/CMF confirmam ou divergem.",
  "2) SUPORTE/RESISTÊNCIA: order blocks, zonas de liquidez e FVGs marcam onde o preço reage.",
  "3) FIBONACCI: as PRZ dos padrões harmônicos são zonas de reversão.",
  "REGRAS DE SOBREVIVÊNCIA (a 'conviccao' define o TAMANHO da aposta — calibre com honestidade brutal):",
  "- Preservar capital vem ANTES do lucro: sem confluência clara dos pilares perto do preço → 'neutro' (ficar de fora não custa nada).",
  "- Probabilidade alta SOMENTE quando os 3 pilares confluem forte perto do preço (use a dist_atr já calculada de cada nível). Sinal solto em um pilar só → convicção baixa ou 'neutro'.",
  "- Compra perto de suporte/PRZ bullish com volume confirmando; venda perto de resistência/PRZ bearish. NÃO invente níveis além dos fornecidos.",
  "- Você recebe 'banca_sobrevivencia' (capital atual, drawdown, sequência recente, mortes). Após perdas seguidas ou drawdown alto, exija MAIS confluência antes de estimar probabilidades altas — proteger a vida vem primeiro.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\",\"nivel_referencia\":<preço EXATO de um dos níveis fornecidos que ancora a tese (o stop será atrás dele), ou null>}. NÃO escreva nada fora do JSON.",
].join("\n");

/** MOTOR VSF+SOBREVIVÊNCIA (GPT) — níveis com mentalidade de capital finito. */
export function generateLlmDecisionVsfSurv(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, bank?: BankState | null): Promise<LlmDecision | null> {
  return runLlmDecision(openAiProvider(), dto, assetType, extras, LLM_VSF_SURV_SYSTEM, withBank(vsfFacts(dto), bank), 0, VSF_LLM_OPTS);
}

/** MOTOR VSF+SOBREVIVÊNCIA (DeepSeek) — idem, no provedor DeepSeek. */
export function generateLlmDecisionDsVsfSurv(dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, bank?: BankState | null): Promise<LlmDecision | null> {
  return runLlmDecision(deepSeekProvider(), dto, assetType, extras, LLM_VSF_SURV_SYSTEM, withBank(vsfFacts(dto), bank), 0, VSF_LLM_OPTS);
}

// ===================== EVOLUÇÃO DARWINIANA (motores evo_*) =====================

/** Chamada de TEXTO genérica a um provedor (autópsia, cruzamento). `null` em falha. */
async function callProviderText(p: LlmProvider, system: string, user: string, maxTokens: number, temperature = 0.4): Promise<string | null> {
  if (!p.apiKey) return null;
  try {
    const res = await withTimeout(
      fetch(`${p.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model, temperature, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          ...(p.extraBody ?? {}),
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

/** Contrato FIXO dos motores evolutivos — o núcleo evolui, o contrato nunca.
 *  Garante que nenhuma mutação quebre o formato de saída nem as regras da casa. */
const EVO_CONTRACT = [
  "Você é um MOTOR DE DECISÃO de trading evolutivo com capital FINITO (se a banca quebrar, esta estratégia MORRE e é substituída).",
  "Aplique a ESTRATÉGIA-NÚCLEO acima sobre os dados MEDIDOS fornecidos. NÃO invente dados além dos fornecidos.",
  CONVICTION_RUBRIC,
  PLAN_HORIZON_NOTE,
  "Responda EXCLUSIVAMENTE em JSON válido: {\"lado\":\"compra|venda|neutro\",\"conviccao\":<0-100>,\"racional\":\"1 frase curta\"}. NÃO escreva nada fora do JSON.",
].join("\n");

/** Núcleos-semente da geração 1 (derivados das famílias com melhor forward até aqui). */
export const EVO_SEED_CORES: Record<"gpt" | "ds", string> = {
  gpt: [
    "ESTRATÉGIA-NÚCLEO (g1 — níveis seletivos): opere APENAS quando o preço estiver encostado num nível objetivo — order block, zona de liquidez, VAL/VAH do perfil de volume ou PRZ de Fibonacci.",
    "Compra em suporte com volume confirmando; venda em resistência com volume confirmando. Preço no meio do range → neutro.",
    "Exija pelo menos DOIS pilares independentes concordando. Em regime de transição/explosão de volatilidade, exija três.",
  ].join("\n"),
  ds: [
    "ESTRATÉGIA-NÚCLEO (g1 — tendência com estrutura): opere APENAS a favor da estrutura de mercado (SMC) quando o multi-timeframe estiver alinhado.",
    "Entre em pullbacks: preço voltando a uma média (EMA20/50) ou order block A FAVOR da tendência dominante. Contra-tendência → neutro, sempre.",
    "ADX baixo (<20) ou estrutura lateral → neutro. Prefira poucos trades com tendência clara a muitos trades medianos.",
  ].join("\n"),
};

/** Decisão de um motor EVOLUTIVO: núcleo (do banco) + contrato fixo + fatos completos. */
export function generateEvoDecision(core: string, provider: "gpt" | "ds", dto: FullAnalysis, assetType: AssetType, extras: ClassExtras, bank?: BankState | null): Promise<LlmDecision | null> {
  const p = provider === "gpt" ? openAiProvider() : deepSeekProvider();
  const system = `${core}\n\n${EVO_CONTRACT}`;
  // fatos completos (indicadores+classe) + níveis + banca — o núcleo escolhe o que usar
  const facts = { ...(toDecisionFacts(dto, assetType, extras) as Record<string, unknown>), niveis: toLevelsFacts(dto), banca_sobrevivencia: bankFacts(bank) };
  return runLlmDecision(p, dto, assetType, extras, system, facts);
}

/** CRUZAMENTO: gera o núcleo-filho a partir de dois núcleos-pais (com mutação).
 *  Chamado quando a banca do núcleo atual QUEBRA. `null` em falha (mantém o pai). */
export function breedEvoCore(parentA: string, parentB: string, provider: "gpt" | "ds", deathContext: string): Promise<string | null> {
  const p = provider === "gpt" ? openAiProvider() : deepSeekProvider();
  const system = [
    "Você é um engenheiro de estratégias de trading. O motor que usava o NÚCLEO A quebrou a banca e morreu.",
    "Crie um NÚCLEO-FILHO em português: combine os pontos fortes de A e B e introduza UMA mutação significativa que ataque a causa da morte (ex.: filtro novo, exigência de confluência maior, regime a evitar, gestão mais defensiva).",
    "Regras: 3 a 6 linhas, começando por 'ESTRATÉGIA-NÚCLEO'; critérios OBJETIVOS e verificáveis nos dados (indicadores, SMC, volume, Fibonacci, regime, multi-timeframe); em dúvida, mande ser neutro.",
    "Responda APENAS com o texto do núcleo — sem comentários.",
  ].join("\n");
  const user = `NÚCLEO A (morto):\n${parentA}\n\nNÚCLEO B (sobrevivente):\n${parentB}\n\nCONTEXTO DA MORTE:\n${deathContext}`;
  return callProviderText(p, system, user, 350, 0.7);
}

// ===================== AUTÓPSIA (post-mortem de sinal no SL) =====================

/** Autópsia de um sinal que morreu no stop — 3-4 frases honestas sobre O QUE falhou.
 *  gpt-4o-mini (volume baixo, custo centavos). `null` em falha (coluna fica vazia). */
export async function generateAutopsy(sig: {
  symbol: string; timeframe: string; side: string; engine: string;
  entry: number; stopLoss: number; exitPrice: number | null; durationCandles: number | null;
  conviction: number | null; rationale: string | null; regime: string | null;
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const system = [
    "Você é o legista de sinais do Overtrader. Um sinal morreu no STOP LOSS. Escreva a AUTÓPSIA em português do Brasil: 3-4 frases, tom técnico e honesto.",
    "Estrutura: (1) o que a tese esperava; (2) o que o mercado fez em vez disso; (3) a lição objetiva (qual tipo de filtro/contexto teria evitado ou reduzido o dano).",
    "Nunca culpe 'azar', nunca prometa que a próxima acerta, não invente dados além dos fornecidos. Sem emojis.",
  ].join("\n");
  const facts = {
    ativo: sig.symbol, timeframe: sig.timeframe, lado: sig.side === "sell" ? "venda" : "compra", motor: sig.engine,
    entrada: sig.entry, stop: sig.stopLoss, saida: sig.exitPrice, duracao_candles: sig.durationCandles,
    conviccao_na_emissao: sig.conviction, tese_na_emissao: sig.rationale, regime_na_emissao: sig.regime,
  };
  return callProviderText({ ...openAiProvider(), model: "gpt-4o-mini" }, system, `Dados do óbito (JSON):\n${JSON.stringify(facts)}`, 260, 0.3);
}

/** Diagnóstico de um provedor: ping mínimo que revela o motivo REAL da falha
 *  (chave ausente no deploy / 401 valor errado / 400 modelo errado). Nunca
 *  vaza a key — `detail` é só o corpo de erro do provedor (que mascara a key). */
export interface LlmProbe { provider: string; model: string; baseURL: string; configured: boolean; ok: boolean; status: number | null; ms: number; detail: string }
async function probeOne(p: LlmProvider): Promise<LlmProbe> {
  const base = { provider: p.name, model: p.model, baseURL: p.baseURL };
  if (!p.apiKey) return { ...base, configured: false, ok: false, status: null, ms: 0, detail: "API key AUSENTE neste deploy — env não setada (ou escopo/redeploy faltando na Vercel)." };
  const t0 = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${p.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model, temperature: 0, max_tokens: 40,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: 'Responda em JSON: {"ok":true}.' }, { role: "user", content: "ping" }],
          ...(p.extraBody ?? {}),
        }),
      }),
      20000,
    );
    const body = await res.text();
    return { ...base, configured: true, ok: res.ok, status: res.status, ms: Date.now() - t0, detail: res.ok ? "OK — chave e modelo respondendo." : body.slice(0, 300) };
  } catch (e) {
    return { ...base, configured: true, ok: false, status: null, ms: Date.now() - t0, detail: `falha de rede/timeout: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Sonda OpenAI + DeepSeek em paralelo (diagnóstico admin). */
export function probeLlmProviders(): Promise<LlmProbe[]> {
  return Promise.all([probeOne(openAiProvider()), probeOne(deepSeekProvider())]);
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
