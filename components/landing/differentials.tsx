import { Check, X, Sparkles } from "lucide-react";

const ROWS: Array<{
  feature: string;
  us: string;
  them: string;
  usPositive: boolean;
}> = [
  {
    feature: "Dashboard de preços ao vivo (5 mercados)",
    us: "Sim, em todas as telas",
    them: "Não tem",
    usPositive: true,
  },
  {
    feature: "Backtest público antes de operar",
    us: "Sim — 3 estratégias comparadas",
    them: "Não disponível",
    usPositive: true,
  },
  {
    feature: "IA narrativa explicando cada sinal",
    us: "GPT-4o-mini em português",
    them: "Texto genérico",
    usPositive: true,
  },
  {
    feature: "Smart Money Concepts (Order Blocks, FVG)",
    us: "Algoritmos abertos e auditáveis",
    them: "Caixa-preta",
    usPositive: true,
  },
  {
    feature: "Análise Multi-Timeframe",
    us: "Confluência 3 TFs com score",
    them: "Manual pelo usuário",
    usPositive: true,
  },
  {
    feature: "Monte Carlo (cenários probabilísticos)",
    us: "5.000 simulações por análise",
    them: "Tem (15k mas sem backtest)",
    usPositive: true,
  },
  {
    feature: "Padrões Harmônicos (Bat, Butterfly, etc)",
    us: "Sim, com PRZ e completion %",
    them: "Sim",
    usPositive: true,
  },
  {
    feature: "Wyckoff / Elliott / Gann / Dow Theory",
    us: "Sim, com probabilidade",
    them: "Sim, com afirmação",
    usPositive: true,
  },
  {
    feature: "Notícias macro + sentimento (IA)",
    us: "CryptoPanic + NewsAPI + IA",
    them: "Sim, sem fonte clara",
    usPositive: true,
  },
  {
    feature: "Sazonalidade histórica",
    us: "Heatmap 12 meses",
    them: "Sim",
    usPositive: true,
  },
  {
    feature: "7 níveis graduados de sinal",
    us: "Compra Forte → Venda Forte",
    them: "3 níveis básicos",
    usPositive: true,
  },
  {
    feature: "Banner de qualidade automático",
    us: "Verde/Amarelo/Vermelho",
    them: "Não tem",
    usPositive: true,
  },
  {
    feature: "Trial vitalício sem cartão",
    us: "3 análises completas grátis",
    them: "Apenas trial pago",
    usPositive: true,
  },
];

export function Differentials() {
  return (
    <section
      id="diferenciais"
      className="container-fluid py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            Comparativo direto
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Por que somos diferentes
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            13 features que provam o porquê de você nos escolher em vez do
            concorrente caixa-preta.
          </p>
        </div>

        {/* Header — desktop */}
        <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr] gap-4 mb-3 px-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          <div>Feature</div>
          <div className="text-center text-primary">Nosso sistema</div>
          <div className="text-center">Concorrente líder</div>
        </div>

        <div className="space-y-2">
          {ROWS.map((r) => (
            <div
              key={r.feature}
              className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr] gap-2 sm:gap-4 p-4 rounded-lg border border-border/40 bg-card/40 hover:border-primary/40 transition-colors"
            >
              <div className="font-medium text-sm">{r.feature}</div>
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-success shrink-0" />
                <span className="text-foreground/90">{r.us}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <X className="h-4 w-4 text-destructive/70 shrink-0" />
                <span className="text-muted-foreground">{r.them}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground italic mt-6">
          Comparativo elaborado em maio/2026 a partir do material público dos
          concorrentes. Atualizado conforme cada plataforma evolui.
        </p>
      </div>
    </section>
  );
}
