/**
 * POST /api/narrative — leitura em linguagem natural (OpenAI) GROUNDED nos
 * números medidos. Recomputa a análise no servidor (não confia em facts do
 * cliente) e delega a geração à lib compartilhada `generateNarrative`. 503 se
 * OPENAI_API_KEY ausente.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { analyzeInputSchema } from "@/lib/validation/schemas";
import { analyzeSymbol } from "@/lib/analysis/service";
import { generateNarrative, generateClassNarrative } from "@/lib/analysis/narrative";
import { loadServerExtras } from "@/lib/analysis/class-extras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "narrative", 10);
  if (limited) return limited;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Narrativa de IA não configurada (defina OPENAI_API_KEY)." }, { status: 503 });
  }

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

  const engine = (raw as { engine?: string })?.engine === "classe" ? "classe" : "padrao";
  let narrative: string | null;
  try {
    const dto = await analyzeSymbol(parsed.data.symbol, parsed.data.assetType, parsed.data.timeframe, "complete");
    if (engine === "classe") {
      const extras = await loadServerExtras(parsed.data.symbol, parsed.data.assetType);
      narrative = await generateClassNarrative(dto, parsed.data.assetType, extras);
    } else {
      narrative = await generateNarrative(dto);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao computar a análise." }, { status: 502 });
  }

  if (!narrative) return NextResponse.json({ error: "IA indisponível ou retornou vazio." }, { status: 502 });
  return NextResponse.json({ narrative });
}
