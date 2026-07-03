/**
 * POST /api/war-council — Conselho de Guerra: chat pós-análise em que o usuário
 * interroga a IA ancorada nos dados de UMA análise. Recebe { analysisId | dto,
 * question, history } e responde via OpenAI GROUNDED no snapshot (regra da casa:
 * o que não está nos dados, o Conselho diz que não tem). Cobra 1 crédito por
 * pergunta (RPC `consume_credits`, atômico) e ESTORNA se a IA falhar depois de
 * cobrar. 503 se OPENAI_API_KEY ausente; anônimo → 401.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { getCurrentUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";
import { getAnalysisById } from "@/lib/history";
import { warCouncilSchema } from "@/lib/validation/schemas";
import { generateWarCouncilAnswer, capWarCouncilHistory } from "@/lib/analysis/war-council";
import { WAR_COUNCIL_COST } from "@/lib/billing-constants";
import type { FullAnalysis } from "@/lib/analysis/full";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Checagem estrutural mínima de um dto vindo do cliente (não confiamos no shape). */
function isFullAnalysisLike(x: unknown): x is FullAnalysis {
  const d = x as FullAnalysis | null;
  return (
    !!d &&
    typeof d === "object" &&
    typeof d.generatedAt === "number" &&
    typeof d.analysis?.meta?.asset === "string" &&
    typeof d.analysis?.signal?.signal === "string" &&
    Array.isArray(d.analysis?.indicators)
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "war-council", 10);
  if (limited) return limited;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Conselho de Guerra não configurado (defina OPENAI_API_KEY)." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para interrogar o Conselho." }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = warCouncilSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  // Resolve o DTO: id salvo (RLS garante que é do usuário) ou dto serializado.
  let dto: FullAnalysis;
  if (parsed.data.analysisId) {
    const saved = await getAnalysisById(parsed.data.analysisId);
    if (!saved) return NextResponse.json({ error: "Análise não encontrada no seu histórico." }, { status: 404 });
    dto = saved.dto;
  } else if (isFullAnalysisLike(parsed.data.dto)) {
    dto = parsed.data.dto;
  } else {
    return NextResponse.json({ error: "dto de análise inválido." }, { status: 400 });
  }

  const symbol = dto.analysis.meta.asset;
  const timeframe = dto.analysis.meta.timeframe;

  // Cobra ANTES de chamar a IA (débito atômico; sem service-role em dev/CI → não cobra).
  const svc = supabaseService();
  let charged = false;
  let credits: number | null = null;
  if (svc) {
    const { data, error: chErr } = await svc.rpc("consume_credits", {
      p_user_id: user.id, p_amount: WAR_COUNCIL_COST, p_source: "war_council",
      p_metadata: { symbol, timeframe },
    });
    if (chErr) {
      const insufficient = /insuficient/i.test(chErr.message);
      return NextResponse.json(
        { error: insufficient ? `Créditos insuficientes — cada pergunta custa ${WAR_COUNCIL_COST} crédito.` : "Falha ao cobrar os créditos." },
        { status: insufficient ? 402 : 500 },
      );
    }
    charged = true;
    credits = typeof data === "number" ? data : null;
  }

  const answer = await generateWarCouncilAnswer(dto, parsed.data.question, capWarCouncilHistory(parsed.data.history));
  if (!answer) {
    // IA falhou DEPOIS de cobrar → estorna (best-effort) p/ não cobrar à toa.
    if (charged && svc) {
      await svc.rpc("credit_user", { p_user_id: user.id, p_amount: WAR_COUNCIL_COST, p_source: "war_council_refund", p_metadata: { symbol, timeframe } });
    }
    return NextResponse.json(
      { error: charged ? "O Conselho não respondeu — o crédito foi estornado. Tente de novo." : "O Conselho não respondeu. Tente de novo." },
      { status: 502 },
    );
  }

  return NextResponse.json({ answer, charged, credits });
}
