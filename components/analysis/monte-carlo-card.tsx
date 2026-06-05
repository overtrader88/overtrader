"use client";

/**
 * Card de Monte Carlo Simulation.
 * Mostra:
 *   - Cenarios otimista / mediana / pessimista (com % de variacao vs atual)
 *   - Win Rate Up vs Down
 *   - Volatilidade anualizada
 */

import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface MonteCarloLike {
  simulations: number;
  horizonCandles: number;
  currentPrice: number;
  optimistic: number;
  median: number;
  pessimistic: number;
  winRateUp: number;
  winRateDown: number;
  volatilityAnnualized: number;
}

interface Props {
  mc?: MonteCarloLike | null;
  timeframe?: string;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const decimals = n < 1 ? 5 : n < 100 ? 3 : 2;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value: number, base: number): string {
  if (!base) return "—";
  const p = ((value - base) / base) * 100;
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(2)}%`;
}

export function MonteCarloCard({ mc, timeframe }: Props) {
  if (!mc || mc.simulations === 0) return null;

  const upBias = mc.winRateUp > 55;
  const downBias = mc.winRateDown > 55;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">
            Análise Probabilística (Monte Carlo)
          </h4>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {mc.simulations.toLocaleString("pt-BR")} simulações ·{" "}
          {mc.horizonCandles} candles{timeframe ? ` ${timeframe}` : ""} à frente
        </span>
      </div>

      {/* 3 Cenários */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <ScenarioCard
          label="Otimista"
          subtitle="percentil 90"
          price={mc.optimistic}
          current={mc.currentPrice}
          color="success"
        />
        <ScenarioCard
          label="Mediana"
          subtitle="cenário central"
          price={mc.median}
          current={mc.currentPrice}
          color="primary"
        />
        <ScenarioCard
          label="Pessimista"
          subtitle="percentil 10"
          price={mc.pessimistic}
          current={mc.currentPrice}
          color="destructive"
        />
      </div>

      {/* Win Rates */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className={cn(
            "rounded-md border p-3 text-center",
            upBias
              ? "border-success/40 bg-success/5"
              : "border-border/40 bg-card/40"
          )}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp
              className={cn(
                "h-4 w-4",
                upBias ? "text-success" : "text-muted-foreground"
              )}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Win Rate Alta
            </span>
          </div>
          <div
            className={cn(
              "text-2xl font-bold tabular-nums",
              upBias ? "text-success" : "text-foreground"
            )}
          >
            {mc.winRateUp.toFixed(1)}%
          </div>
        </div>

        <div
          className={cn(
            "rounded-md border p-3 text-center",
            downBias
              ? "border-destructive/40 bg-destructive/5"
              : "border-border/40 bg-card/40"
          )}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingDown
              className={cn(
                "h-4 w-4",
                downBias ? "text-destructive" : "text-muted-foreground"
              )}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Win Rate Baixa
            </span>
          </div>
          <div
            className={cn(
              "text-2xl font-bold tabular-nums",
              downBias ? "text-destructive" : "text-foreground"
            )}
          >
            {mc.winRateDown.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Volatilidade */}
      <div className="flex items-baseline justify-between pt-3 border-t border-border/40 text-xs">
        <span className="text-muted-foreground">Volatilidade anualizada</span>
        <Badge
          variant="outline"
          className={cn(
            "tabular-nums",
            mc.volatilityAnnualized > 100
              ? "text-destructive border-destructive/40"
              : mc.volatilityAnnualized > 50
                ? "text-warning border-warning/40"
                : "text-success border-success/40"
          )}
        >
          {mc.volatilityAnnualized.toFixed(1)}%
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground italic mt-3 leading-relaxed">
        Projeção baseada em volatilidade histórica via Geometric Brownian Motion.
        Não considera eventos extraordinários (cisnes negros) — interprete como{" "}
        <em>distribuição de cenários possíveis</em>, não previsão definitiva.
      </p>
    </Card>
  );
}

function ScenarioCard({
  label,
  subtitle,
  price,
  current,
  color,
}: {
  label: string;
  subtitle: string;
  price: number;
  current: number;
  color: "success" | "primary" | "destructive";
}) {
  const colorMap = {
    success: "text-success border-success/30 bg-success/5",
    primary: "text-primary border-primary/30 bg-primary/5",
    destructive: "text-destructive border-destructive/30 bg-destructive/5",
  }[color];
  const Icon =
    color === "success" ? TrendingUp : color === "destructive" ? TrendingDown : Minus;

  return (
    <div className={cn("rounded-md border p-3 text-center", colorMap)}>
      <div className="flex items-center justify-center gap-1.5">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {label}
        </span>
      </div>
      <div className="font-mono font-bold text-base sm:text-lg tabular-nums mt-1">
        {formatPrice(price)}
      </div>
      <div className="text-[10px] opacity-80 tabular-nums">
        {pct(price, current)}
      </div>
      <div className="text-[9px] text-muted-foreground mt-1">{subtitle}</div>
    </div>
  );
}
