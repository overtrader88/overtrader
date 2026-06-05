/**
 * GET /api/market/candles?symbol=BTCUSDT&timeframe=1h&limit=300
 *
 * Proxy seguro para candles dos provedores de mercado.
 * - Esconde a Twelve Data API key do front
 * - Permite cache leve via Next.js
 * - Retorna formato unificado (Candle[])
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCandles, getAsset } from "@/lib/market";

const schema = z.object({
  symbol: z.string().min(2).max(20),
  timeframe: z.enum(["15m", "1h", "4h", "1d", "1w", "1M"]),
  limit: z.coerce.number().min(50).max(1000).default(300),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({
    symbol: searchParams.get("symbol"),
    timeframe: searchParams.get("timeframe"),
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { symbol, timeframe, limit } = parsed.data;

  // Validar catálogo
  const asset = getAsset(symbol);
  if (!asset) {
    return NextResponse.json({ error: "Ativo não suportado." }, { status: 400 });
  }

  // Exigir auth (evita uso indiscriminado do proxy)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const candles = await getCandles(symbol, timeframe, limit);
    return NextResponse.json(
      { symbol, timeframe, count: candles.length, candles },
      {
        status: 200,
        headers: {
          // Cache curto pro browser, longo no CDN/Edge
          "Cache-Control": "private, max-age=10, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("[/api/market/candles] error:", err);
    return NextResponse.json(
      {
        error: "Erro ao buscar dados de mercado.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }
}
