/**
 * Schemas Zod das bordas (API + webhooks). Validação na entrada é a 1ª linha
 * de defesa. Reaproveita os enums do @tradeai/shared (fonte única).
 */
import { z } from "zod";
import { timeframeSchema, assetTypeSchema, signalDirectionSchema } from "@tradeai/shared";

/** POST /api/analyze */
export const analyzeInputSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  assetType: assetTypeSchema,
  timeframe: timeframeSchema,
  type: z.enum(["simple", "complete"]).default("complete"),
});
export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;

/** POST /api/simulator — Máquina do Tempo. A checagem "data no passado" fica
 *  na rota (depende do relógio; o schema é puro). */
export const simulatorInputSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  assetType: assetTypeSchema,
  timeframe: timeframeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD"),
});
export type SimulatorInput = z.infer<typeof simulatorInputSchema>;

/** Gatilho de alerta da watchlist: qualquer sinal ACIONÁVEL (compra ou venda). */
export const minSignalStrengthSchema = signalDirectionSchema.refine(
  (s) => s !== "NEUTRAL",
  { message: "min_signal_strength deve ser um sinal acionável (compra ou venda)" },
);

/** POST /api/watchlist */
export const watchlistCreateSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe: timeframeSchema,
  min_signal_strength: minSignalStrengthSchema.default("STRONG_BUY"),
  engine: z.enum(["padrao", "classe"]).default("padrao"),
});
export type WatchlistCreate = z.infer<typeof watchlistCreateSchema>;

/** Webhook HUBLA — modelo mínimo do que consumimos (idempotência por event id). */
export const hublaWebhookSchema = z.object({
  type: z.string().min(1),
  eventId: z.string().min(1).optional(),
  data: z.object({
    email: z.string().email().optional(),
    productId: z.string().optional(),
  }).passthrough(),
});
export type HublaWebhook = z.infer<typeof hublaWebhookSchema>;

/** Update do Telegram — só o que usamos (mensagem de texto + chat + autor). */
export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    text: z.string(),
    chat: z.object({ id: z.number() }),
    from: z.object({ id: z.number() }),
  }).optional(),
});
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

/**
 * Parse de comando do bot: "/btc 1h", "/eth 4h", "/xau 1d", "/help", "/start <token>".
 * Retorna null se não for um comando reconhecido.
 */
export interface TelegramCommand {
  command: string;
  args: string[];
}
export function parseTelegramCommand(text: string): TelegramCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? "";
  if (!command) return null;
  return { command, args: parts.slice(1) };
}
