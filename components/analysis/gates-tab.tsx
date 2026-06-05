import { Check, X, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AnalysisResult } from "@/lib/analysis/types";

interface Props {
  result: AnalysisResult;
}

export function GatesTab({ result }: Props) {
  const { gates } = result;
  const passed = gates.filter((g) => g.passed).length;
  const total = gates.length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          {passed === total ? (
            <ShieldCheck className="h-12 w-12 text-success" />
          ) : (
            <ShieldAlert className="h-12 w-12 text-warning" />
          )}
          <div>
            <div className="text-2xl font-bold">
              {passed} / {total} gates aprovados
            </div>
            <p className="text-sm text-muted-foreground">
              {passed === total
                ? "Todos os filtros de qualidade passaram — sinal com alta confiança."
                : passed >= 4
                  ? "Maioria dos filtros aprovados, mas alguns alertas — opere com cuidado."
                  : "Sinal não passou em vários filtros críticos. Recomenda-se aguardar."}
            </p>
          </div>
        </div>
      </Card>

      <ul className="space-y-2">
        {gates.map((g) => (
          <li key={g.id}>
            <Card className="p-4 flex items-start gap-3">
              <span
                className={
                  g.passed
                    ? "grid h-8 w-8 place-items-center rounded-full bg-success/15 flex-shrink-0"
                    : "grid h-8 w-8 place-items-center rounded-full bg-destructive/15 flex-shrink-0"
                }
              >
                {g.passed ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">Gate {g.id}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm">{g.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{g.detail}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
