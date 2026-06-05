/**
 * Cliente LLM (OpenAI GPT-4o-mini) via fetch nativo.
 *
 * Por que fetch ao inves do SDK oficial:
 *   - SDK openai 4.x tem shims incompativeis com Next 15 + webpack
 *     (erro: 'init' not exported from _shims/index.mjs)
 *   - A API da OpenAI eh HTTP/JSON puro — fetch resolve em <80 linhas
 *   - Roda em qualquer runtime (Node, Edge, Workers, browser)
 *   - Bundle final menor (sem o SDK de ~500KB)
 *
 * Custos GPT-4o-mini (mai/2026):
 *   - Input: $0.15 / 1M tokens
 *   - Output: $0.60 / 1M tokens
 *   - Por analise completa: ~R$ 0,003
 *
 * Configuracao: OPENAI_API_KEY no .env.local
 *
 * Mantemos o cliente isolado para facilitar troca futura por outros providers
 * (Anthropic Claude Haiku, Llama self-host etc.) — a interface `LlmClient`
 * abstrai o provider.
 */

export interface LlmRequest {
  /** System prompt — define o papel e estilo do modelo */
  system: string;
  /** User prompt — pergunta/contexto da analise */
  user: string;
  /** Limite de tokens de saida (default 600 ~ 400 palavras PT-BR) */
  maxTokens?: number;
  /** Temperatura (0=deterministico, 1=criativo). Default 0.4 — narrativo + estavel */
  temperature?: number;
}

export interface LlmResponse {
  /** Texto gerado */
  text: string;
  /** Tokens consumidos — util pra contabilidade de custo */
  inputTokens: number;
  outputTokens: number;
  /** Modelo usado (audit) */
  model: string;
  /** Tempo de geracao em ms */
  durationMs: number;
}

export interface LlmClient {
  generate(req: LlmRequest): Promise<LlmResponse>;
}

const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIChoice {
  message?: { content?: string };
  finish_reason?: string;
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAIResponse {
  model?: string;
  choices?: OpenAIChoice[];
  usage?: OpenAIUsage;
  error?: { message?: string; type?: string; code?: string };
}

class OpenAILlmClient implements LlmClient {
  private apiKey: string | null;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    this.apiKey = key && key.trim().length > 0 ? key.trim() : null;
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  async generate(req: LlmRequest): Promise<LlmResponse> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY nao configurada. Configure no .env.local para habilitar explicacao por IA."
      );
    }

    const t0 = Date.now();

    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        max_tokens: req.maxTokens ?? 600,
        temperature: req.temperature ?? 0.4,
      }),
    });

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const errBody = (await res.json()) as OpenAIResponse;
        if (errBody?.error?.message) {
          detail = `${detail} — ${errBody.error.message}`;
        }
      } catch {
        // ignore — usa apenas status
      }
      throw new Error(`OpenAI API erro: ${detail}`);
    }

    const data = (await res.json()) as OpenAIResponse;

    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model ?? DEFAULT_MODEL,
      durationMs: Date.now() - t0,
    };
  }
}

// Singleton — instancia unica no servidor
let _instance: OpenAILlmClient | null = null;

export function getLlmClient(): OpenAILlmClient {
  if (!_instance) {
    _instance = new OpenAILlmClient();
  }
  return _instance;
}

/**
 * Verifica se LLM esta configurado (sem inicializar conexao).
 * Util para esconder o botao "Gerar com IA" se nao estiver disponivel.
 */
export function isLlmAvailable(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && key.trim().length > 0);
}
