/**
 * Widget de Análises Recentes do usuário (Server Component).
 * Mostra últimas 5 + agregado de quantas por sinal.
 */
import Link from "next/link";
import {
  ArrowRight,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import {
  signalShortLabel,
  signalSide,
  signalTextColor,
} from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";

interface Props {
  userId: string;
}

export async function RecentAnalyses({ userId }: Props) {
  const supabase = await createClient();

  // Últimas 5 análises — também pegamos payload->signal->signal como
  // fonte de verdade caso a coluna signal esteja desatualizada (enum não migrado).
  const { data: recent } = await supabase
    .from("analyses")
    .select("id, asset, timeframe, signal, strength, created_at, payload")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  // Estatísticas agregadas — também busca payload pra mesmo motivo
  const { data: stats } = await supabase
    .from("analyses")
    .select("signal, payload")
    .eq("user_id", userId);

  // Helper: extrai o sinal REAL preferindo o payload (jsonb) sobre a coluna
  type Row = { signal: SignalDirection | null; payload: unknown };
  const extractSignal = (row: Row): SignalDirection => {
    const payloadSig = (row.payload as { signal?: { signal?: string } } | null)
      ?.signal?.signal;
    if (payloadSig) return payloadSig as SignalDirection;
    return row.signal ?? "NEUTRAL";
  };

  // Agrupa pelos 3 lados (compra / neutro / venda) — independente da intensidade
  const counts = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  for (const row of stats ?? []) {
    const sig = extractSignal(row);
    const side = signalSide(sig);
    if (side === "buy") counts.BUY++;
    else if (side === "sell") counts.SELL++;
    else counts.NEUTRAL++;
  }
  const total = stats?.length ?? 0;

  return (
    <Card className="p-4 sm:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Suas análises recentes</h3>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "Faça sua primeira análise"
              : `${total} análise${total !== 1 ? "s" : ""} no total`}
          </p>
        </div>
        {total > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/historico">
              Ver tudo
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>

      {/* Stats agregadas */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatPill label="Compra" value={counts.BUY} color="text-success" />
          <StatPill label="Neutro" value={counts.NEUTRAL} color="text-muted-foreground" />
          <StatPill label="Venda" value={counts.SELL} color="text-destructive" />
        </div>
      )}

      {/* Lista */}
      {(recent?.length ?? 0) === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 text-sm text-muted-foreground">
          <History className="h-10 w-10 mb-3 opacity-40" />
          <p>Nenhuma análise ainda.</p>
          <Button size="sm" asChild className="mt-3">
            <Link href="/dashboard/analise">Fazer primeira análise</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-1 flex-1">
          {recent!.map((a) => {
            const ago = formatAgo(new Date(a.created_at));
            // Mesma estratégia: prefere o sinal do payload sobre a coluna
            const sig = extractSignal({
              signal: a.signal as SignalDirection | null,
              payload: a.payload,
            });
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
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/analise/${a.id}`}
                  className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg hover:bg-secondary transition-colors min-h-0"
                  prefetch={false}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      signalTextColor(sig)
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {a.asset}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        {a.timeframe}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {signalShortLabel(sig)} · {ago}
                    </div>
                  </div>
                  {a.strength !== null && (
                    <Badge variant="ghost" className="text-[10px] tabular-nums">
                      {a.strength}%
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-2 text-center">
      <div className={cn("text-lg font-bold tabular-nums", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function formatAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d atrás`;
  return date.toLocaleDateString("pt-BR");
}
