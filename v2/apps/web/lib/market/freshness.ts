/**
 * Frescor de candles p/ a EMISSÃO (era -j2, achados 19/24 da revisão dos motores).
 * PURO e testável — a borda injeta `nowMs`.
 *
 * - `dropFormingCandles`: descarta candle(s) do fim da série ainda EM FORMAÇÃO
 *   (`time + tf > now`). O cron emite na virada exata do candle, então o último
 *   elemento tem segundos de vida (quasi-doji, volume ~0) e contaminava ATR/RSI/
 *   volume profile — o backtest que dá o selo só vê candles fechados.
 *   LIMITAÇÃO conhecida: em mercados com pregão (SPX/forex/ações) no TF diário o
 *   provedor carimba o candle com o timestamp de ABERTURA da sessão — após o
 *   fechamento do pregão `open + 24h > now` ainda descarta um candle já fechado.
 *   Comportamento CONSERVADOR (nunca introduz lookahead; lag máx. de 1 candle),
 *   aceito na revisão. NÃO usar no resolve-signals: high/low do candle em
 *   formação são preços reais já negociados (atrasaria a detecção de SL/TP).
 *
 * - `isStaleForEmission`: bloqueia emissão com dado velho, medido pelo CLOSE
 *   esperado do último candle fechado — `now − (last.time + tf) > 0.5×tf` — e
 *   não pelo open (com provedores que só devolvem candles fechados a idade pelo
 *   open é sempre ≈1×tf). Mata os ticks intraday fantasma do SPX 4h (00/04/08
 *   UTC operavam preço de 4-16h atrás) e protege cripto de provider degradado.
 *   Tolerância extra de +48h no 1d NÃO-cripto: com timestamp de sessão + gap de
 *   fim de semana, a segunda-feira inteira ficaria "stale" por falso positivo.
 */
import { TIMEFRAME_MS, type AssetType, type Candle, type Timeframe } from "@tradeai/shared";

/** Descarta do FIM da série os candles ainda em formação (`time + tf > now`). */
export function dropFormingCandles(candles: Candle[], timeframe: Timeframe, nowMs: number): Candle[] {
  const tfMs = TIMEFRAME_MS[timeframe];
  if (!tfMs) return candles;
  let end = candles.length;
  while (end > 0 && candles[end - 1]!.time + tfMs > nowMs) end--;
  return end === candles.length ? candles : candles.slice(0, end);
}

const STALE_GRACE_1D_SESSION_MS = 48 * 60 * 60_000;

/**
 * `true` quando o último candle FECHADO está velho demais para ancorar uma
 * emissão: `now − (lastCandleTime + tf) > 0.5×tf` (+48h no 1d não-cripto,
 * p/ o gap de fim de semana com timestamp de sessão).
 */
export function isStaleForEmission(
  lastCandleTime: number,
  timeframe: Timeframe,
  assetType: AssetType,
  nowMs: number,
): boolean {
  const tfMs = TIMEFRAME_MS[timeframe];
  if (!tfMs || !Number.isFinite(lastCandleTime)) return false;
  const grace = timeframe === "1d" && assetType !== "crypto" ? STALE_GRACE_1D_SESSION_MS : 0;
  return nowMs - (lastCandleTime + tfMs) > 0.5 * tfMs + grace;
}
