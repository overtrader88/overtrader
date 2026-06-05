import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, History, ArrowRight, Crown, Sparkles,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { getAsset } from "@/lib/market";
import {
  signalSide,
  signalShortLabel,
  signalTextColor,
  signalBadgeVariant,
} from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";

interface AnalysisRow {
  id: string;
  asset: string;
  asset_type: "crypto" | "forex" | "stocks" | "indices" | "commodities";
  timeframe: string;
  analysis_type: "simple" | "complete";
  signal: SignalDirection | null;
  strength: number | null;
  confluence: number | null;
  entry: number | null;
  created_at: string;
  /** Fonte de verdade do sinal (payload jsonb) */
  payload?: unknown;
}

function extractSignal(row: AnalysisRow): SignalDirection {
  const payloadSig = (row.payload as { signal?: { signal?: string } } | null)
    ?.signal?.signal;
  if (payloadSig) return payloadSig as SignalDirection;
  return row.signal ?? "NEUTRAL";
}

interface Props {
  items: AnalysisRow[];
  hasFilters: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryList({ items, hasFilters }: Props) {
  if (items.length === 0) {
    return (
      <Card className="p-10 text-center">
        <History className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
        <h3 className="text-lg font-semibold mb-1">
          {hasFilters ? "Nenhuma análise encontrada" : "Nenhuma análise ainda"}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {hasFilters
            ? "Tente ajustar os filtros."
            : "Faça sua primeira análise para começar a construir seu histórico."}
        </p>
        {!hasFilters && (
          <Button asChild>
            <Link href="/dashboard/analise">
              Fazer primeira análise
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border/40">
        {items.map((a) => {
          const asset = getAsset(a.asset);
          // Lê do payload jsonb (fonte de verdade) com fallback pra coluna
          const sig: SignalDirection = extractSignal(a);
          const side = signalSide(sig);
          const Icon =
            sig === "STRONG_BUY"
              ? ChevronUp
              : sig === "STRONG_SELL"
                ? ChevronDown
                : sig === "BUY" || sig === "WEAK_BUY"
                  ? TrendingUp
                  : sig === "SELL" || sig === "WEAK_SELL"
                    ? TrendingDown
                    : Minus;
          const signalColor = signalTextColor(sig);

          return (
            <li key={a.id}>
              <Link
                href={`/dashboard/analise/${a.id}`}
                prefetch={false}
                className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:py-4 hover:bg-secondary/50 transition-colors min-h-0"
              >
                {/* Ícone do sinal */}
                <div
                  className={cn(
                    "grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full flex-shrink-0",
                    side === "buy" && "bg-success/15",
                    side === "sell" && "bg-destructive/15",
                    side === "neutral" && "bg-muted/40"
                  )}
                >
                  <Icon className={cn("h-5 w-5", signalColor)} />
                </div>

                {/* Ativo + timeframe + signal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {asset?.emoji} {a.asset}
                    </span>
                    <Badge variant="ghost" className="text-[10px] tabular-nums">
                      {a.timeframe}
                    </Badge>
                    <Badge
                      variant={signalBadgeVariant(sig)}
                      className="text-[10px]"
                    >
                      {signalShortLabel(sig)}
                    </Badge>
                    {a.analysis_type === "complete" ? (
                      <Badge variant="accent" className="text-[10px]">
                        <Crown className="h-2.5 w-2.5 mr-0.5" />
                        PRO
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        Simples
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {asset?.name ?? a.asset} · {formatDate(a.created_at)}
                  </div>
                </div>

                {/* Força + confluência */}
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                  {a.entry !== null && (
                    <div className="hidden md:block text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Entrada
                      </div>
                      <div className="font-mono text-sm tabular-nums">
                        {a.entry.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  )}
                  {a.strength !== null && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Força
                      </div>
                      <div className={cn("font-bold tabular-nums text-sm", signalColor)}>
                        {a.strength}%
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
