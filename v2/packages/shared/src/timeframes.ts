/**
 * Timeframes suportados — fonte única da verdade.
 *
 * No v1 esta lista estava hardcoded em 3+ lugares (analyze, watchlist, telegram).
 * Aqui é declarada uma vez, com const + enum Zod derivado, e reusada em todo o app.
 */
import { z } from "zod";

export const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

/** Enum Zod para validar input de API/webhook. */
export const timeframeSchema = z.enum(TIMEFRAMES);

/** Label amigável por timeframe. */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "15m": "15 minutos",
  "1h": "1 hora",
  "4h": "4 horas",
  "1d": "Diário",
  "1w": "Semanal",
  "1M": "Mensal",
};

/** Duração aproximada de cada timeframe em milissegundos. */
export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
  "1M": 30 * 24 * 60 * 60_000,
};

export function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && (TIMEFRAMES as readonly string[]).includes(value);
}
