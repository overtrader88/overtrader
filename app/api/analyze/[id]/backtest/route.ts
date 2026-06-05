/**
 * POST /api/analyze/[id]/backtest
 *
 * Roda backtest sobre o mesmo ativo/timeframe da analise referenciada.
 * Custo: 0 creditos (incentivo a validar antes de operar — nao onera o usuario).
 *
 * Body opcional: { strategy: "exit-tp1" | "move-to-breakeven" | "partial-exit" }
 *   - Default: "exit-tp1"
 *
 * Persiste resultado em payload.backtests[strategy] com cache de 1h por estrategia.
 * O campo legado payload.backtest (singular) continua sendo populado com o ultimo
 * resultado pra retrocompat com paginas antigas.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCandles, getAsset } from "@/lib/market";
import {
  runBacktest,
  isValidStrategy,
  type BacktestStrategy,
} from "@/lib/analysis/backtest";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;

  // Le strategy do body (opcional)
  let strategy: BacktestStrategy = "exit-tp1";
  try {
    const body = (await req.json().catch(() => ({}))) as {
      strategy?: unknown;
    };
    if (isValidStrategy(body?.strategy)) {
      strategy = body.strategy;
    }
  } catch {
    // body invalido — usa default
  }

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Nao autenticado." },
      { status: 401 }
    );
  }

  // Carrega a analise (RLS garante que so pega do proprio user)
  const { data: analysis, error: fetchErr } = await supabase
    .from("analyses")
    .select("id, asset, asset_type, timeframe, payload, user_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !analysis) {
    return NextResponse.json(
      { error: "Analise nao encontrada." },
      { status: 404 }
    );
  }

  const payload =
    (analysis.payload as Record<string, unknown> | null) ?? {};

  // Cache por estrategia: payload.backtests[strategy]
  const cachedAll =
    (payload.backtests as
      | Record<string, { generatedAt?: string } & Record<string, unknown>>
      | undefined) ?? {};
  const cached = cachedAll[strategy];
  if (cached?.generatedAt) {
    const ageHours =
      (Date.now() - new Date(cached.generatedAt).getTime()) / 3_600_000;
    if (ageHours < 1) {
      return NextResponse.json(
        { ok: true, cached: true, strategy, backtest: cached },
        { status: 200 }
      );
    }
  }

  // Valida ativo
  const asset = getAsset(analysis.asset);
  if (!asset) {
    return NextResponse.json(
      { error: "Ativo nao encontrado no catalogo." },
      { status: 400 }
    );
  }

  try {
    // Pega historico amplo (1000 candles para ter espaco de walk-forward)
    const candles = await getCandles(
      analysis.asset,
      analysis.timeframe as "15m" | "1h" | "4h" | "1d" | "1w" | "1M",
      1000
    );

    if (candles.length < 250) {
      return NextResponse.json(
        {
          error:
            "Historico insuficiente para backtest confiavel (minimo 250 candles).",
          have: candles.length,
        },
        { status: 422 }
      );
    }

    const summary = runBacktest(
      {
        symbol: analysis.asset,
        assetType: asset.type,
        timeframe: analysis.timeframe as
          | "15m"
          | "1h"
          | "4h"
          | "1d"
          | "1w"
          | "1M",
        candles,
      },
      500,
      strategy
    );

    const backtestWithMeta = {
      ...summary,
      generatedAt: new Date().toISOString(),
    };

    // Atualiza o payload mantendo o resto intacto. Persiste:
    //   - payload.backtests[strategy] (novo formato)
    //   - payload.backtest (legado, sempre o ultimo executado)
    const newPayload = {
      ...payload,
      backtests: {
        ...cachedAll,
        [strategy]: backtestWithMeta,
      },
      backtest: backtestWithMeta,
    };

    const { error: updateErr } = await supabase
      .from("analyses")
      .update({ payload: newPayload })
      .eq("id", id);

    if (updateErr) {
      console.error("[backtest] update error:", updateErr);
      return NextResponse.json(
        {
          ok: true,
          strategy,
          backtest: backtestWithMeta,
          warning: "Nao foi possivel persistir.",
        },
        { status: 200 }
      );
    }

    revalidatePath(`/dashboard/analise/${id}`);

    return NextResponse.json(
      {
        ok: true,
        cached: false,
        strategy,
        backtest: backtestWithMeta,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[backtest] error:", err);
    return NextResponse.json(
      {
        error: "Erro ao executar backtest.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
