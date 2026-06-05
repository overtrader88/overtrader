/**
 * Logger estruturado (pino). Substitui os `console.*` soltos do v1.
 *
 * Uso: `import { logger } from "@/lib/obs/logger"` e
 * `logger.warn({ event: "hubla.user_not_found", email }, "mensagem")`.
 */
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  base: { service: "tradeai-web" },
  // Em produção o transport vai para stdout (coletado pela Vercel/Sentry).
});

export type Logger = typeof logger;
