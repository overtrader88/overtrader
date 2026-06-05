import Link from "next/link";
import { redirect } from "next/navigation";
import { History, LineChart, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HistoryFilters } from "@/components/historico/history-filters";
import { HistoryList } from "@/components/historico/history-list";
import { Pagination } from "@/components/historico/pagination";
import { signalSide } from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";

export const metadata = {
  title: "Histórico de análises",
  description: "Todas as suas análises com filtros e estatísticas.",
};

// Histórico nunca cacheia — usuário quer ver análises mais recentes
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    type_asset?: string;
    asset?: string;
    timeframe?: string;
    signal?: string;
    period?: string;
    type?: string;
  }>;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Construir query com filtros — payload incluído para extrair signal real
  let query = supabase
    .from("analyses")
    .select(
      "id, asset, asset_type, timeframe, analysis_type, signal, strength, confluence, entry, created_at, payload",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (params.type_asset) {
    query = query.eq("asset_type", params.type_asset);
  }
  if (params.asset) {
    query = query.eq("asset", params.asset);
  }
  if (params.timeframe) {
    query = query.eq("timeframe", params.timeframe);
  }
  if (params.signal) {
    query = query.eq("signal", params.signal);
  }
  if (params.type) {
    query = query.eq("analysis_type", params.type);
  }
  // Período
  if (params.period && params.period !== "all") {
    const days =
      params.period === "1d" ? 1 : params.period === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    query = query.gte("created_at", since);
  }

  // Paginação
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data: items, count, error } = await query;
  if (error) {
    console.error("[historico] query error:", error);
  }

  // Stats agregadas para o período filtrado (mesmos filtros, sem paginação)
  // Buscamos payload também pra extrair o signal real
  let statsQuery = supabase
    .from("analyses")
    .select("signal, payload", { count: "exact", head: false })
    .eq("user_id", user.id);
  if (params.type_asset) statsQuery = statsQuery.eq("asset_type", params.type_asset);
  if (params.asset) statsQuery = statsQuery.eq("asset", params.asset);
  if (params.timeframe) statsQuery = statsQuery.eq("timeframe", params.timeframe);
  if (params.signal) statsQuery = statsQuery.eq("signal", params.signal);
  if (params.type) statsQuery = statsQuery.eq("analysis_type", params.type);
  if (params.period && params.period !== "all") {
    const days = params.period === "1d" ? 1 : params.period === "7d" ? 7 : 30;
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    statsQuery = statsQuery.gte("created_at", since);
  }
  const { data: statsData } = await statsQuery;
  // Agrupa pelos 3 lados (compra/neutro/venda) consolidando os 7 níveis.
  // Lê do payload (fonte de verdade) com fallback para a coluna signal.
  const counts = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  for (const row of statsData ?? []) {
    const payloadSig = (
      row.payload as { signal?: { signal?: string } } | null
    )?.signal?.signal as SignalDirection | undefined;
    const sig = payloadSig ?? (row.signal as SignalDirection | null) ?? "NEUTRAL";
    const side = signalSide(sig);
    if (side === "buy") counts.BUY++;
    else if (side === "sell") counts.SELL++;
    else counts.NEUTRAL++;
  }
  const totalFiltered = statsData?.length ?? 0;

  const hasFilters = !!(
    params.type_asset ||
    params.asset ||
    params.timeframe ||
    params.signal ||
    params.type ||
    (params.period && params.period !== "all")
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-2 px-3 py-1 border-primary/40 text-primary">
            <History className="h-3 w-3 mr-1.5" />
            Disponível desde o dia 1 (diferencial vs concorrente)
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Histórico de análises
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalFiltered} análise{totalFiltered !== 1 ? "s" : ""}
            {hasFilters ? " correspondente(s) aos filtros" : " no total"}
          </p>
        </div>
        <Button size="lg" asChild className="sm:flex-shrink-0">
          <Link href="/dashboard/analise">
            <LineChart className="h-4 w-4" />
            Nova análise
          </Link>
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox
          label="Total filtrado"
          value={totalFiltered}
          icon={BarChart3}
          color="text-foreground"
        />
        <StatBox
          label="Compras"
          value={counts.BUY}
          icon={TrendingUp}
          color="text-success"
        />
        <StatBox
          label="Neutras"
          value={counts.NEUTRAL}
          icon={Minus}
          color="text-muted-foreground"
        />
        <StatBox
          label="Vendas"
          value={counts.SELL}
          icon={TrendingDown}
          color="text-destructive"
        />
      </div>

      {/* Layout: sidebar filtros + lista */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside>
          <Card className="p-4 sticky top-20">
            <HistoryFilters />
          </Card>
        </aside>

        <div>
          <HistoryList items={items ?? []} hasFilters={hasFilters} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-2xl sm:text-3xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
    </Card>
  );
}
