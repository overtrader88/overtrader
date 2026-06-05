/**
 * Menu de funcionalidades (cards de acesso rápido).
 *
 * Substitui o antigo "menu Vortex" — cards grandes coloridos que apontam para
 * as features principais do produto. As que ainda não estão implementadas
 * ficam visualmente com badge "Em breve" e clique desabilitado.
 *
 * Layout: grid responsivo 2→3→6 colunas.
 */
import Link from "next/link";
import {
  LineChart,
  History,
  Zap,
  Radio,
  Flame,
  Bot,
  Layers,
  Bell,
  TrendingUp,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type IconType = React.ComponentType<{ className?: string }>;

interface FeatureItem {
  title: string;
  description: string;
  href: string;
  icon: IconType;
  /** Cor primária do card (acent) */
  accent: "primary" | "accent" | "success" | "warning" | "destructive" | "muted";
  status: "live" | "soon" | "beta";
}

const FEATURES: FeatureItem[] = [
  {
    title: "Nova Análise",
    description: "20 indicadores + IA",
    href: "/dashboard/analise",
    icon: LineChart,
    accent: "primary",
    status: "live",
  },
  {
    title: "Histórico",
    description: "Análises anteriores",
    href: "/dashboard/historico",
    icon: History,
    accent: "success",
    status: "live",
  },
  {
    title: "Sinais IA",
    description: "Oportunidades em tempo real",
    href: "#",
    icon: Zap,
    accent: "accent",
    status: "soon",
  },
  {
    title: "Live Trading 24/7",
    description: "IA narrando o mercado",
    href: "#",
    icon: Radio,
    accent: "destructive",
    status: "soon",
  },
  {
    title: "Heatmap",
    description: "Melhores horários",
    href: "#",
    icon: Flame,
    accent: "warning",
    status: "soon",
  },
  {
    title: "Backtesting",
    description: "Testar estratégia",
    href: "#",
    icon: Layers,
    accent: "primary",
    status: "soon",
  },
  {
    title: "Copy Trading",
    description: "Replicar traders",
    href: "#",
    icon: Bot,
    accent: "accent",
    status: "soon",
  },
  {
    title: "Alertas",
    description: "Telegram + Push",
    href: "#",
    icon: Bell,
    accent: "success",
    status: "soon",
  },
];

const ACCENT_CLASSES: Record<
  FeatureItem["accent"],
  { bg: string; iconBg: string; iconColor: string; border: string }
> = {
  primary: {
    bg: "from-primary/10 via-card to-card",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    border: "border-primary/30 hover:border-primary",
  },
  accent: {
    bg: "from-accent/10 via-card to-card",
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
    border: "border-accent/30 hover:border-accent",
  },
  success: {
    bg: "from-success/10 via-card to-card",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    border: "border-success/30 hover:border-success",
  },
  warning: {
    bg: "from-warning/10 via-card to-card",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    border: "border-warning/30 hover:border-warning",
  },
  destructive: {
    bg: "from-destructive/10 via-card to-card",
    iconBg: "bg-destructive/15",
    iconColor: "text-destructive",
    border: "border-destructive/30 hover:border-destructive",
  },
  muted: {
    bg: "from-muted/40 via-card to-card",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    border: "border-border hover:border-border",
  },
};

export function FeatureMenu() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          O que você quer fazer?
        </h2>
        <Badge variant="ghost" className="text-[10px]">
          {FEATURES.filter((f) => f.status === "live").length} de {FEATURES.length} disponíveis
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} item={f} />
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ item }: { item: FeatureItem }) {
  const live = item.status === "live";
  const beta = item.status === "beta";
  const cls = live ? ACCENT_CLASSES[item.accent] : ACCENT_CLASSES.muted;

  const inner = (
    <Card
      className={cn(
        "h-full p-4 sm:p-5 bg-gradient-to-br transition-all",
        cls.bg,
        live
          ? `${cls.border} cursor-pointer hover:shadow-lg hover:-translate-y-0.5`
          : "border-border opacity-70"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "inline-grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-lg",
            cls.iconBg
          )}
        >
          <item.icon className={cn("h-5 w-5", cls.iconColor)} />
        </div>
        {live ? (
          beta ? (
            <Badge variant="accent" className="text-[10px]">
              Beta
            </Badge>
          ) : (
            <Badge
              variant="ghost"
              className="bg-success/10 text-success border-success/30 text-[10px]"
            >
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              Live
            </Badge>
          )
        ) : (
          <Badge variant="ghost" className="text-[10px] text-muted-foreground">
            Em breve
          </Badge>
        )}
      </div>
      <div className="space-y-0.5">
        <h3 className="font-semibold text-sm sm:text-base leading-tight">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {item.description}
        </p>
      </div>
    </Card>
  );

  if (!live) {
    return <div className="block min-h-0">{inner}</div>;
  }
  return (
    <Link href={item.href} className="block min-h-0" prefetch={false}>
      {inner}
    </Link>
  );
}
