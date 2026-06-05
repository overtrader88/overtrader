import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Crown,
  Calendar,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Receipt,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, formatPrice, type PlanTier } from "@/lib/plans/config";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha Assinatura · Trading IA",
};

interface SubscriptionRow {
  id: string;
  plan: PlanTier;
  status: "active" | "cancelled" | "expired" | "refunded";
  started_at: string;
  current_period_end: string;
  source: string;
  external_id: string | null;
  billing_period: "monthly" | "annual" | null;
}

interface TransactionRow {
  id: string;
  type: "purchase" | "consume" | "bonus" | "refund";
  amount_pro: number;
  amount_simple: number;
  source: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface CreditsRow {
  credits_pro: number;
  credits_simple: number;
  total_used: number;
}

export default async function MinhaAssinaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1) Subscription mais recente
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const activeSub = subs?.find((s: SubscriptionRow) => s.status === "active") ?? null;
  const subHistory = (subs ?? []) as SubscriptionRow[];

  // 2) Saldo de creditos
  const { data: credits } = await supabase
    .from("user_credits")
    .select("credits_pro, credits_simple, total_used")
    .eq("user_id", user.id)
    .maybeSingle();

  const balance: CreditsRow = (credits as CreditsRow) ?? {
    credits_pro: 0,
    credits_simple: 0,
    total_used: 0,
  };

  // 3) Historico de transacoes (ultimas 20)
  const { data: txns } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const transactions = (txns ?? []) as TransactionRow[];

  const currentPlan: PlanTier = activeSub?.plan ?? "free";
  const planConfig = PLANS[currentPlan];
  const activePeriod: "monthly" | "annual" =
    activeSub?.billing_period === "annual" ? "annual" : "monthly";
  const activeTier =
    currentPlan === "free"
      ? null
      : activePeriod === "annual"
        ? planConfig.annual
        : planConfig.monthly;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          Minha assinatura
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu plano, veja consumo e historico de creditos.
        </p>
      </div>

      {/* Card do plano atual */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary/5 to-card border-primary/30">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold">
                {planConfig.name}
              </h2>
              <StatusBadge status={activeSub?.status ?? "free"} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {planConfig.tagline}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              {activeTier ? (
                <>
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">
                    {formatPrice(activeTier.monthlyEquivalentCents)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                  {activePeriod === "annual" && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] text-success border-success/40"
                    >
                      Anual
                    </Badge>
                  )}
                </>
              ) : (
                <span className="text-2xl sm:text-3xl font-bold">Grátis</span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-xs">
            {activeSub && activeSub.current_period_end && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Renova em{" "}
                <strong className="text-foreground">
                  {new Date(activeSub.current_period_end).toLocaleDateString(
                    "pt-BR"
                  )}
                </strong>
              </div>
            )}
            {activeSub?.source && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                Via {activeSub.source === "hubla" ? "HUBLA" : activeSub.source}
              </div>
            )}
          </div>
        </div>

        {/* Saldo de creditos */}
        <div className="mt-5 pt-5 border-t border-border/40 grid grid-cols-3 gap-3">
          <BalanceCard
            label="Creditos PRO"
            value={balance.credits_pro}
            highlight
          />
          <BalanceCard
            label="Creditos Simples"
            value={balance.credits_simple}
          />
          <BalanceCard
            label="Total usado"
            value={balance.total_used}
            muted
          />
        </div>

        {/* CTAs */}
        <div className="mt-5 pt-5 border-t border-border/40 flex flex-col sm:flex-row gap-2">
          {currentPlan === "free" ? (
            <Button asChild className="min-h-[44px] flex-1">
              <Link href="/planos">
                Fazer upgrade <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : currentPlan === "pro" ? (
            <Button asChild variant="outline" className="min-h-[44px] flex-1">
              <Link href="/planos">
                Upgrade para PRO+ <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {activeSub && (
            <Button
              asChild
              variant="ghost"
              className="min-h-[44px] flex-1 text-muted-foreground"
            >
              <Link href="/dashboard/assinatura#cancelar">
                Como cancelar
              </Link>
            </Button>
          )}
        </div>
      </Card>

      {/* Como cancelar */}
      {activeSub && (
        <Card className="p-5" id="cancelar">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            Como cancelar
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para cancelar sua assinatura, acesse o painel do HUBLA pelo link
            que voce recebeu por email quando assinou. O acesso PRO/PRO+
            permanece ate{" "}
            <strong className="text-foreground">
              {activeSub.current_period_end
                ? new Date(activeSub.current_period_end).toLocaleDateString("pt-BR")
                : "fim do periodo"}
            </strong>
            . Apos isso, sua conta volta ao plano Free automaticamente.
          </p>
          <p className="text-[11px] text-muted-foreground mt-3 italic">
            Estorno: para chargebacks ou reembolsos, entre em contato com nosso
            suporte. Reembolsos revogam acesso imediatamente.
          </p>
        </Card>
      )}

      {/* Historico de subscriptions */}
      {subHistory.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Historico de assinaturas
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/50 border-b border-border/40">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Plano
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Periodo
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:table-cell">
                    Inicio
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Vence/venceu
                  </th>
                </tr>
              </thead>
              <tbody>
                {subHistory.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {PLANS[sub.plan].name}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {sub.billing_period === "annual" ? "Anual" : "Mensal"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(sub.started_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(sub.current_period_end).toLocaleDateString(
                        "pt-BR"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Apagar conta (LGPD direito ao apagamento) */}
      <DeleteAccountButton />

      {/* Historico de creditos (transacoes) */}
      {transactions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Ultimas movimentacoes de creditos
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border/40">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Tipo
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    PRO
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Simples
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:table-cell">
                    Origem
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="px-3 py-2 text-xs">
                      <TxTypeBadge type={tx.type} />
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums text-xs ${
                        tx.amount_pro > 0
                          ? "text-success"
                          : tx.amount_pro < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {tx.amount_pro > 0 ? "+" : ""}
                      {tx.amount_pro}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums text-xs ${
                        tx.amount_simple > 0
                          ? "text-success"
                          : tx.amount_simple < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {tx.amount_simple > 0 ? "+" : ""}
                      {tx.amount_simple}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                      {tx.source}
                    </td>
                    <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Subcomponents
// ============================================================

function BalanceCard({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          highlight
            ? "text-2xl sm:text-3xl font-bold text-primary tabular-nums mt-1"
            : muted
              ? "text-xl sm:text-2xl font-bold text-muted-foreground tabular-nums mt-1"
              : "text-xl sm:text-2xl font-bold tabular-nums mt-1"
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="text-success border-success/40 text-[10px]">
        <CheckCircle2 className="h-3 w-3" /> Ativa
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="outline" className="text-warning border-warning/40 text-[10px]">
        <Clock className="h-3 w-3" /> Cancelada (valida ate fim)
      </Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[10px]">
        Expirada
      </Badge>
    );
  }
  if (status === "refunded") {
    return (
      <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
        <XCircle className="h-3 w-3" /> Estornada
      </Badge>
    );
  }
  if (status === "free") {
    return (
      <Badge variant="outline" className="text-[10px]">
        Plano gratuito
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function TxTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    purchase: "Compra",
    consume: "Uso",
    bonus: "Bonus",
    refund: "Estorno",
  };
  return <span className="text-xs">{labels[type] ?? type}</span>;
}
