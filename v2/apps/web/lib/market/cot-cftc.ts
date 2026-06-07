/**
 * COT (Commitments of Traders) da CFTC — API pública e GRATUITA (Socrata, sem
 * key). Relatório Legacy "futures-only" (dataset 6dca-aqww), semanal. Posição dos
 * grandes especuladores (non-commercial) p/ forex e commodities. Falha → null.
 *
 * Convenção: specs líquido comprado = viés de alta da MOEDA/COMMODITY do contrato.
 * Em pares onde o USD é a BASE (USDJPY), o contrato é da moeda estrangeira → o
 * viés é INVERTIDO para o par. Em extremos, posição muito esticada = risco de
 * reversão (sinalizado, mas mantemos o viés de tendência com peso baixo).
 */
const COT_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

interface CotMap { name: string; inverse: boolean }

/** ticker normalizado → contrato exato CFTC + se o viés deve ser invertido p/ o par. */
const COT_MAP: Record<string, CotMap> = {
  // Forex (futuros CME da moeda estrangeira vs USD)
  EURUSD: { name: "EURO FX", inverse: false },
  GBPUSD: { name: "BRITISH POUND", inverse: false },
  AUDUSD: { name: "AUSTRALIAN DOLLAR", inverse: false },
  NZDUSD: { name: "NEW ZEALAND DOLLAR", inverse: false },
  USDJPY: { name: "JAPANESE YEN", inverse: true },
  USDCAD: { name: "CANADIAN DOLLAR", inverse: true },
  USDCHF: { name: "SWISS FRANC", inverse: true },
  // Commodities
  XAUUSD: { name: "GOLD", inverse: false },
  XAGUSD: { name: "SILVER", inverse: false },
  WTIUSD: { name: "CRUDE OIL, LIGHT SWEET-WTI", inverse: false },
  USOIL: { name: "CRUDE OIL, LIGHT SWEET-WTI", inverse: false },
  CL: { name: "CRUDE OIL, LIGHT SWEET-WTI", inverse: false },
  UKOIL: { name: "CRUDE OIL, BRENT", inverse: false },
};

export interface CotPositioning {
  contract: string;
  reportDate: string;       // ISO da semana do relatório
  netSpec: number;          // long - short (non-commercial)
  netPctOfOi: number;       // netSpec / open interest (decimal)
  weekChangePctOfOi: number; // variação semanal do net, em % do OI atual
  rangePos: number;         // 0–1: onde o net% está na faixa de ~6 meses
  extreme: boolean;         // posição esticada (perto da máx/mín de 6 meses)
  bias: "bull" | "bear" | "neutral"; // já considerando inversão do par
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

function lookup(symbol: string): CotMap | null {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const direct = COT_MAP[s];
  if (direct) return direct;
  // tolera prefixos comuns de ouro/prata/óleo
  if (s.startsWith("XAU")) return COT_MAP.XAUUSD ?? null;
  if (s.startsWith("XAG")) return COT_MAP.XAGUSD ?? null;
  if (s.includes("BRENT")) return COT_MAP.UKOIL ?? null;
  if (s.includes("WTI") || s.includes("OIL")) return COT_MAP.WTIUSD ?? null;
  return null;
}

export async function getCotPositioning(symbol: string): Promise<CotPositioning | null> {
  const map = lookup(symbol);
  if (!map) return null;
  try {
    const where = encodeURIComponent(`contract_market_name='${map.name}'`);
    const sel = encodeURIComponent("report_date_as_yyyy_mm_dd,open_interest_all,noncomm_positions_long_all,noncomm_positions_short_all");
    const order = encodeURIComponent("report_date_as_yyyy_mm_dd DESC");
    const url = `${COT_URL}?$select=${sel}&$where=${where}&$order=${order}&$limit=26`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const rows = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length < 2) return null;

    const parsed = rows
      .map((row) => {
        const oi = num(row.open_interest_all);
        const lo = num(row.noncomm_positions_long_all);
        const sh = num(row.noncomm_positions_short_all);
        const date = typeof row.report_date_as_yyyy_mm_dd === "string" ? row.report_date_as_yyyy_mm_dd : null;
        if (oi == null || lo == null || sh == null || !(oi > 0) || !date) return null;
        return { date, oi, net: lo - sh, netPct: (lo - sh) / oi };
      })
      .filter((x): x is { date: string; oi: number; net: number; netPct: number } => x != null);
    if (parsed.length < 2) return null;

    const cur = parsed[0]!;
    const prev = parsed[1]!;
    const pcts = parsed.map((p) => p.netPct);
    const min = Math.min(...pcts), max = Math.max(...pcts);
    const rangePos = max > min ? (cur.netPct - min) / (max - min) : 0.5;
    const extreme = rangePos >= 0.85 || rangePos <= 0.15;

    let bias: "bull" | "bear" | "neutral" = Math.abs(cur.netPct) < 0.03 ? "neutral" : cur.netPct > 0 ? "bull" : "bear";
    if (map.inverse && bias !== "neutral") bias = bias === "bull" ? "bear" : "bull";

    return {
      contract: map.name,
      reportDate: cur.date,
      netSpec: cur.net,
      netPctOfOi: cur.netPct,
      weekChangePctOfOi: (cur.net - prev.net) / cur.oi,
      rangePos,
      extreme,
      bias,
    };
  } catch {
    return null;
  }
}
