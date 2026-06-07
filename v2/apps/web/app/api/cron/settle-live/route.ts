/**
 * Cron: acerta o metering de TODAS as lives ativas (cobra horas acumuladas e
 * desativa quem ficou sem saldo). Horário no plano Pro; diário no Hobby.
 * Protegido por CRON_SECRET. GET/POST /api/cron/settle-live?secret=...
 */
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { settleAllActive } from "@/lib/live/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request): Promise<NextResponse> {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const res = await settleAllActive(sb);
  return NextResponse.json({ ok: true, ...res });
}

export const GET = handle;
export const POST = handle;
