import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { AnalysisResult, IndicatorResult } from "@/lib/analysis/types";

interface Props {
  result: AnalysisResult;
}

function formatValue(v: IndicatorResult["value"]): string {
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "—";
    return v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  // Compound (objeto) — mostra a chave principal
  const entries = Object.entries(v).filter(([, val]) => typeof val === "number");
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 2)
    .map(([k, val]) => `${k}: ${(val as number).toFixed(2)}`)
    .join(" · ");
}

export function IndicatorsTab({ result }: Props) {
  const { indicators } = result;

  // Agrupa por categoria
  const byCategory = indicators.reduce<Record<string, IndicatorResult[]>>(
    (acc, ind) => {
      const cat = ind.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(ind);
      return acc;
    },
    {}
  );

  const summary = result.signal.votes;

  return (
    <div className="space-y-4">
      {/* Resumo da votação */}
      <Card className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Votação dos {indicators.length} indicadores
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-success tabular-nums">{summary.buy}</div>
            <div className="text-xs text-muted-foreground">COMPRA</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground tabular-nums">
              {summary.neutral}
            </div>
            <div className="text-xs text-muted-foreground">NEUTRO</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-destructive tabular-nums">{summary.sell}</div>
            <div className="text-xs text-muted-foreground">VENDA</div>
          </div>
        </div>
      </Card>

      {/* Tabela por categoria */}
      {Object.entries(byCategory).map(([category, items]) => (
        <Card key={category} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-card/50">
            <div className="text-xs uppercase tracking-wider font-semibold text-primary">
              {category}{" "}
              <span className="text-muted-foreground font-normal ml-2">
                · {items.length}
              </span>
            </div>
          </div>
          <ul className="divide-y divide-border/40">
            {items.map((ind) => (
              <li
                key={ind.name}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{ind.name}</div>
                  {ind.note && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ind.note}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs sm:text-sm tabular-nums text-foreground/80">
                    {formatValue(ind.value)}
                  </div>
                  <Badge
                    variant={
                      ind.vote === "BUY"
                        ? "success"
                        : ind.vote === "SELL"
                          ? "destructive"
                          : "ghost"
                    }
                    className={cn("text-[10px] min-w-[64px] justify-center")}
                  >
                    {ind.vote === "BUY"
                      ? "COMPRA"
                      : ind.vote === "SELL"
                        ? "VENDA"
                        : "NEUTRO"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
