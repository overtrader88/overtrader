/**
 * GET /api/derivatives?symbol=BTCUSDT — dados REAIS de derivativos (Coinalyze):
 * liquidações recentes (long/short em USD) + open interest atual. Só cripto.
 * Requer login. Retorna { configured, liquidations, openInterest } — campos null
 * quando não há chave/dado (nunca número fictício).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getLiquidations, getOpenInterest } from "@/lib/market/coinalyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol ausente" }, { status: 400 });

  const configured = !!process.env.COINALYZE_API_KEY;
  const [liquidations, openInterest] = await Promise.all([
    getLiquidations(symbol).catch(() => null),
    getOpenInterest(symbol).catch(() => null),
  ]);

  return NextResponse.json({ configured, symbol, liquidations, openInterest });
}
