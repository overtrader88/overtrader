"use client";

import { Lightbulb, Sparkles, Clock } from "lucide-react";
import { LiveChart } from "./live-chart";
import { SignalCard } from "./signal-card";
import { IndicatorsTab } from "./indicators-tab";
import { GatesTab } from "./gates-tab";
import { BacktestTab } from "./backtest-tab";
import { SmcTab } from "./smc-tab";
import { MultiTimeframeCard } from "./multi-timeframe-card";
import { MonteCarloCard } from "./monte-carlo-card";
import { SeasonalityCard } from "./seasonality-card";
import { DualScenariosCard } from "./dual-scenarios-card";
import { HarmonicsCard } from "./harmonics-card";
import { WegdCard } from "./wegd-card";
import { NewsCard } from "./news-card";
import { SignalQualityBanner } from "./signal-quality-banner";
import { ResultTabs } from "./tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { Timeframe } from "@/lib/market";

interface LlmExplanationLike {
  text?: string;
  model?: string;
  generatedAt?: string;
}

// Mantém compatibilidade estrutural com BacktestSummary de lib/analysis/backtest.ts
// (a aba importa sua própria tipagem local pra evitar acoplamento de tipos pesados).
type BacktestStrategyKey =
  | "exit-tp1"
  | "move-to-breakeven"
  | "partial-exit";

interface ExistingBacktestLike {
  strategy?: BacktestStrategyKey;
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
}

type ExistingBacktestsMap = Partial<
  Record<BacktestStrategyKey, ExistingBacktestLike>
>;

interface Props {
  result: AnalysisResult;
  asset: string;
  assetType: "crypto" | "forex" | "stocks" | "indices" | "commodities";
  timeframe: Timeframe;
  /** Explicação narrativa do LLM (Sprint 4). Se ausente, cai pra heurística. */
  llmExplanation?: LlmExplanationLike | null;
  /** ID da análise — necessário pra acionar o endpoint de backtest. */
  analysisId?: string;
  /** Resultado de backtest legado (payload.backtest singular) — fallback. */
  existingBacktest?: ExistingBacktestLike | null;
  /** Mapa de backtests por estrategia (payload.backtests). */
  existingBacktests?: ExistingBacktestsMap | null;
}

