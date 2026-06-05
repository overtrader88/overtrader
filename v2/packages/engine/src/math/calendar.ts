/**
 * Períodos por ano por (assetType, timeframe) — para anualizar volatilidade
 * corretamente. Corrige o `stepsPerYear` FIXO em 2160 do v1 (que assumia
 * cripto 24/7 para todos os ativos, errando forex/ações).
 *
 * Valores são aproximações de calendário de negociação — marcados [APROXIMADO].
 */
import type { AssetType, Timeframe } from "@tradeai/shared";

/** Horas ativas de negociação por ano e dias de pregão por ano, por mercado. */
function calendar(assetType: AssetType): { activeHoursPerYear: number; tradingDaysPerYear: number } {
  switch (assetType) {
    case "crypto":
      return { activeHoursPerYear: 365 * 24, tradingDaysPerYear: 365 };
    case "forex":
    case "commodities":
      // ~24h, ~5 dias/semana
      return { activeHoursPerYear: 260 * 24, tradingDaysPerYear: 260 };
    case "stocks":
    case "indices":
      // ~6.5h/pregão, ~252 pregões
      return { activeHoursPerYear: 252 * 6.5, tradingDaysPerYear: 252 };
  }
}

/** Quantos candles de um timeframe cabem num ano de negociação. */
export function periodsPerYear(assetType: AssetType, timeframe: Timeframe): number {
  const { activeHoursPerYear, tradingDaysPerYear } = calendar(assetType);
  switch (timeframe) {
    case "15m":
      return activeHoursPerYear / 0.25;
    case "1h":
      return activeHoursPerYear;
    case "4h":
      return activeHoursPerYear / 4;
    case "1d":
      return tradingDaysPerYear;
    case "1w":
      return 52;
    case "1M":
      return 12;
  }
}
