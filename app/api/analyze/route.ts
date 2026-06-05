/**
 * POST /api/analyze
 *
 * Roda o motor de análise completo:
 *   1. Valida input (ativo, timeframe, tipo)
 *   2. Verifica autenticação
 *   3. Debita 1 crédito (atomicamente via RPC)
 *   4. Fetch candles do provedor (Binance/TwelveData)
 *   5. Executa engine (20 indicadores + sinal + risco + gates + explicação)
 *   6. Persiste em `analyses`
 *   7. Retorna o ID + resultado
 *
 * Body: { symbol: string, timeframe: "15m"|"1h"|"4h"|"1d", type: "simple"|"complete" }
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getCandles, getAsset } from "@/lib/market";
import { runAnalysis, ENGINE_VERSION } from "@/lib/analysis/engine";
import {
  analyzeMultiTimeframe,
  toTimeframeAnalysis,
} from "@/lib/analysis/multi-timeframe";
import { explainAnalysisWithLlm } from "@/lib/llm/explain-analysis";
import { fetchAssetNews } from "@/lib/news/providers";
import { summarizeNews } from "@/lib/news/summarize";

const schema = z.object({
  symbol: z.string().min(2).max(20),
  timeframe: z.enum(["15m", "1h", "4h", "1d", "1w", "1M"]),
  type: z.enum(["simple", "complete"]),
});

export async function POST(req: Request) {
  // 1) Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { symbol, timeframe, type } = parsed.data;

  // 2) Validar ativo no catálogo
  const asset = getAsset(symbol);
  if (!asset) {
    return NextResponse.json(
      { error: `Ativo "${symbol}" não suportado.` },
      { status: 400 }
    );
  }

  // 3) Autenticação
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // 4) Debita crédito atomicamente via RPC consume_credits (lock pessimista)
  //    - Simple: 1 crédito Simple
  //    - Complete: 1 crédito PRO
  const amountSimple = type === "simple" ? 1 : 0;
  const amountPro = type === "complete" ? 1 : 0;

  const { error: consumeErr } = await supabase.rpc("consume_credits", {
    p_user_id: user.id,
    p_amount_pro: amountPro,
    p_amount_simple: amountSimple,
    p_source: "analyze",
    p_metadata: { symbol, timeframe, type },
  });

  if (consumeErr) {
    // RPC dispara RAISE EXCEPTION com code P0001 se saldo insuficiente
    if (consumeErr.code === "P0001") {
      return NextResponse.json(
        {
          error: "Créditos insuficientes.",
          detail: consumeErr.hint ?? consumeErr.message,
          required: { credits_pro: amountPro, credits_simple: amountSimple },
        },
        { status: 402 }
      );
    }
    console.error("[analyze] consume_credits error:", consumeErr);
    return NextResponse.json(
      { error: "Erro ao processar crédito.", detail: consumeErr.message },
      { status: 500 }
    );
  }

  // 5) Fetch de candles + run engine
  let analysis;
  try {
    const candles = await getCandles(symbol, timeframe, 300);
    if (candles.length < 60) {
      throw new Error("Dados insuficientes do provedor.");
    }
    analysis = runAnalysis({
      symbol,
      assetType: asset.type,
      timeframe,
      candles,
    });
  } catch (err) {
    console.error("[analyze] engine error:", err);
    // Reembolsa o crédito em caso de falha técnica (RPC credit_user)
    await supabase.rpc("credit_user", {
      p_user_id: user.id,
      p_amount_pro: amountPro,
      p_amount_simple: amountSimple,
      p_type: "refund",
      p_source: "analyze_error",
      p_metadata: {
        symbol,
        timeframe,
        type,
        reason: err instanceof Error ? err.message : "unknown",
      },
    });
    return NextResponse.json(
      {
        error: "Erro ao executar análise. Seu crédito foi devolvido.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }

  // 6a) Multi-Timeframe Confluence (Sprint 9.2)
  const mtfPromise = analyzeMultiTimeframe(
    symbol,
    asset.type,
    timeframe,
    toTimeframeAnalysis(analysis)
  ).catch((err) => {
    console.warn("[analyze] multi-tf falhou:", err);
    return null;
  });

  // 6b) Noticias macro (Sprint 9.11) — busca + resume com LLM
  //     Roda apenas pra Analise Completa pra economizar API calls
  const newsPromise =
    type === "complete"
      ? fetchAssetNews(symbol, asset.type, 10)
          .then(async (items) => {
            if (items.length === 0) return { items, sentiment: null };
            const sentiment = await summarizeNews(symbol, items);
            return { items, sentiment };
          })
          .catch((err) => {
            console.warn("[analyze] news falhou:", err);
            return { items: [], sentiment: null };
          })
      : Promise.resolve({ items: [], sentiment: null });

  // 6c) Explicação narrada por LLM — apenas para Análise Completa.
  const llmPromise =
    type === "complete"
      ? explainAnalysisWithLlm(analysis).catch(() => null)
      : Promise.resolve(null);

  const [multiTimeframe, newsResult, llmExplanation] = await Promise.all([
    mtfPromise,
    newsPromise,
    llmPromise,
  ]);

  // Anexa ao analysis pra exposicao no payload
  analysis.multiTimeframe = multiTimeframe;

  // 7) Persiste em `analyses`
  const { data: inserted, error: insertErr } = await supabase
    .from("analyses")
    .insert({
      user_id: user.id,
      asset_type: asset.type,
      asset: symbol,
      timeframe,
      analysis_type: type,
      signal: analysis.signal.signal,
      strength: analysis.signal.strength,
      confluence: analysis.signal.confluence,
      entry: analysis.risk.entry,
      stop_loss: analysis.risk.stopLoss,
      take_profit_1: analysis.risk.takeProfit1,
      take_profit_2: analysis.risk.takeProfit2,
      take_profit_3: analysis.risk.takeProfit3,
      payload: {
        engine: ENGINE_VERSION,
        signal: analysis.signal,
        risk: analysis.risk,
        indicators: analysis.indicators,
        gates: analysis.gates,
        smc: analysis.smc,
        multiTimeframe: analysis.multiTimeframe,
        monteCarlo: analysis.monteCarlo,
        seasonality: analysis.seasonality,
        dualScenarios: analysis.dualScenarios,
        harmonics: analysis.harmonics,
        wegd: analysis.wegd,
        news: {
          items: newsResult.items,
          sentiment: newsResult.sentiment,
        },
        explanation: analysis.explanation,
        llm_explanation: llmExplanation,
        meta: analysis.meta,
      },
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[analyze] insert error:", insertErr);
    return NextResponse.json(
      { error: "Erro ao salvar análise.", detail: insertErr?.message },
      { status: 500 }
    );
  }

  // Invalida cache das páginas que exibem a lista de análises do usuário
  // (dashboard, /analise sidebar, /historico) para o widget Recent Analyses
  // pegar o sinal novo imediatamente.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/analise");
  revalidatePath("/dashboard/historico");

  return NextResponse.json(
    {
      ok: true,
      id: inserted.id,
      analysis,
    },
    { status: 200 }
  );
}
