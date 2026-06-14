/**
 * Diagnóstico admin dos provedores LLM (OpenAI + DeepSeek) NO DEPLOY ATUAL.
 * Faz um ping mínimo a cada um e mostra o motivo real de falha — útil quando o
 * motor LLM·DS não emite em produção (chave ausente/escopo, valor errado=401,
 * modelo errado=400). Gate: ADMIN_EMAILS. Abra logado: /api/admin/llm-probe
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { probeLlmProviders } from "@/lib/analysis/narrative";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const probes = await probeLlmProviders();
  return NextResponse.json({ probes }, { headers: { "cache-control": "no-store" } });
}