export function AnalysisView({
  result,
  asset,
  assetType,
  timeframe,
  llmExplanation,
  analysisId,
  existingBacktest,
  existingBacktests,
}: Props) {
  const hasLlm = Boolean(llmExplanation?.text);

  return (
    <div className="space-y-6">
      {/* Multi-Timeframe Confluence — primeiro indicador macro de confianca */}
      {result.multiTimeframe && (
        <MultiTimeframeCard multi={result.multiTimeframe} />
      )}

      {/* Banner de qualidade — backtest historico */}
      {analysisId && (
        <SignalQualityBanner
          backtests={existingBacktests}
          legacyBacktest={existingBacktest}
        />
      )}

      {/* Gráfico ao vivo */}
      <LiveChart
        symbol={asset}
        assetType={assetType}
        timeframe={timeframe}
        signal={result.signal.signal}
        levels={{
          entry: result.risk.entry,
          stopLoss: result.risk.stopLoss,
          takeProfit1: result.risk.takeProfit1,
          takeProfit2: result.risk.takeProfit2,
          takeProfit3: result.risk.takeProfit3,
        }}
      />

      {/* Tabs */}
      <ResultTabs
        tabs={[
          { id: "resumo", label: "Resumo" },
          {
            id: "tecnica",
            label: "Técnica",
            badge: String(result.indicators.length),
          },
          {
            id: "gates",
            label: "Filtros",
            badge: `${result.gates.filter((g) => g.passed).length}/${result.gates.length}`,
          },
          ...(result.smc
            ? [
                {
                  id: "smc",
                  label: "SMC",
                  badge: result.smc.bias === "neutral" ? "—" : result.smc.bias === "bullish" ? "↑" : "↓",
                },
              ]
            : []),
          ...(analysisId
            ? [
                {
                  id: "backtest",
                  label: "Backtest",
                  badge: (() => {
                    const countMap = existingBacktests
                      ? Object.values(existingBacktests).filter(Boolean).length
                      : 0;
                    if (countMap > 0) return `${countMap}/3`;
                    if (existingBacktest) return "1/3";
                    return "novo";
                  })(),
                },
              ]
            : []),
        ]}
      >
        {(active) => (
          <>
            {active === "resumo" && (
              <div className="space-y-4">
                <SignalCard result={result} />

                {/* Monte Carlo na aba Resumo — projecao probabilistica visual */}
                {result.monteCarlo && (
                  <MonteCarloCard
                    mc={result.monteCarlo}
                    timeframe={timeframe}
                  />
                )}

                {/* Sazonalidade historica */}
                {result.seasonality && (
                  <SeasonalityCard seasonality={result.seasonality} />
                )}

                {/* Cenarios Compra E Venda lado a lado */}
                {result.dualScenarios && (
                  <DualScenariosCard
                    scenarios={result.dualScenarios}
                    timeframe={timeframe}
                  />
                )}

                {/* Padroes Harmonicos */}
                {result.harmonics && result.harmonics.patterns.length > 0 && (
                  <HarmonicsCard harmonics={result.harmonics} />
                )}

                {/* WEGD - Wyckoff/Elliott/Gann/Dow */}
                {result.wegd && <WegdCard wegd={result.wegd} />}

                {/* Noticias + Sentimento Macro */}
                {result.news && (
                  <NewsCard news={result.news} assetType={assetType} />
                )}

                {/* Explicação narrada — prefere LLM, fallback heurística */}
                {hasLlm ? (
                  <Card className="p-5 bg-gradient-to-br from-primary/5 to-card border-primary/30">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 flex-shrink-0">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </span>
                        <div>
                          <div className="font-semibold text-sm">
                            Análise narrada por IA
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Por que este sinal foi gerado
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="ghost"
                        className="bg-primary/10 text-primary border-primary/30 text-[10px]"
                      >
                        IA generativa
                      </Badge>
                    </div>

                    {/* Texto em parágrafos */}
                    <div className="space-y-3">
                      {llmExplanation!.text!
                        .split(/\n\s*\n/)
                        .map((paragraph, i) => (
                          <p
                            key={i}
                            className="text-sm text-foreground/90 leading-relaxed"
                          >
                            {paragraph.trim()}
                          </p>
                        ))}
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap text-[11px] text-muted-foreground">
                      <span className="italic">
                        Análise informativa. Não constitui recomendação personalizada.
                      </span>
                      {llmExplanation!.generatedAt && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {new Date(
                            llmExplanation!.generatedAt
                          ).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </Card>
                ) : (
                  <Card className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <Lightbulb className="h-5 w-5 text-warning mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm mb-1">
                          Por que este sinal foi gerado?
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {result.explanation.summary}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2 pl-8">
                      {result.explanation.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="text-sm text-foreground/90 leading-relaxed"
                        >
                          <span className="text-primary">•</span> {b}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 pt-3 border-t border-border/40 text-[11px] text-muted-foreground italic">
                      Explicação heurística. Para a versão narrativa com IA generativa,
                      use Análise Completa (1 crédito PRO) com OPENAI_API_KEY configurada.
                    </p>
                  </Card>
                )}
              </div>
            )}

            {active === "tecnica" && <IndicatorsTab result={result} />}
            {active === "gates" && <GatesTab result={result} />}
            {active === "smc" && <SmcTab smc={result.smc} />}
            {active === "backtest" && analysisId && (
              <BacktestTab
                analysisId={analysisId}
                existingBacktest={existingBacktest ?? null}
                existingBacktests={existingBacktests ?? null}
              />
            )}
          </>
        )}
      </ResultTabs>
    </div>
  );
}
