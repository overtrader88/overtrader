/**
 * POST /api/analyze — a borda que liga validação → dados → motor.
 *
 * Fluxo: Zod (analyzeInputSchema) → getCandles (providers reais + cache) →
 * runFullAnalysis (injeta generatedAt = relógio da borda) → DTO FullAnalysis.
 * O motor é puro; toda a impureza (rede, relógio, env) vive aqui.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { analyzeInputSchema } from "@/lib/validation/schemas";
import { analyzeSymbol } from "@/lib/analysis/service";
import { getCurrentUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  // Exige login: análise é recurso do usuário (anônimo não acessa). O monitor
  // ao vivo (/ao-vivo) usa esta rota em polling — por isso NÃO consome crédito.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para analisar." }, { status: 401 });

  const limited = await rateLimit(req, "analyze", 15);
  if (limited) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const parsed = analyzeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Parâmetros inválidos.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  const { symbol, assetType, timeframe, type } = parsed.data;

  try {
    const result = await analyzeSymbol(symbol, assetType, timeframe, type);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao obter dados / computar a análise." },
      { status: 502 },
    );
  }
}
