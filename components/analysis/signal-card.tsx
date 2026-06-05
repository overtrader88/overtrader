import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { AnalysisResult, SignalDirection } from "@/lib/analysis/types";
import {
  signalLabel,
  signalSide,
  signalTextColor,
  hasDirection,
  isWeak,
} from "@/lib/analysis/signal-utils";

interface Props {
  result: AnalysisResult;
}

function fmt(n: number, decimals = 2) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals < 4 ? 4 : decimals,
  });
}

function signalIcon(s: SignalDirection) {
  switch (s) {
    case "STRONG_BUY":
      return <ChevronUp className="h-10 w-10" strokeWidth={3} />;
    case "BUY":
      return <TrendingUp className="h-9 w-9" />;
    case "WEAK_BUY":
      return <TrendingUp className="h-8 w-8 opacity-70" />;
    case "WEAK_SELL":
      return <TrendingDown className="h-8 w-8 opacity-70" />;
    case "SELL":
      return <TrendingDown className="h-9 w-9" />;
    case "STRONG_SELL":
      return <ChevronDown className="h-10 w-10" strokeWidth={3} />;
    default:
      return <Minus className="h-8 w-8" />;
  }
}

function gradientBg(s: SignalDirection) {
  switch (s) {
    case "STRONG_BUY":
      return "from-success/30 to-card border-success/50";
    case "BUY":
      return "from-success/20 to-card border-success/40";
    case "WEAK_BUY":
      return "from-success/10 to-card border-success/25";
    case "WEAK_SELL":
      return "from-destructive/10 to-card border-destructive/25";
    case "SELL":
      return "from-destructive/20 to-card border-destructive/40";
    case "STRONG_SELL":
      return "from-destructive/30 to-card border-destructive/50";
    default:
      return "from-muted/15 to-card border-border";
  }
}

export function SignalCard({ result }: Props) {
  const { signal, risk } = result;
  const dir = signal.signal;
  const side = signalSide(dir);
  // Mostra niveis em QUALQUER sinal direcional (forte ou fraco) — só esconde em NEUTRAL.
  // Sinais fracos exibem aviso de baixa confluência junto.
  const showLevels = hasDirection(dir);
  const weak = isWeak(dir);

  return (
    <Card
      className={cn(
        "p-5 sm:p-6 bg-gradient-to-br",
        gradientBg(dir)
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Sinal identificado
          </div>
          <div
            className={cn(
              "flex items-center gap-3 text-2xl sm:text-3xl lg:text-4xl font-bold",
              signalTextColor(dir)
            )}
          >
            {signalIcon(dir)}
            <span className="leading-tight">{signalLabel(dir)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Força
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums">
              {signal.strength}
              <span className="text-base text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Confluência
            </div>
            <div className="text-2xl sm:text-3xl font-bold tabular-nums">
              {signal.confluence}
              <span className="text-base text-muted-foreground">/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de sinal fraco (aparece JUNTO com os níveis, não no lugar) */}
      {weak && (
        <div className="mb-4 rounded-lg bg-warning/10 border border-warning/30 p-3 flex items-start gap-3">
          <Zap className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-xs text-foreground/90">
            <strong>Sinal com baixa confluência</strong> — indicadores divergentes.
            O plano abaixo está calculado, mas opere com cautela (use stop mais
            apertado ou reduza tamanho de posição).
          </div>
        </div>
      )}

      {showLevels && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Entrada", value: risk.entry, color: "text-foreground" },
            { label: "Stop", value: risk.stopLoss, color: "text-destructive" },
            { label: "TP 1", value: risk.takeProfit1, color: "text-success" },
            { label: "TP 2", value: risk.takeProfit2, color: "text-success" },
            { label: "TP 3", value: risk.takeProfit3, color: "text-success" },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-lg bg-background/60 border border-border/40 p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {row.label}
              </div>
              <div
                className={cn(
                  "font-mono font-bold tabular-nums text-base sm:text-lg",
                  row.color
                )}
              >
                {fmt(row.value)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {showLevels ? `R:R do TP1: ` : "R:R indisponível: "}
          <b className="text-foreground">
            {showLevels ? risk.rr1.toFixed(2) : "—"}
          </b>
          {side !== "neutral" && (
            <span className="ml-2 text-muted-foreground">
              (lado: {side === "buy" ? "compra" : "venda"})
            </span>
          )}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {result.meta.candlesUsed} candles · {result.meta.enginVersion}
        </Badge>
      </div>
    </Card>
  );
}
