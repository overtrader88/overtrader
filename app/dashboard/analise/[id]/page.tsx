import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalysisView } from "@/components/analysis/analysis-view";
import { ReanalyzeButton } from "@/components/analysis/reanalyze-button";
import { getAsset } from "@/lib/market";
import type { AnalysisResult } from "@/lib/analysis/types";

// Forma serializada de BacktestSummary (lib/analysis/backtest.ts) no payload JSONB.
// Mantido inline aqui pra evitar acoplamento de tipos pesados na server component.
type BacktestPayload = {
  strategy?: "exit-tp1" | "move-to-breakeven" | "partial-exit";
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  maxDrawdownR: number;
  outcomes: {
    TP1: number;
    TP2: number;
    TP3: number;
    BE?: number;
    SL: number;
    EXPIRED: number;
  };
  tp1TouchRate?: number;
  trades: Array<{
    entryIndex: number;
    exitIndex: number;
    entryPrice: number;
    side: "buy" | "sell";
    signal: string;
    outcome: "TP1" | "TP2" | "TP3" | "BE" | "SL" | "EXPIRED";
    tp1Touched?: boolean;
    durationCandles: number;
    pnlR: number;
  }>;
  candlesAnalyzed: number;
  durationMs: number;
  generatedAt?: string;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Análise ${id.slice(0, 8)}`,
  };
}

export default async function AnalysisResultPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: analysis, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !analysis) {
    notFound();
  }

  // O payload tem o objeto AnalysisResult completo (gravado pela API /analyze)
  const result = analysis.payload as AnalysisResult;
  if (!result || !result.signal) {
    notFound();
  }

  const asset = getAsset(analysis.asset);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link href="/dashboard/analise">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {analysis.asset}{" "}
            <span className="text-muted-foreground font-normal text-lg">
              {analysis.timeframe}
            </span>
          </h1>
          {asset && (
            <p className="text-sm text-muted-foreground">
              {asset.emoji} {asset.name} · análise{" "}
              {analysis.analysis_type === "complete" ? "completa" : "simples"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {new Date(analysis.created_at).toLocaleString("pt-BR")}
          </Badge>
          <ReanalyzeButton
            symbol={analysis.asset}
            timeframe={analysis.timeframe}
            analysisType={analysis.analysis_type}
          />
        </div>
      </div>

      {/* Análise completa */}
      <AnalysisView
        result={result}
        asset={analysis.asset}
        assetType={analysis.asset_type}
        timeframe={analysis.timeframe as "15m" | "1h" | "4h" | "1d" | "1w" | "1M"}
        llmExplanation={
          (analysis.payload as { llm_explanation?: { text?: string; model?: string; generatedAt?: string } } | null)
            ?.llm_explanation ?? null
        }
        analysisId={analysis.id}
        existingBacktest={
          (analysis.payload as { backtest?: BacktestPayload } | null)
            ?.backtest ?? null
        }
        existingBacktests={
          (
            analysis.payload as {
              backtests?: Partial<
                Record<
                  "exit-tp1" | "move-to-breakeven" | "partial-exit",
                  BacktestPayload
                >
              >;
            } | null
          )?.backtests ?? null
        }
      />
    </div>
  );
}
