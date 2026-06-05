/**
 * Índice Fear & Greed (cripto) — fonte pública alternative.me (free, sem key).
 *
 * Parser PURO + fetcher injetável (testável sem rede). Qualquer falha vira `null`
 * — a tela degrada graciosamente ("indisponível") em vez de quebrar. Honesto: a
 * UI credita a fonte; é um índice publicado, não um número nosso.
 */
import { withTimeout } from "../http/with-timeout";

export interface FearGreed {
  /** 0-100 */
  value: number;
  /** Classificação original (en) da fonte: Extreme Fear … Extreme Greed. */
  classification: string;
  /** ms epoch da leitura (0 se ausente). */
  timestamp: number;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const FNG_URL = "https://api.alternative.me/fng/?limit=1";
const defaultFetch: FetchLike = (url) => fetch(url, { next: { revalidate: 1800 } });

/** Parser PURO do payload da alternative.me. Retorna null se malformado. */
export function parseFearGreed(payload: unknown): FearGreed | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as { value?: unknown; value_classification?: unknown; timestamp?: unknown };
  const value = Number(first.value);
  if (!Number.isFinite(value)) return null;
  const classification = typeof first.value_classification === "string" ? first.value_classification : "Unknown";
  const tsSec = Number(first.timestamp);
  const timestamp = Number.isFinite(tsSec) ? tsSec * 1000 : 0;
  return { value: Math.round(value), classification, timestamp };
}

/** Busca o índice atual. Retorna null em qualquer falha (timeout/rede/parse). */
export async function fetchFearGreed(fetcher: FetchLike = defaultFetch): Promise<FearGreed | null> {
  try {
    const res = await withTimeout(fetcher(FNG_URL), 4000);
    if (!res.ok) return null;
    return parseFearGreed(await res.json());
  } catch {
    return null;
  }
}
