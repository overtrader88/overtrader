"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  Sparkles,
  Shield,
  TrendingUp,
  Crown,
  Gift,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  PLANS_ORDERED,
  formatPrice,
  annualDiscountPercent,
  type PlanConfig,
  type PlanTier,
  type BillingPeriod,
} from "@/lib/plans/config";

interface Props {
  currentPlan: PlanTier;
  isLogged: boolean;
}

export function PlanosClient({ currentPlan, isLogged }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>("annual");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="container mx-auto px-4 pt-10 pb-6 sm:pt-16 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Sparkles className="h-3 w-3" />
          Backtest público · PF 3.82 em ouro · 6 contextos validados
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">
          A primeira IA de trading que{" "}
          <span className="text-primary">prova</span> antes de prometer
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          20 indicadores + Smart Money + Multi-Timeframe + Monte Carlo +
          Harmônicos + WEGD + Backtest público — tudo em <strong>uma única
          análise</strong>. IA generativa narra o porquê.{" "}
          <strong className="text-foreground">3 análises grátis sem cartão.</strong>
        </p>
      </div>

      {/* Toggle mensal/anual */}
      <div className="flex justify-center px-4 mb-8">
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {/* Pricing cards */}
      <div className="container mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS_ORDERED.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              period={period}
              currentPlan={currentPlan}
              isLogged={isLogged}
            />
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
          <TrustItem
            icon={Shield}
            title="Cancele quando quiser"
            text="Sem fidelidade. Acesso ate o fim do periodo pago."
          />
          <TrustItem
            icon={TrendingUp}
            title="Backtest publico"
            text="Cada analise mostra historico do padrao em 3 estrategias."
          />
          <TrustItem
            icon={Sparkles}
            title="IA generativa real"
            text="GPT-4o-mini narra cada sinal em portugues natural."
          />
        </div>

        {/* FAQ */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-4 text-center">
            Duvidas frequentes
          </h2>
          <div className="space-y-3">
            <FAQItem
              q="Como funciona o trial vitalicio do Free?"
              a="Ao criar conta voce ganha 3 creditos PRO permanentes (nao renovam). Usa quando quiser — pode ser hoje, amanha ou daqui 6 meses. Apos consumir os 3, precisa assinar PRO ou PRO+ pra continuar analisando. O dashboard com precos ao vivo de 5 mercados continua acessivel mesmo sem creditos."
            />
            <FAQItem
              q="O que e 1 credito?"
              a="1 credito = 1 analise completa. Independente do ativo (BTC, EUR/USD, AAPL, Ouro, S&P 500) e independente do timeframe. Tudo conta como 1 credito."
            />
            <FAQItem
              q="Vale mais o plano anual?"
              a="Sim. PRO anual paga R$ 50/mes equivalente (vs R$ 59 mensal). PRO+ anual R$ 78/mes (vs R$ 99). Voce economiza ~15-21% e ganha mais creditos no total."
            />
            <FAQItem
              q="O backtest e real?"
              a="Sim. Rodamos o algoritmo sobre os ultimos 500 candles historicos, candle a candle, sem lookahead bias. Voce ve win rate, profit factor e qual estrategia teve melhor desempenho."
            />
            <FAQItem
              q="O sistema garante lucro?"
              a="Nao. Trading envolve risco e nenhum sistema garante lucro. Entregamos um sinal validado historicamente — voce decide se opera, com qual tamanho e quando. Resultados passados nao garantem performance futura."
            />
          </div>
        </div>

        {/* Voltar */}
        <div className="mt-10 text-center">
          <Button variant="ghost" asChild>
            <Link href={isLogged ? "/dashboard" : "/"}>Voltar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Toggle mensal/anual
// ============================================================

function PeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/50 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-full min-h-[40px] transition-colors",
          value === "monthly"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Mensal
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded-full min-h-[40px] transition-colors relative",
          value === "annual"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Anual
        <span className="ml-2 inline-block px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold">
          -21%
        </span>
      </button>
    </div>
  );
}

// ============================================================
// PlanCard
// ============================================================

