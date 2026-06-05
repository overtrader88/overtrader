"use client";

/**
 * Cenarios Compra E Venda lado a lado com probabilidade por TP.
 *
 * Diferencial vs Vortex: transparencia total — mostramos os 2 lados, com a
 * probabilidade calculada de cada alvo, e qual e o "recomendado" baseado em
 * score (probabilidade ponderada por R-multiple).
 */

import {
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface TpLike {
  price: number;
  distancePct: number;
  probability: number;
}

interface SideLike {
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: TpLike;
  tp2: TpLike;
  tp3: TpLike;
  stopProbability: number;
  score: number;
}

interface DualLike {
  buy: SideLike;
  sell: SideLike;
  recommended: "buy" | "sell";
  edge: number;
  horizonCandles: number;
}

interface Props {
  scenarios?: DualLike | null;
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

export function DualScenariosCard({ scenarios, timeframe }: Props) {
  if (!scenarios) return null;

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Cenários Compra vs Venda
        </h4>
        <span className="text-[11px] text-muted-foreground">
          Projeção {scenarios.horizonCandles} candles
          {timeframe ? ` ${timeframe}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SidePanel side={scenarios.buy} isRecommended={scenarios.recommended === "buy"} />
        <SidePanel side={scenarios.sell} isRecommended={scenarios.recommended === "sell"} />
      </div>

      <p className="text-[10px] text-muted-foreground italic mt-4 leading-relaxed">
        Probabilidades calculadas via volatilidade histórica (GBM). O lado{" "}
        <strong>recomendado</strong> tem score{" "}
        <strong className="text-primary">{scenarios.edge} pts</strong> acima do
        oposto. Use como guia de decisão, não como certeza.
      </p>
    </Card>
  );
}

function SidePanel({
  side,
  isRecommended,
}: {
  side: SideLike;
  isRecommended: boolean;
}) {
  const isBuy = side.side === "buy";
  const Icon = isBuy ? TrendingUp : TrendingDown;
  const ArrowIcon = isBuy ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isBuy
          ? "border-success/30 bg-success/5"
          : "border-destructive/30 bg-destructive/5",
        isRecommended &&
          (isBuy
            ? "border-success ring-2 ring-success/30"
            : "border-destructive ring-2 ring-destructive/30")
      )}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", isBuy ? "text-success" : "text-destructive")} />
          <span
            className={cn(
              "text-sm font-bold uppercase tracking-wider",
              isBuy ? "text-success" : "text-destructive"
            )}
          >
            {isBuy ? "Compra" : "Venda"}
          </span>
          {isRecommended && (
            <Badge
              variant={isBuy ? "success" : "destructive"}
              className="text-[9px]"
            >
              <Sparkles className="h-2.5 w-2.5" /> Recomendado
            </Badge>
          )}
        </div>
        <span
          className={cn(
            "text-xs tabular-nums font-bold",
            isBuy ? "text-success" : "text-destructive"
          )}
        >
          Score: {side.score}
        </span>
      </div>

      {/* Entry e Stop */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Entrada" value={formatPrice(side.entry)} />
        <Stat
          label={`Stop · ${side.stopProbability.toFixed(0)}% prob`}
          value={formatPrice(side.stopLoss)}
          danger
        />
      </div>

      {/* TPs com probabilidade */}
      <div className="space-y-1.5">
        <TpRow
          label="TP1"
          rMultiple="+1.5R"
          tp={side.tp1}
          ArrowIcon={ArrowIcon}
        />
        <TpRow
          label="TP2"
          rMultiple="+2.5R"
          tp={side.tp2}
          ArrowIcon={ArrowIcon}
        />
        <TpRow
          label="TP3"
          rMultiple="+3.75R"
          tp={side.tp3}
          ArrowIcon={ArrowIcon}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          danger && "text-destructive"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TpRow({
  label,
  rMultiple,
  tp,
  ArrowIcon,
}: {
  label: string;
  rMultiple: string;
  tp: TpLike;
  ArrowIcon: typeof ArrowUpRight;
}) {
  const probColor =
    tp.probability > 50
      ? "text-success"
      : tp.probability > 25
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 text-xs">
      <ArrowIcon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-semibold w-8 shrink-0">{label}</span>
      <span className="font-mono tabular-nums flex-1">
        {formatPrice(tp.price)}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:inline">
        {tp.distancePct >= 0 ? "+" : ""}
        {tp.distancePct.toFixed(2)}%
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {rMultiple}
      </span>
      <span className={cn("font-bold tabular-nums w-10 text-right", probColor)}>
        {tp.probability.toFixed(0)}%
      </span>
    </div>
  );
}
