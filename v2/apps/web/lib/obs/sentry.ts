/**
 * Stub de captura de erros. No M4 troca pelo SDK real do Sentry
 * (`@sentry/nextjs`). Por ora, encaminha para o logger estruturado, garantindo
 * que nenhuma falha fique silenciosa (problema recorrente no v1).
 *
 * A API foi desenhada para casar com a do Sentry, então a troca futura é só de
 * implementação.
 */
import { logger } from "./logger";

const dsn = process.env.SENTRY_DSN;

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  logger.error({ event: "exception", dsnConfigured: Boolean(dsn), ...context, err: error }, "captureException");
  // TODO(M4): Sentry.captureException(error, { contexts: { app: context } })
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>,
): void {
  const fn = level === "error" ? logger.error : level === "warning" ? logger.warn : logger.info;
  fn.call(logger, { event: "message", dsnConfigured: Boolean(dsn), ...context }, message);
  // TODO(M4): Sentry.captureMessage(message, { level, contexts: { app: context } })
}
