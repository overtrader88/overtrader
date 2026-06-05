/**
 * GET /api/history?page=&q= — lista as análises DO USUÁRIO (RLS via SSR client).
 * Retorna { items, total }. Anônimo → lista vazia.
 */
import { NextResponse } from "next/server";
import { listAnalyses } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const q = url.searchParams.get("q") ?? undefined;
  const result = await listAnalyses({ page, q });
  return NextResponse.json(result);
}
