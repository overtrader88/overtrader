"use client";

/**
 * Card de Multi-Timeframe Confluence — mostra alinhamento entre TFs adjacentes.
 *
 * Aparece no topo da analise (acima do banner de qualidade), porque o sinal
 * "perfeito" so eh confiavel se TFs maiores concordam.
 */

import {
  Layers3,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface TfAnalysisLike {
  timeframe: string;
  signal: string;
  strength: number;
  confluence: number;
  side: "buy" | "sell" | "neutral";
  trendDirection: "up" | "down" | "neutral";
  bias: "bullish" | "bearish" | "neutral";
}

interface MultiTfLike {
  current: TfAnalysisLike;
  higher: TfAnalysisLike | null;
  highest: TfAnalysisLike | null;
  confluenceScore: number;
  alignment:
    | "fully_aligned"
    | "partially_aligned"
    | "divergent"
    | "neutral";
  summary: string;
}

interface Props {
  multi?: MultiTfLike | null;
}

const ALIGNMENT_META = {
  fully_aligned: {
    label: "Alinhamento total",
    description: "Os 3 timeframes apontam pra mesma direção.",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/5",
    border: "border-success/40",
    badgeBg: "bg-success/15 text-success border-success/40",
  },
  partially_aligned: {
    label: "Alinhamento parcial",
    description: "2 dos 3 timeframes concordam — sinal moderado.",
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/5",
    border: "border-warning/40",
    badgeBg: "bg-warning/15 text-warning border-warning/40",
  },
  divergent: {
    label: "Divergência entre timeframes",
    description:
      "Direções conflitantes — risco maior. Opere com posição reduzida.",
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/5",
    border: "border-destructive/40",
    badgeBg: "bg-destructive/15 text-destructive border-destructive/40",
  },
  neutral: {
    label: "Sem direção clara",
    description:
      "Timeframes em consolidação ou divididos — aguarde definição.",
    icon: Minus,
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border/40",
    badgeBg: "bg-muted/30 text-muted-foreground border-border",
  },
} as const;

export function MultiTimeframeCard({ multi }: Props) {
  if (!multi) {
    // Nao mostra nada se nao tiver dados (ex: timeframe 1M sem TFs superiores)
    return null;
  }

  const meta = ALIGNMENT_META[multi.alignment];
  const Icon = meta.icon;

  const tfs = [
    multi.current,
    multi.higher,
    multi.highest,
  ].filter((t): t is TfAnalysisLike => t !== null);

  return (
    <Card className={cn("p-4 sm:p-5 border-2", meta.bg, meta.border)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-full shrink-0",
            meta.bg
          )}
        >
          <Icon className={cn("h-5 w-5", meta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <div className="flex items-center gap-2">
              <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Confluência Multi-Timeframe
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] tabular-nums", meta.badgeBg)}
            >
              Score {multi.confluenceScore}/100
            </Badge>
          </div>

          <p className={cn("text-sm font-bold mb-0.5", meta.color)}>
            {meta.label}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {meta.description}
          </p>

          {/* Grid dos TFs */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {tfs.map((tf) => (
              <TfMiniCard key={tf.timeframe} tf={tf} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TfMiniCard({ tf }: { tf: TfAnalysisLike }) {
  const sideMeta = {
    buy: {
      label: "Compra",
      icon: TrendingUp,
      color: "text-success",
      border: "border-success/40",
      bg: "bg-success/5",
    },
    sell: {
      label: "Venda",
      icon: TrendingDown,
      color: "text-destructive",
      border: "border-destructive/40",
      bg: "bg-destructive/5",
    },
    neutral: {
      label: "Neutro",
      icon: Minus,
      color: "text-muted-foreground",
      border: "border-border/40",
      bg: "bg-muted/10",
    },
  }[tf.side];
  const SideIcon = sideMeta.icon;

  return (
    <div
      className={cn(
        "rounded-md border p-2 text-center",
        sideMeta.border,
        sideMeta.bg
      )}
      title={`Tendência ${tf.trendDirection} · viés ${tf.bias} · força ${tf.strength}/100`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {tf.timeframe}
      </div>
      <div className={cn("flex items-center justify-center gap-1 my-1", sideMeta.color)}>
        <SideIcon className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">{sideMeta.label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        força {tf.strength}
      </div>
    </div>
  );
}
