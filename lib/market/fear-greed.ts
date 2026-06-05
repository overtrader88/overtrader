/**
 * Cliente do Crypto Fear & Greed Index (Alternative.me).
 *
 * API pública, gratuita, sem auth.
 * Doc: https://alternative.me/crypto/fear-and-greed-index/
 *
 * Range: 0 (Extreme Fear) → 100 (Extreme Greed)
 * Atualização: 1x por dia.
 */

export interface FearGreedEntry {
  value: number;
  classification:
    | "Extreme Fear"
    | "Fear"
    | "Neutral"
    | "Greed"
    | "Extreme Greed";
  timestamp: number; // unix seconds
}

export interface FearGreedSnapshot {
  current: FearGreedEntry;
  yesterday: FearGreedEntry | null;
  delta: number; // diff atual - ontem
  trend: "up" | "down" | "flat";
}

const BASE = "https://api.alternative.me/fng/";

export async function fetchFearGreed(): Promise<FearGreedSnapshot> {
  const url = `${BASE}?limit=2&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // F&G muda 1x por dia — cache de 30 minutos é seguro
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    throw new Error(`Fear & Greed API: HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: Array<{
      value: string;
      value_classification: string;
      timestamp: string;
      time_until_update?: string;
    }>;
  };

  const data = json.data;
  if (!data || data.length === 0) {
    throw new Error("Fear & Greed API: resposta vazia");
  }

  const toEntry = (d: {
    value: string;
    value_classification: string;
    timestamp: string;
  }): FearGreedEntry => ({
    value: parseInt(d.value, 10),
    classification: d.value_classification as FearGreedEntry["classification"],
    timestamp: parseInt(d.timestamp, 10),
  });

  const current = toEntry(data[0]);
  const yesterday = data[1] ? toEntry(data[1]) : null;
  const delta = yesterday ? current.value - yesterday.value : 0;
  const trend: FearGreedSnapshot["trend"] =
    delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return { current, yesterday, delta, trend };
}

/** Mapeia classificação inglês → português para UI */
export function classificationPt(c: FearGreedEntry["classification"]): string {
  const map: Record<FearGreedEntry["classification"], string> = {
    "Extreme Fear": "Medo Extremo",
    Fear: "Medo",
    Neutral: "Neutro",
    Greed: "Ganância",
    "Extreme Greed": "Ganância Extrema",
  };
  return map[c] ?? c;
}

/** Cor (hex) por faixa de valor — usado em UI */
export function classificationColor(value: number): string {
  if (value <= 24) return "#dc2626"; // medo extremo - vermelho
  if (value <= 49) return "#f97316"; // medo - laranja
  if (value <= 54) return "#a3a3a3"; // neutro - cinza
  if (value <= 74) return "#22c55e"; // ganância - verde
  return "#10b981"; // ganância extrema - verde escuro
}
