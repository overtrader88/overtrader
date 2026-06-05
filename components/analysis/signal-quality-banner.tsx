/**
 * Banner de qualidade do sinal baseado em backtest persistido.
 *
 * Lógica de classificação (regra de bolso documentada na legenda):
 *   - verde   PF >= 1.5 e WR >= 50% e TP1 Touch >= 55%
 *   - amarelo PF 1.0-1.5 OU WR 40-50% OU TP1 Touch 40-55%
 *   - vermelho PF < 1.0 OU WR < 40% OU TP1 Touch < 40%
 *   - cinza   sem backtest ainda (CTA pra rodar)
 *
 * Sempre considera a MELHOR estrategia disponivel (PF mais alto).
 */
"use client";

import Link from "next/link";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Info,
  ArrowRight,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type BacktestStrategyKey =
  | "exit-tp1"
  | "move-to-breakeven"
  | "partial-exit";

interface BacktestLike {
  strategy?: BacktestStrategyKey;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  tp1TouchRate?: number;
}

type BacktestsMap = Partial<Record<BacktestStrategyKey, BacktestLike>>;

interface Props {
  backtests?: BacktestsMap | null;
  legacyBacktest?: BacktestLike | null;
  /** Mostra o CTA "Rodar backtest" quando ausente */
  ctaTargetTab?: string;
}

type Quality = "strong" | "moderate" | "weak" | "missing";

const STRATEGY_LABEL: Record<BacktestStrategyKey, string> = {
  "exit-tp1": "Sair em TP1",
  "move-to-breakeven": "Move-to-BE",
  "partial-exit": "Saida Parcial",
};

function classifyQuality(bt: BacktestLike): Quality {
  const pf = bt.profitFactor;
  const wr = bt.winRate;
  const touch = bt.tp1TouchRate ?? 0;

  if (pf >= 1.5 && wr >= 0.5 && touch >= 0.55) return "strong";
  if (pf < 1.0 || wr < 0.4 || touch < 0.4) return "weak";
  return "moderate";
}

function bestBacktest(
  backtests: BacktestsMap | null | undefined,
  legacy: BacktestLike | null | undefined
): { bt: BacktestLike; strategy: BacktestStrategyKey } | null {
  const candidates: Array<{ bt: BacktestLike; strategy: BacktestStrategyKey }> =
    [];

  if (backtests) {
    for (const [s, bt] of Object.entries(backtests)) {
      if (bt) {
        candidates.push({ bt, strategy: s as BacktestStrategyKey });
      }
    }
  }
  if (legacy && candidates.length === 0) {
    candidates.push({
      bt: legacy,
      strategy: legacy.strategy ?? "exit-tp1",
    });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) =>
    cur.bt.profitFactor > best.bt.profitFactor ? cur : best
  );
}

export function SignalQualityBanner({
  backtests,
  legacyBacktest,
  ctaTargetTab = "backtest",
}: Props) {
  const best = bestBacktest(backtests, legacyBacktest);
  const quality: Quality = best ? classifyQuality(best.bt) : "missing";

  if (quality === "missing") {
    return (
      <Card className="p-4 bg-muted/10 border-border/40">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">
              Validacao historica nao executada
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Antes de operar este sinal, rode um backtest gratis (sem creditos)
              pra ver se esse padrao tem edge historico.
            </p>
          </div>
          <Link
            href={`#${ctaTargetTab}`}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline min-h-[44px] px-2"
          >
            Ir pro backtest <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    );
  }

  const config = QUALITY_CONFIG[quality];
  const Icon = config.icon;
  const bt = best!.bt;
  const strategyLabel = STRATEGY_LABEL[best!.strategy];

  return (
    <Card
      className={cn(
        "p-4 border-2",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full shrink-0",
            config.iconBg
          )}
        >
          <Icon className={cn("h-4 w-4", config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className={cn("font-bold text-sm", config.titleColor)}>
              {config.title}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Backtest · {bt.totalTrades} trades
            </span>
          </div>
          <p className="text-xs text-foreground/85 mt-1 leading-relaxed">
            {config.message}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <Stat label="PF" value={
              bt.profitFactor >= 99 ? "∞" : bt.profitFactor.toFixed(2)
            } highlighted />
            <Stat label="Win Rate" value={`${(bt.winRate * 100).toFixed(0)}%`} />
            {bt.tp1TouchRate !== undefined && (
              <Stat
                label="TP1 Touched"
                value={`${(bt.tp1TouchRate * 100).toFixed(0)}%`}
              />
            )}
            <Stat label="Estrategia" value={strategyLabel} />
          </div>
          {config.recommendation && (
            <div className="mt-2 pt-2 border-t border-border/30 text-[11px] text-foreground/80">
              <strong>Recomendacao:</strong> {config.recommendation}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  highlighted,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-muted-foreground uppercase tracking-wider text-[9px]">
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          highlighted ? "font-bold" : "font-medium"
        )}
      >
        {value}
      </span>
    </span>
  );
}

// ============================================================
// Tabela de configuracao por qualidade
// ============================================================

const QUALITY_CONFIG: Record<
  Exclude<Quality, "missing">,
  {
    title: string;
    message: string;
    recommendation: string;
    icon: typeof Shield;
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    titleColor: string;
  }
> = {
  strong: {
    title: "Padrao validado historicamente",
    message:
      "Este sinal tem edge solido no backtest. Pode ser operado dentro do seu plano de gestao de risco.",
    recommendation:
      "Posicao normal. Respeite o stop loss e considere realizar parcialmente em TP1.",
    icon: TrendingUp,
    bg: "bg-success/5",
    border: "border-success/40",
    iconBg: "bg-success/15",
    iconColor: "text-success",
    titleColor: "text-success",
  },
  moderate: {
    title: "Edge marginal — opere com cautela",
    message:
      "O padrao tem rendimento positivo no historico, mas modesto. Custos reais (spread/slippage) podem zerar o ganho.",
    recommendation:
      "Posicao reduzida (ex: 50% do tamanho normal). Aguarde confluencia maior se quiser entrar.",
    icon: AlertTriangle,
    bg: "bg-warning/5",
    border: "border-warning/40",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    titleColor: "text-warning",
  },
  weak: {
    title: "Padrao sem edge historico — nao recomendado",
    message:
      "Nas ultimas centenas de candles, esse padrao perdeu dinheiro. Operar contra dados estatisticos exige razao muito forte.",
    recommendation:
      "Evite operar. Procure o mesmo ativo em timeframe diferente, ou outro ativo com PF > 1.3.",
    icon: XCircle,
    bg: "bg-destructive/5",
    border: "border-destructive/40",
    iconBg: "bg-destructive/15",
    iconColor: "text-destructive",
    titleColor: "text-destructive",
  },
};
