import { redirect } from "next/navigation";
import Link from "next/link";
import { History, TrendingUp, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalyzeForm } from "@/components/analysis/analyze-form";
import {
  signalShortLabel,
  signalBadgeVariant,
} from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";
import type { Timeframe } from "@/lib/market";

export const metadata = {
  title: "Nova análise",
  description: "Configure e execute uma análise de trading com IA.",
};

// Sidebar de "Análises recentes" precisa estar sempre fresh
export const dynamic = "force-dynamic";

interface SearchParams {
  asset?: string;
  timeframe?: string;
}

const VALID_TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M"] as const;

export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const initialAsset = sp.asset?.toUpperCase();
  const initialTimeframe = (
    sp.timeframe && (VALID_TIMEFRAMES as readonly string[]).includes(sp.timeframe)
      ? sp.timeframe
      : undefined
  ) as Timeframe | undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Saldo de créditos
  const { data: credits } = await supabase
    .from("user_credits")
    .select("credits_simple, credits_pro")
    .eq("user_id", user.id)
    .maybeSingle();

  const creditsSimple = credits?.credits_simple ?? 0;
  const creditsPro = credits?.credits_pro ?? 0;

  // Últimas análises do usuário — payload incluso para extrair o sinal correto
  // (fonte de verdade, mesmo se a coluna signal estiver com o valor antigo de 3 níveis).
  const { data: recent } = await supabase
    .from("analyses")
    .select("id, asset, timeframe, signal, strength, created_at, payload")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Helper local: extrai o sinal real do payload com fallback pra coluna
  function extractSig(row: {
    signal: string | null;
    payload: unknown;
  }): SignalDirection {
    const fromPayload = (row.payload as { signal?: { signal?: string } } | null)
      ?.signal?.signal;
    if (fromPayload) return fromPayload as SignalDirection;
    return (row.signal as SignalDirection | null) ?? "NEUTRAL";
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-2 px-3 py-1 border-primary/40 text-primary">
          <TrendingUp className="h-3 w-3 mr-1.5" />
          Motor v1.0 — 20 indicadores + 6 gates
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Nova análise</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o ativo, timeframe e tipo. A análise rodará em segundos e ficará salva no seu histórico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FORM principal */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurar análise</CardTitle>
              <CardDescription>
                A análise consome 1 crédito (Simples ou PRO) — devolvido se falha técnica.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyzeForm
                creditsSimple={creditsSimple}
                creditsPro={creditsPro}
                initialAsset={initialAsset}
                initialTimeframe={initialTimeframe}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: histórico recente */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Análises recentes</CardTitle>
                <Badge variant="ghost" className="text-[10px]">
                  Histórico
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(recent?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma análise ainda. Faça sua primeira!
                </div>
              ) : (
                <ul className="space-y-2">
                  {recent!.map((a) => {
                    const sig = extractSig({
                      signal: a.signal,
                      payload: a.payload,
                    });
                    return (
                      <li key={a.id}>
                        <Link
                          href={`/dashboard/analise/${a.id}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary transition-colors text-sm min-h-0"
                        >
                          <div>
                            <div className="font-medium">
                              {a.asset}{" "}
                              <span className="text-muted-foreground font-normal">
                                {a.timeframe}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(a.created_at).toLocaleString("pt-BR")}
                            </div>
                          </div>
                          <Badge
                            variant={signalBadgeVariant(sig)}
                            className={
                              sig === "WEAK_BUY"
                                ? "text-[10px] text-success border-success/40 bg-success/10"
                                : sig === "WEAK_SELL"
                                  ? "text-[10px] text-destructive border-destructive/40 bg-destructive/10"
                                  : "text-[10px]"
                            }
                          >
                            {signalShortLabel(sig)}{" "}
                            {a.strength ? `${a.strength}%` : ""}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">
                    Diferencial vs concorrência
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cada análise vem com a explicação de POR QUÊ o sinal foi gerado.
                    Auditável, exportável, sem caixa-preta.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
