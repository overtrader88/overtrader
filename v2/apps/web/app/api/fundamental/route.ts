/**
 * POST /api/fundamental — fundamentos por classe de ativo:
 *   cripto  → DefiLlama (TVL on-chain, free, sem key)
 *   stocks  → FMP (ratios TTM + DRE, free tier com FMP_API_KEY)
 *   demais  → null gracioso (índices/forex/commodities ficam p/ FMP Premium)
 *
 * Sem auth, sem LLM. Cada provedor degrada graciosamente.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { analyzeInputSchema } from "@/lib/validation/schemas";
import { fetchFundamental } from "@/lib/market/defillama";
import { fetchFmpFundamental } from "@/lib/market/fmp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "fundamental", 40);
  if (limited) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = analyzeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const { symbol, assetType } = parsed.data;

  if (assetType === "crypto") {
    const result = await fetchFundamental(symbol);
    return NextResponse.json({ result });
  }

  if (assetType === "stocks") {
    const fmpKey = process.env.FMP_API_KEY;
    const result = fmpKey ? await fetchFmpFundamental(symbol, fmpKey) : null;
    return NextResponse.json({ result });
  }

  // índices, forex, commodities → FMP Premium (ainda não ativo no free tier)
  return NextResponse.json({ result: null });
}
