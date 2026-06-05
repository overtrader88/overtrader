import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-radial-primary">
      <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

      {/* Animated gradient blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <div className="container-fluid relative py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-4xl text-center animate-fade-in">
          <Badge
            variant="outline"
            className="mb-6 px-4 py-1.5 text-xs border-primary/40 text-primary"
          >
            <Sparkles className="h-3 w-3 mr-1.5" />
            Validado · PF 3.82 em ouro · 6 contextos de backtest
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-balance">
            A IA de trading que{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              prova antes de prometer
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            <strong className="text-foreground">12 análises por sinal</strong>{" "}
            — técnica, Smart Money, multi-timeframe, Monte Carlo, harmônicos,
            WEGD, sazonalidade e contexto macro.{" "}
            <strong className="text-foreground">IA explica o porquê</strong>{" "}
            de cada sinal em português. Backtest público que o concorrente esconde.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="xl" asChild className="w-full sm:w-auto">
              <Link href="/cadastro">
                Começar grátis (3 análises)
                <ArrowRight className="ml-1" />
              </Link>
            </Button>
            <Button
              size="xl"
              variant="outline"
              asChild
              className="w-full sm:w-auto"
            >
              <Link href="/planos">Ver planos</Link>
            </Button>
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            Sem cartão · Trial vitalício · Cancele a qualquer momento
          </p>

          {/* Proof bar — números reais que conquistamos */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
            <ProofCard
              icon={TrendingUp}
              label="Profit Factor"
              value="3.82"
              detail="Ouro 4h — backtest"
            />
            <ProofCard
              icon={Activity}
              label="Multi-mercado"
              value="143"
              detail="Ativos em 5 classes"
            />
            <ProofCard
              icon={ShieldCheck}
              label="Filtros"
              value="8 gates"
              detail="Adaptativo por regime"
            />
            <ProofCard
              icon={Sparkles}
              label="IA narrativa"
              value="PT-BR"
              detail="GPT-4o-mini explica"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-card/50 border border-border/60 hover:border-primary/40 transition-all hover:-translate-y-0.5">
      <Icon className="h-5 w-5 text-primary" />
      <div className="text-center">
        <div className="text-xl sm:text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
          {detail}
        </div>
      </div>
    </div>
  );
}
