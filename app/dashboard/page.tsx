import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart, Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { CreditsCard } from "@/components/dashboard/credits-card";
import { FearGreedWidget } from "@/components/dashboard/fear-greed-widget";
import { FeatureMenu } from "@/components/dashboard/feature-menu";
import { MultiMarketTickers } from "@/components/dashboard/multi-market-tickers";
import { RecentAnalyses } from "@/components/dashboard/recent-analyses";

export const metadata = {
  title: "Dashboard",
  description: "Sua central de análises com dados ao vivo.",
};

// Dashboard sempre fresh — widget de Recent Analyses precisa refletir a última análise
// rodada (não pode cachear). Tickers/F&G também se beneficiam de não cachear.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName =
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "Usuário";

  // Saldo
  const { data: credits } = await supabase
    .from("user_credits")
    .select("credits_simple, credits_pro, total_used")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      {/* Welcome + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="outline" className="mb-3 px-3 py-1 border-primary/40 text-primary">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Multi-mercado · 143 ativos em 5 classes
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Olá, {displayName}!
          </h1>
          <p className="mt-1 text-muted-foreground text-sm sm:text-base">
            Sua central de análises com dados ao vivo. O que você quer analisar hoje?
          </p>
        </div>
        <Button size="lg" asChild className="sm:flex-shrink-0">
          <Link href="/dashboard/analise">
            <LineChart className="h-4 w-4" />
            Nova análise
          </Link>
        </Button>
      </div>

      {/* Menu de funcionalidades */}
      <FeatureMenu />

      {/* Tickers ao vivo multi-categoria - linha cheia */}
      <MultiMarketTickers />

      {/* Grid: F&G + Créditos + Recentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FearGreedWidget />
        <CreditsCard
          creditsSimple={credits?.credits_simple ?? 0}
          creditsPro={credits?.credits_pro ?? 0}
          totalUsed={credits?.total_used ?? 0}
        />
        <RecentAnalyses userId={user.id} />
      </div>

      {/* CTA - feedback */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-card to-card/60 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold mb-1">
              Sua opinião molda o produto
            </h3>
            <p className="text-sm text-muted-foreground">
              Estamos em beta. Reporte bugs ou sugestões em &lt;5 minutos.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="mailto:feedback@tradeai.com.br?subject=Feedback%20beta%20privado">
              Enviar feedback
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
