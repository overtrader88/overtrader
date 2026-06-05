/**
 * GET/POST /api/jobs/cleanup-cache
 *
 * Job periodico que remove entradas expiradas da tabela market_cache.
 * Sem isso, a tabela cresce indefinidamente (mesmo com TTL, dados ficam la
 * apos expirar). Rodar a cada 6h e suficiente.
 *
 * Seguranca: requer X-Cron-Secret (mesmo do check-alerts).
 */
import { NextResponse } from "next/server";

import { cleanupExpiredCache } from "@/lib/market/cache";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado" },
      { status: 500 }
    );
  }
  if (provided !== secret) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
  }

  const t0 = Date.now();
  const deleted = await cleanupExpiredCache();

  return NextResponse.json({
    ok: true,
    deletedRows: deleted,
    durationMs: Date.now() - t0,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