function PlanCard({
  plan,
  period,
  currentPlan,
  isLogged,
}: {
  plan: PlanConfig;
  period: BillingPeriod;
  currentPlan: PlanTier;
  isLogged: boolean;
}) {
  const isCurrent = currentPlan === plan.id;
  const isFree = plan.id === "free";

  // Free nao tem pricing — usa oneTimeCredits
  const tier = isFree ? null : period === "annual" ? plan.annual : plan.monthly;
  const discount = !isFree ? annualDiscountPercent(plan) : 0;

  // Checkout URL via env
  const checkoutUrl = tier
    ? (process.env[tier.checkoutUrlEnvKey] ?? null)
    : null;

  return (
    <Card
      className={cn(
        "relative p-5 sm:p-6 flex flex-col",
        plan.highlighted
          ? "border-primary border-2 shadow-lg shadow-primary/10 bg-gradient-to-b from-primary/5 to-transparent"
          : "bg-card/60"
      )}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2 py-1">
            <Crown className="h-3 w-3 mr-1" /> Mais popular
          </Badge>
        </div>
      )}

      {/* Nome + tagline */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="text-lg sm:text-xl font-bold">{plan.name}</h3>
          {isCurrent && (
            <Badge
              variant="outline"
              className="text-[10px] text-success border-success/40"
            >
              Seu plano
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </div>

      {/* Preco */}
      <div className="mb-5">
        {isFree ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold">Grátis</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {plan.oneTimeCredits} analises vitalicias
            </p>
          </>
        ) : tier ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-bold tabular-nums">
                {formatPrice(tier.monthlyEquivalentCents)}
              </span>
              <span className="text-xs text-muted-foreground">/mes</span>
            </div>
            {period === "annual" && (
              <p className="text-[11px] text-success mt-1 font-medium">
                <Gift className="h-3 w-3 inline mr-1" />
                Total {formatPrice(tier.totalPriceCents)}/ano
                {discount > 0 && (
                  <span className="ml-1">· economize {discount}%</span>
                )}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {tier.credits} analises {period === "annual" ? "no ano" : "no mes"}
            </p>
          </>
        ) : null}
      </div>

      {/* CTA */}
      <div className="mb-5">
        {isCurrent ? (
          <Button
            variant="outline"
            disabled
            className="w-full min-h-[44px]"
          >
            Plano atual
          </Button>
        ) : isFree ? (
          <Button
            asChild
            variant="outline"
            className="w-full min-h-[44px]"
          >
            <Link href={isLogged ? "/dashboard" : "/cadastro"}>
              {isLogged ? "Ir para dashboard" : "Comecar gratis"}
            </Link>
          </Button>
        ) : checkoutUrl ? (
          <Button asChild className="w-full min-h-[44px]">
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              Assinar {plan.name} {period === "annual" ? "Anual" : "Mensal"}
            </a>
          </Button>
        ) : (
          <Button
            disabled
            className="w-full min-h-[44px]"
            title="Configurar URLs do HUBLA no .env"
          >
            Em breve
          </Button>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5 text-sm flex-1">
        {/* Linha dinamica de creditos — muda conforme periodo selecionado */}
        {!isFree && tier && (
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span className="text-foreground/90 font-medium">
              {period === "annual" ? (
                <>
                  <strong>{tier.credits.toLocaleString("pt-BR")}</strong>{" "}
                  análises no ano
                </>
              ) : (
                <>
                  <strong>{tier.credits}</strong> análises por mês
                </>
              )}
            </span>
          </li>
        )}

        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2" title={f.detail}>
            {f.included ? (
              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
            )}
            <span
              className={
                f.included
                  ? "text-foreground/90"
                  : "text-muted-foreground/60 line-through"
              }
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ============================================================
// Trust + FAQ
// ============================================================

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-3">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border border-border/40 rounded-lg bg-card/40 overflow-hidden">
      <summary className="cursor-pointer min-h-[44px] px-4 py-3 flex items-center justify-between gap-2 font-medium text-sm hover:bg-card/80 transition-colors list-none">
        <span>{q}</span>
        <span className="text-primary text-lg group-open:rotate-45 transition-transform">
          +
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
        {a}
      </div>
    </details>
  );
}
