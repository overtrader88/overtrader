/**
 * Validação de variáveis de ambiente com Zod.
 *
 * Avaliação PREGUIÇOSA e memoizada: a validação roda no PRIMEIRO acesso ao
 * `env` em runtime (falha rápido e com mensagem clara se faltar var), mas NÃO
 * no import — assim o build de CI, que não tem `.env`, não quebra.
 *
 * Separamos vars públicas (NEXT_PUBLIC_*) das server-only. Segredos como
 * SUPABASE_SERVICE_ROLE_KEY nunca devem aparecer no bundle do cliente.
 */
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().optional(),

  // Supabase (obrigatório)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Site
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // IA (obrigatório p/ narrativa)
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_LLM_MODEL: z.string().optional(), // modelo do MOTOR LLM·GPT (default gpt-4.1)

  // DeepSeek (opcional) — MOTOR LLM·DS, concorre com o da OpenAI. API compatível.
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().optional(),   // default deepseek-v4-pro
  DEEPSEEK_BASE_URL: z.string().url().optional(), // default https://api.deepseek.com/v1

  // Admin + cron
  ADMIN_EMAILS: z.string().min(1),
  CRON_SECRET: z.string().min(32, "CRON_SECRET deve ter ≥ 32 chars"),

  // Market data (opcional — cripto via Binance não precisa)
  TWELVEDATA_API_KEY: z.string().optional(),
  FMP_API_KEY: z.string().optional(),
  EIA_API_KEY: z.string().optional(), // estoques de petróleo (Motor 2 commodities; grátis c/ registro)

  // Notícias (opcional) — provedor ativo via NEWS_PROVIDER (default "newsdata")
  WORLDNEWS_API_KEY: z.string().optional(),
  NEWSDATA_API_KEY: z.string().optional(),
  NEWS_PROVIDER: z.enum(["worldnews", "newsdata"]).optional(),

  // Telegram (opcional até configurar o bot)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_SIGNALS_CHAT_ID: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(), // placar dos motores p/ o admin

  // E-mail (Resend) — opcional; no-op gracioso sem credenciais
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // HUBLA (opcional até configurar pagamentos)
  HUBLA_WEBHOOK_SECRET: z.string().optional(),
  HUBLA_URL_SECRET: z.string().optional(), // 2ª camada: segredo nosso na URL (?k=)
  HUBLA_PRODUCT_PRO_MONTHLY: z.string().optional(),
  HUBLA_PRODUCT_PRO_ANNUAL: z.string().optional(),
  HUBLA_PRODUCT_PRO_PLUS_MONTHLY: z.string().optional(),
  HUBLA_PRODUCT_PRO_PLUS_ANNUAL: z.string().optional(),
  HUBLA_CHECKOUT_URL_PRO_MONTHLY: z.string().url().optional(),
  HUBLA_CHECKOUT_URL_PRO_ANNUAL: z.string().url().optional(),
  HUBLA_CHECKOUT_URL_PRO_PLUS_MONTHLY: z.string().url().optional(),
  HUBLA_CHECKOUT_URL_PRO_PLUS_ANNUAL: z.string().url().optional(),

  // Observabilidade (opcional)
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Valida e devolve o env do servidor (memoizado). Lança no primeiro acesso se inválido. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
