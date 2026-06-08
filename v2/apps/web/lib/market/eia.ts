/**
 * EIA (U.S. Energy Information Administration) — estoques semanais de petróleo,
 * GRATUITO mas exige API key (registro grátis em https://www.eia.gov/opendata/).
 * Gate em EIA_API_KEY: sem key → null (mesmo padrão do FMP). Ativa sozinho quando
 * a key entrar no env. Só faz sentido p/ energia (petróleo) — não p/ ouro.
 *
 * Série WCESTUS1 = Weekly U.S. Ending Stocks of Crude Oil (mil barris).
 * Estoques subindo = oferta folgada → vento contra o petróleo; caindo = aperto.
 */
const EIA_V2 = "https://api.eia.gov/v2/petroleum/stoc/wstk/data/";

export interface OilInventory {
  latestKb: number;        // estoque atual (mil barris)
  weekChangeKb: number;    // variação vs. semana anterior (mil barris)
  weekChangePct: number;   // variação %
  period: string;          // data do dado
  bias: "bull" | "bear" | "neutral"; // estoque caindo = bull; subindo = bear
}

const OIL_RE = /(WTI|BRENT|USOIL|UKOIL|CRUDE|^CL$|OIL)/;

export function isOilSymbol(symbol: string): boolean {
  return OIL_RE.test(symbol.toUpperCase());
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function getOilInventory(symbol: string): Promise<OilInventory | null> {
  const key = process.env.EIA_API_KEY;
  if (!key || !isOilSymbol(symbol)) return null;
  try {
    const params = new URLSearchParams({
      api_key: key,
      frequency: "weekly",
      "data[0]": "value",
      "facets[series][]": "WCESTUS1",
      "sort[0][column]": "period",
      "sort[0][direction]": "desc",
      length: "2",
    });
    const r = await fetch(`${EIA_V2}?${params.toString()}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { response?: { data?: Record<string, unknown>[] } };
    const rows = j.response?.data;
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const latest = num(rows[0]?.value);
    const prev = num(rows[1]?.value);
    const period = typeof rows[0]?.period === "string" ? (rows[0].period as string) : null;
    if (latest == null || prev == null || !(prev > 0) || !period) return null;
    const weekChangeKb = latest - prev;
    const weekChangePct = (weekChangeKb / prev) * 100;
    const bias: OilInventory["bias"] = Math.abs(weekChangePct) < 0.3 ? "neutral" : weekChangeKb > 0 ? "bear" : "bull";
    return { latestKb: latest, weekChangeKb, weekChangePct, period, bias };
  } catch {
    return null;
  }
}
