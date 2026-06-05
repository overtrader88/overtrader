import Link from "next/link";
import { Check, Sparkles, Crown, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="container-fluid py-16 sm:py-24 bg-card/20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Gift className="h-3 w-3" />
            Trial vitalício sem cartão
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Comece grátis. Cresça quando precisar.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            3 análises completas pra você testar sem cadastrar cartão. Quando
            quiser mais, planos a partir de <strong className="text-foreground">R$ 50/mês</strong>{" "}
            no anual.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <PreviewCard
            name="Free"
            tagline="Experimente o produto"
            price="Grátis"
            period=""
            features={[
              "3 análises completas vitalícias",
              "Dashboard 5 mercados ao vivo",
              "Gráfico TradingView profissional",
              "Histórico completo",
            ]}
            cta="Começar grátis"
            href="/cadastro"
          />
          <PreviewCard
            name="PRO"
            tagline="Trader multi-mercado"
            price="R$ 50"
            period="/mês no anual"
            highlight
            features={[
              "75 análises por mês",
              "Todos os 143 ativos liberados",
              "IA narrativa GPT-4o-mini",
              "Backtest + 12 análises por sinal",
              "Smart Money + Multi-TF + Monte Carlo",
            ]}
            cta="Ver detalhes"
            href="/planos"
          />
          <PreviewCard
            name="PRO+"
            tagline="Alertas + monitoramento"
            price="R$ 78"
            period="/mês no anual"
            features={[
              "90 análises por mês",
              "Tudo do PRO incluso",
              "Alertas Telegram em tempo real",
              "Bot interativo /btc 1h /eth 4h",
              "Watchlist ilimitada com cron 15min",
            ]}
            cta="Ver detalhes"
            href="/planos"
          />
        </div>

        <div className="text-center">
          <Button asChild size="xl">
            <Link href="/planos">
              Ver comparativo completo
              <ArrowRight className="ml-1" />
            </Link>
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3">
            Pagamento via HUBLA · Cancele a qualquer momento · Acesso até o fim
            do período já pago
          </p>
        </div>
      </div>
    </section>
  );
}

function PreviewCard({
  name,
  tagline,
  price,
  period,
  features,
  cta,
  href,
  highlight,
}: {
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border p-6 flex flex-col ${
        highlight
          ? "border-primary border-2 shadow-lg shadow-primary/10 bg-gradient-to-b from-primary/5 to-transparent"
          : "border-border/40 bg-card/40"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2 py-1">
            <Crown className="h-3 w-3 mr-1" /> Mais popular
          </Badge>
        </div>
      )}

      <h3 className="text-lg font-bold">{name}</h3>
      <p className="text-xs text-muted-foreground mb-3">{tagline}</p>

      <div className="mb-4">
        <span className="text-3xl font-bold tabular-nums">{price}</span>
        {period && (
          <span className="text-xs text-muted-foreground ml-1">{period}</span>
        )}
      </div>

      <ul className="space-y-2 text-sm flex-1 mb-5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <span className="text-foreground/85">{f}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        variant={highlight ? "default" : "outline"}
        className="w-full min-h-[44px]"
      >
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
