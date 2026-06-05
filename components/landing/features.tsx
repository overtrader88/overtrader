import {
  LineChart,
  ShieldCheck,
  Layers3,
  Activity,
  Brain,
  Sparkles,
  Compass,
  Hexagon,
  CalendarDays,
  Newspaper,
  BarChart3,
  Bell,
} from "lucide-react";

const FEATURES = [
  {
    icon: LineChart,
    title: "20 indicadores técnicos",
    description:
      "RSI, MACD, EMAs, Bollinger, ADX, ATR, Stochastic, CCI, Williams %R, MFI, OBV, CMF e mais — todos votando ponderado.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: ShieldCheck,
    title: "8 filtros adaptativos",
    description:
      "Gates de qualidade que se ajustam ao regime de mercado (tendência, lateral, explosivo). Sinal só passa quando faz sentido.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: Brain,
    title: "Smart Money Concepts",
    description:
      "Order Blocks, Fair Value Gaps, Liquidity Zones, BOS/CHoCH. Algoritmos auditáveis — você vê o código se quiser.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Layers3,
    title: "Confluência Multi-TF",
    description:
      "Alinhamento entre 1h, 4h e D1 com score 0-100. Sinal 'perfeito' só vale se TFs maiores concordam.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Activity,
    title: "Monte Carlo (5.000 sim)",
    description:
      "Cenários otimista, mediana e pessimista calculados via Geometric Brownian Motion. Win rate por direção.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Hexagon,
    title: "Padrões Harmônicos",
    description:
      "Bat, Butterfly, Gartley, Crab, Cypher, Shark — com PRZ (zona de reversão) e completion % em tempo real.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: Compass,
    title: "WEGD clássica",
    description:
      "Wyckoff, Elliott Waves, Gann angles e Dow Theory. Mostramos probabilidade — não afirmamos.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: CalendarDays,
    title: "Sazonalidade histórica",
    description:
      "Heatmap dos 12 meses + win rate por período. Sabe se 'Uptober' é real pro ativo escolhido.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Newspaper,
    title: "Notícias + sentimento IA",
    description:
      "CryptoPanic + NewsAPI agregados. GPT-4o-mini lê tudo e resume o contexto macro em 3 frases.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: BarChart3,
    title: "Backtest público (3 estratégias)",
    description:
      "Sair em TP1 · Move-to-BE · Saída parcial. Você vê o histórico do padrão antes de operar.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Sparkles,
    title: "IA narrativa em PT-BR",
    description:
      "GPT-4o-mini escreve uma análise como um analista profissional. Sem hype, sem promessa, só dado.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Bell,
    title: "Alertas em tempo real",
    description:
      "Watchlist + bot Telegram. Você é avisado quando um sinal forte aparece no ativo monitorado.",
    color: "text-success",
    bg: "bg-success/10",
  },
];

export function Features() {
  return (
    <section className="container-fluid py-16 sm:py-24 relative">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
          <Sparkles className="h-3 w-3" />
          12 análises por clique
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Cada análise é{" "}
          <span className="text-primary">12 análises</span> sobrepostas
        </h2>
        <p className="mt-3 text-muted-foreground">
          O que outras plataformas vendem como "premium" exclusivo, a gente
          entrega tudo numa única consulta.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-xl border border-border/40 bg-card/40 p-5 hover:border-primary/40 hover:bg-card transition-all hover:-translate-y-1"
          >
            <div
              className={`grid h-10 w-10 place-items-center rounded-lg ${f.bg} mb-3 group-hover:scale-110 transition-transform`}
            >
              <f.icon className={`h-5 w-5 ${f.color}`} />
            </div>
            <h3 className="text-base font-bold mb-1.5">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
