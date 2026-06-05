/**
 * Histórico longo via paginação. A Binance limita 1000 candles/req; aqui
 * paginamos para trás (parâmetro `endTime`) até acumular `total` candles —
 * necessário para atingir as janelas de 24-36m da calibração.
 *
 * `fetchJson` é injetável (testável sem rede).
 */
import type { Candle, Timeframe } from "@tradeai/shared";
import { withRetry, isRetryableStatus } from "../http/with-retry";
import { withTimeout } from "../http/with-timeout";
import { binanceSymbol, BINANCE_INTERVAL } from "./symbols";
import { parseBinanceKlines } from "./parse";

export type JsonFetcher = (url: string) => Promise<unknown>;

type MinimalResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

export function realJsonFetcher(options: { fetchImpl?: (url: string) => Promise<MinimalResponse>; timeoutMs?: number; attempts?: number } = {}): JsonFetcher {
  const fetchImpl = options.fetchImpl ?? ((url: string) => fetch(url));
  const timeoutMs = options.timeoutMs ?? 15000;
  const attempts = options.attempts ?? 3;
  return (url) =>
    withRetry(
      async () => {
        const res = await withTimeout(fetchImpl(url), timeoutMs);
        if (!res.ok) {
          const e = new Error(`HTTP ${res.status}`) as Error & { status?: number };
          e.status = res.status;
          throw e;
        }
        return res.json();
      },
      { attempts, shouldRetry: (e) => isRetryableStatus((e as { status?: number }).status ?? 0) },
    );
}

const BINANCE_MAX_PER_REQ = 1000;

/**
 * Busca até `total` candles da Binance paginando para trás. Retorna ascendente,
 * sem duplicatas, com no máximo `total` candles (os mais recentes).
 */
export async function fetchBinanceHistory(
  symbol: string,
  timeframe: Timeframe,
  total: number,
  fetchJson: JsonFetcher,
): Promise<Candle[]> {
  const byTime = new Map<number, Candle>();
  let endTime: number | undefined;
  // teto de páginas: total/1000 + folga (evita loop infinito se o provedor repetir)
  const maxPages = Math.ceil(total / BINANCE_MAX_PER_REQ) + 3;

  for (let page = 0; page < maxPages && byTime.size < total; page++) {
    const limit = Math.min(BINANCE_MAX_PER_REQ, total - byTime.size + 1);
    const url =
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol(symbol)}` +
      `&interval=${BINANCE_INTERVAL[timeframe]}&limit=${limit}` +
      (endTime !== undefined ? `&endTime=${endTime}` : "");
    const candles = parseBinanceKlines(await fetchJson(url));
    if (candles.length === 0) break;

    for (const c of candles) byTime.set(c.time, c);
    const oldest = candles[0]!.time;
    // sem progresso (provedor não tem dado mais antigo) → para
    if (endTime !== undefined && oldest >= endTime) break;
    endTime = oldest - 1;
    if (candles.length < limit) break; // chegou no início do histórico
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time).slice(-total);
}
