import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WaitlistSection() {
  return (
    <section
      id="waitlist"
      className="container-fluid py-20 sm:py-28 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium mb-6">
          <Sparkles className="h-3 w-3" />
          Trial vitalício · Sem cartão · Acesso imediato
        </div>

        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          Comece agora.{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            3 análises grátis
          </span>{" "}
          esperando.
        </h2>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          Veja a IA narrar uma análise real, o Smart Money detectar os Order
          Blocks, o Monte Carlo projetar 5.000 cenários, e o backtest mostrar
          se vale operar. Tudo em uma única consulta.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <Button size="xl" asChild className="w-full sm:w-auto">
            <Link href="/cadastro">
              Criar conta grátis
              <ArrowRight className="ml-1" />
            </Link>
          </Button>
          <Button size="xl" variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/planos">Ver planos</Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-success" /> Análise em &lt; 5s
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Sem cartão
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-success" /> Cancele quando quiser
          </span>
        </div>
      </div>
    </section>
  );
}
