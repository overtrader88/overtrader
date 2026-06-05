"use client";

/**
 * Card de Sazonalidade — mostra performance histórica do mês atual
 * + mini-heatmap dos 12 meses.
 */

import { CalendarDays, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

interface MonthlyStatsLike {
  month: number;
  avgReturn: number;
  winRate: number;
  sampleSize: number;
}

interface SeasonalityLike {
  monthly: MonthlyStatsLike[];
  currentMonth: number;
  currentMonthStats: MonthlyStatsLike | null;
  yearsAnalyzed: number;
  summary: string;
}

interface Props {
  seasonality?: SeasonalityLike | null;
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function SeasonalityCard({ seasonality }: Props) {
  if (!seasonality || seasonality.yearsAnalyzed < 1) return null;

  const cur = seasonality.currentMonthStats;
  const isBullish = (cur?.avgReturn ?? 0) > 0.5;
  const isBearish = (cur?.avgReturn ?? 0) < -0.5;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Sazonalidade Histórica</h4>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {seasonality.yearsAnalyzed} ano{seasonality.yearsAnalyzed > 1 ? "s" : ""} de dados
        </span>
      </div>

      {/* Mês atual em destaque */}
      {cur && cur.sampleSize > 0 && (
        <div
          className={cn(
            "rounded-lg border-2 p-4 mb-4",
            isBullish
              ? "border-success/40 bg-success/5"
              : isBearish
                ? "border-destructive/40 bg-destructive/5"
                : "border-border/40 bg-card/40"
          )}
        >
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Mês atual · {MONTH_SHORT[cur.month - 1]}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    isBullish && "text-success",
                    isBearish && "text-destructive"
                  )}
                >
                  {cur.avgReturn >= 0 ? "+" : ""}
                  {cur.avgReturn.toFixed(2)}%
                </span>
                {isBullish && <TrendingUp className="h-5 w-5 text-success" />}
                {isBearish && <TrendingDown className="h-5 w-5 text-destructive" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                retorno médio histórico
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Win Rate
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {cur.winRate.toFixed(0)}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {cur.sampleSize} anos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mini-heatmap 12 meses */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Heatmap anual
        </p>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
          {seasonality.monthly.map((m) => (
            <MonthCell
              key={m.month}
              stats={m}
              isCurrent={m.month === seasonality.currentMonth}
            />
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic mt-3 leading-relaxed">
        {seasonality.summary}
      </p>
    </Card>
  );
}

function MonthCell({
  stats,
  isCurrent,
}: {
  stats: MonthlyStatsLike;
  isCurrent: boolean;
}) {
  // Intensidade visual proporcional à magnitude
  const absReturn = Math.abs(stats.avgReturn);
  let bgClass = "bg-muted/20";
  let textClass = "text-muted-foreground";

  if (stats.sampleSize > 0) {
    if (stats.avgReturn > 5) bgClass = "bg-success/40";
    else if (stats.avgReturn > 2) bgClass = "bg-success/25";
    else if (stats.avgReturn > 0.5) bgClass = "bg-success/15";
    else if (stats.avgReturn < -5) bgClass = "bg-destructive/40";
    else if (stats.avgReturn < -2) bgClass = "bg-destructive/25";
    else if (stats.avgReturn < -0.5) bgClass = "bg-destructive/15";

    if (absReturn > 0.5) textClass = "text-foreground";
  }

  return (
    <div
      className={cn(
        "rounded p-1 text-center",
        bgClass,
        isCurrent && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      title={`${MONTH_SHORT[stats.month - 1]}: ${stats.avgReturn >= 0 ? "+" : ""}${stats.avgReturn.toFixed(2)}% (${stats.sampleSize} anos)`}
    >
      <div className={cn("text-[9px] uppercase font-semibold", textClass)}>
        {MONTH_SHORT[stats.month - 1]}
      </div>
      {stats.sampleSize > 0 && (
        <div
          className={cn(
            "text-[9px] tabular-nums",
            stats.avgReturn > 0 ? "text-success" : stats.avgReturn < 0 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {stats.avgReturn >= 0 ? "+" : ""}
          {stats.avgReturn.toFixed(1)}%
        </div>
      )}
    </div>
  );
}
