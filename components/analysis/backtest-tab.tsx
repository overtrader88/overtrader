"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  ChevronDown,
  ChevronUp,
  Shield,
  Target,
  Scissors,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type BacktestStrategyKey =
  | "exit-tp1"
  | "move-to-breakeven"
  | "partial-exit";

interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  side: "buy" | "sell";
  signal: string;
  outcome: "TP1" | "TP2" | "TP3" | "BE" | "SL" | "EXPIRED";
  tp1Touched?: boolean;
  durationCandles: number;
  pnlR: number;
}

interface BacktestSummary {
  strategy?: BacktestStrategyKey;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  maxDrawdownR: number;
  outcomes: {
    TP1: number;
    TP2: number;
    TP3: number;
    BE?: number;
    SL: number;
    EXPIRED: number;
  };
  tp1TouchRate?: number;
  trades: BacktestTrade[];
  candlesAnalyzed: number;
  durationMs: number;
  generatedAt?: string;
}

type BacktestsMap = Partial<Record<BacktestStrategyKey, BacktestSummary>>;

interface Props {
  analysisId: string;
  /** Legado: payload.backtest singular (ultimo executado) */
  existingBacktest?: BacktestSummary | null;
  /** Novo: payload.backtests mapeando estrategia -> resultado */
  existingBacktests?: BacktestsMap | null;
}

const STRATEGY_META: Record<
  BacktestStrategyKey,
  {
    label: string;
    short: string;
    icon: typeof Target;
    description: string;
    bestFor: string;
  }
> = {
  "exit-tp1": {
    label: "Sair em TP1",
    short: "TP1",
    icon: Target,
    description:
      "Fecha posicao inteira ao tocar TP1 (+1.5R). Estrategia classica, simples e robusta.",
    bestFor: "Mercados mean-reverting, scalping, sinais de alta frequencia",
  },
  "move-to-breakeven": {
    label: "Move-to-BE",
    short: "BE",
    icon: Shield,
    description:
      "Apos TP1, move stop pra entrada (breakeven) e busca TP2/TP3. Cria \"free trade\".",
    bestFor: "Tendencias fortes, swing trade, mercados direcionais",
  },
  "partial-exit": {
    label: "Saida Parcial",
    short: "Parcial",
    icon: Scissors,
    description:
      "Fecha 50% em TP1 (+0.75R locked), trail o resto com stop em BE. Compromisso entre as duas.",
    bestFor: "Sinais incertos, gestao de risco conservadora, traders iniciantes",
  },
};

export function BacktestTab({
  analysisId,
  existingBacktest,
  existingBacktests,
}: Props) {
  // Merge dos backtests existentes (mapa novo + legado pra retrocompat)
  const initialMap = useMemo<BacktestsMap>(() => {
    const map: BacktestsMap = { ...(existingBacktests ?? {}) };
    if (existingBacktest && !map[existingBacktest.strategy ?? "exit-tp1"]) {
      map[existingBacktest.strategy ?? "exit-tp1"] = existingBacktest;
    }
    return map;
  }, [existingBacktest, existingBacktests]);

  const [backtests, setBacktests] = useState<BacktestsMap>(initialMap);
  const [activeStrategy, setActiveStrategy] = useState<BacktestStrategyKey>(
    () => {
      // Estrategia ativa: primeira que tem dados, ou exit-tp1 como default
      const order: BacktestStrategyKey[] = [
        "exit-tp1",
        "move-to-breakeven",
        "partial-exit",
      ];
      return order.find((s) => initialMap[s]) ?? "exit-tp1";
    }
  );
  const [running, setRunning] = useState<BacktestStrategyKey | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const current = backtests[activeStrategy] ?? null;
  const hasAnyData = Object.values(backtests).some(Boolean);

  async function runBacktest(strategy: BacktestStrategyKey) {
    setRunning(strategy);
    try {
      const res = await fetch(`/api/analyze/${analysisId}/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        toast.error("Falha no backtest.", {
          description: data?.error ?? "Erro desconhecido.",
        });
        return;
      }
      setBacktests((prev) => ({ ...prev, [strategy]: data.backtest }));
      setActiveStrategy(strategy);
      toast.success(
        data.cached
          ? `Cache (${STRATEGY_META[strategy].label})`
          : `${STRATEGY_META[strategy].label}: backtest concluido!`
      );
    } catch (err) {
      toast.error("Erro inesperado.", {
        description:
          err instanceof Error ? err.message : "Verifique a conexao.",
      });
    } finally {
      setRunning(null);
    }
  }

  // Empty state — nada simulado ainda
  if (!hasAnyData) {
    return (
      <div className="space-y-4">
        <Card className="p-6 sm:p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h3 className="text-base sm:text-lg font-semibold mb-2">
            Quao confiavel foi este padrao historicamente?
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Rode um <b>backtest walk-forward</b> sobre os ultimos candles. Compare
            ate 3 estrategias de saida diferentes pra escolher a melhor pra esse
            sinal.
            <span className="block text-xs mt-2 italic">
              Gratis — sem custo de credito. Cada estrategia leva 5-15s.
            </span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {(Object.keys(STRATEGY_META) as BacktestStrategyKey[]).map((s) => {
              const meta = STRATEGY_META[s];
              const Icon = meta.icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => runBacktest(s)}
                  disabled={running !== null}
                  className={cn(
                    "rounded-lg border border-border/40 bg-card/50 hover:bg-card hover:border-primary/40 transition-all p-4 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {meta.description}
                  </p>
                  <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-center text-[11px] text-primary">
                    {running === s ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />{" "}
                        Simulando...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" /> Rodar este
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            className="mt-4 text-xs text-primary hover:underline"
          >
            Como interpretar as metricas?
          </button>
        </Card>

        {legendOpen && <BacktestLegend onClose={() => setLegendOpen(false)} />}
      </div>
    );
  }

  // Modo comparacao
  if (compareMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base sm:text-lg font-semibold">
            Comparativo de estrategias
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompareMode(false)}
            className="min-h-[44px] sm:min-h-0"
          >
            Voltar pra visao individual
          </Button>
        </div>
        <ComparisonTable
          backtests={backtests}
          onRun={runBacktest}
          running={running}
        />
        <BacktestLegend collapsible defaultOpen={false} />
      </div>
    );
  }

  // Visao individual da estrategia ativa
  return (
    <div className="space-y-4">
      {/* Selector de estrategia */}
      <StrategySelector
        active={activeStrategy}
        backtests={backtests}
        running={running}
        onSelect={setActiveStrategy}
        onRun={runBacktest}
        onCompare={() => setCompareMode(true)}
      />

      {current ? (
        <CurrentBacktestView
          backtest={current}
          strategy={activeStrategy}
          running={running === activeStrategy}
          onReRun={() => runBacktest(activeStrategy)}
        />
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Esta estrategia ainda nao foi simulada.
          </p>
          <Button
            onClick={() => runBacktest(activeStrategy)}
            disabled={running !== null}
            className="min-h-[44px]"
          >
            {running === activeStrategy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Simulando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Rodar {STRATEGY_META[activeStrategy].label}
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Toggle legenda */}
      <button
        type="button"
        onClick={() => setLegendOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-border/40 bg-card/50 hover:bg-card transition-colors text-sm"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-medium">
            Como interpretar essas metricas
          </span>
        </span>
        {legendOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {legendOpen && <BacktestLegend />}
    </div>
  );
}

// ============================================================
// Strategy selector
// ============================================================

function StrategySelector({
  active,
  backtests,
  running,
  onSelect,
  onRun,
  onCompare,
}: {
  active: BacktestStrategyKey;
  backtests: BacktestsMap;
  running: BacktestStrategyKey | null;
  onSelect: (s: BacktestStrategyKey) => void;
  onRun: (s: BacktestStrategyKey) => void;
  onCompare: () => void;
}) {
  const haveCount = Object.values(backtests).filter(Boolean).length;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Estrategia de saida
        </span>
        {haveCount >= 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCompare}
            className="text-[11px] h-8"
          >
            <BarChart3 className="h-3 w-3" /> Comparar {haveCount} estrategias
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(Object.keys(STRATEGY_META) as BacktestStrategyKey[]).map((s) => {
          const meta = STRATEGY_META[s];
          const Icon = meta.icon;
          const bt = backtests[s];
          const isActive = s === active;
          const isRunning = running === s;
          return (
            <div
              key={s}
              className={cn(
                "rounded-lg border transition-all overflow-hidden",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border/40 bg-card/30"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(s)}
                className="w-full text-left p-3 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-primary" : ""
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  {bt && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] h-4 px-1 tabular-nums",
                        bt.profitFactor > 1.3
                          ? "text-success border-success/30"
                          : bt.profitFactor > 1
                            ? "text-warning border-warning/30"
                            : "text-destructive border-destructive/30"
                      )}
                    >
                      PF {bt.profitFactor >= 99 ? "∞" : bt.profitFactor.toFixed(2)}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                  {meta.description}
                </p>
              </button>
              {!bt && (
                <button
                  type="button"
                  onClick={() => onRun(s)}
                  disabled={running !== null}
                  className="w-full px-3 py-1.5 border-t border-border/30 text-[11px] text-primary hover:bg-primary/5 transition-colors min-h-[36px] flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Simulando...
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" /> Rodar
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ============================================================
// View de uma estrategia ativa
// ============================================================

function CurrentBacktestView({
  backtest,
  strategy,
  running,
  onReRun,
}: {
  backtest: BacktestSummary;
  strategy: BacktestStrategyKey;
  running: boolean;
  onReRun: () => void;
}) {
  const meta = STRATEGY_META[strategy];
  const StrategyIcon = meta.icon;

  const beCount = backtest.outcomes.BE ?? 0;
  const totalDecisive =
    backtest.outcomes.TP1 +
    backtest.outcomes.TP2 +
    backtest.outcomes.TP3 +
    backtest.outcomes.SL;
  const tp1TouchPct = (backtest.tp1TouchRate ?? 0) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StrategyIcon className="h-4 w-4 text-primary" />
            <h3 className="text-base sm:text-lg font-semibold">
              {meta.label}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {backtest.totalTrades} trades simulados em {backtest.candlesAnalyzed}{" "}
            candles
            {backtest.generatedAt && (
              <span className="ml-2">
                · {new Date(backtest.generatedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReRun}
          disabled={running}
          className="min-h-[44px] sm:min-h-0"
        >
          {running ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Rodando...
            </>
          ) : (
            <>
              <Play className="h-3 w-3" /> Re-rodar
            </>
          )}
        </Button>
      </div>

      {/* Stats principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Win Rate"
          value={`${(backtest.winRate * 100).toFixed(1)}%`}
          subtitle={`${
            backtest.outcomes.TP1 +
            backtest.outcomes.TP2 +
            backtest.outcomes.TP3
          } / ${totalDecisive}`}
          color={
            backtest.winRate > 0.5
              ? "text-success"
              : backtest.winRate > 0.3
                ? "text-warning"
                : "text-destructive"
          }
          icon={CheckCircle2}
        />
        <StatCard
          label="Profit Factor"
          value={
            backtest.profitFactor >= 99
              ? "∞"
              : backtest.profitFactor.toFixed(2)
          }
          subtitle={
            backtest.profitFactor > 1.5
              ? "Excelente"
              : backtest.profitFactor > 1
                ? "Positivo"
                : "Negativo"
          }
          color={
            backtest.profitFactor > 1.5
              ? "text-success"
              : backtest.profitFactor > 1
                ? "text-warning"
                : "text-destructive"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Avg R"
          value={`${backtest.avgR > 0 ? "+" : ""}${backtest.avgR.toFixed(2)}R`}
          subtitle="por trade"
          color={
            backtest.avgR > 0.5
              ? "text-success"
              : backtest.avgR > 0
                ? "text-warning"
                : "text-destructive"
          }
          icon={backtest.avgR > 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Max Drawdown"
          value={`-${backtest.maxDrawdownR.toFixed(2)}R`}
          subtitle="sequencia ruim"
          color="text-muted-foreground"
          icon={TrendingDown}
        />
      </div>

      {/* Distribuicao */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold">Como os trades terminaram</h4>
          {backtest.tp1TouchRate !== undefined && (
            <span className="text-[11px] text-muted-foreground">
              TP1 foi tocado em{" "}
              <strong className="text-primary tabular-nums">
                {tp1TouchPct.toFixed(0)}%
              </strong>{" "}
              dos trades
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <OutcomeBar
            label="TP1"
            value={backtest.outcomes.TP1}
            total={backtest.totalTrades}
            color="bg-success/30"
            textColor="text-success"
            tooltip="Saiu no TP1 e fechou"
          />
          <OutcomeBar
            label="TP2"
            value={backtest.outcomes.TP2}
            total={backtest.totalTrades}
            color="bg-success/50"
            textColor="text-success"
            tooltip="Continuou ate TP2"
          />
          <OutcomeBar
            label="TP3"
            value={backtest.outcomes.TP3}
            total={backtest.totalTrades}
            color="bg-success/70"
            textColor="text-success"
            tooltip="Extensao forte ate TP3"
          />
          <OutcomeBar
            label="BE"
            value={beCount}
            total={backtest.totalTrades}
            color="bg-primary/30"
            textColor="text-primary"
            tooltip="Tocou TP1 e voltou. Saida em breakeven"
          />
          <OutcomeBar
            label="Stop"
            value={backtest.outcomes.SL}
            total={backtest.totalTrades}
            color="bg-destructive/50"
            textColor="text-destructive"
            tooltip="Stop original disparou antes de TP1"
          />
          <OutcomeBar
            label="Expirou"
            value={backtest.outcomes.EXPIRED}
            total={backtest.totalTrades}
            color="bg-muted/50"
            textColor="text-muted-foreground"
            tooltip="50 candles sem desfecho"
          />
        </div>
      </Card>

      {/* Tabela de trades */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40">
          <h4 className="text-sm font-semibold">
            Ultimos {Math.min(20, backtest.trades.length)} trades
          </h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b border-border/40">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                  Lado
                </th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                  Sinal
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                  Entrada
                </th>
                <th className="px-3 py-2 text-center text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                  Resultado
                </th>
                <th className="px-3 py-2 text-right text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                  R
                </th>
              </tr>
            </thead>
            <tbody>
              {backtest.trades
                .slice(-20)
                .reverse()
                .map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-border/20 last:border-0"
                  >
                    <td className="px-3 py-2">
                      {t.side === "buy" ? (
                        <Badge variant="success" className="text-[10px]">
                          ↑ COMPRA
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          ↓ VENDA
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {t.signal}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                      {t.entryPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.outcome === "SL" ? (
                        <span className="inline-flex items-center gap-1 text-destructive text-xs">
                          <XCircle className="h-3 w-3" /> Stop
                        </span>
                      ) : t.outcome === "EXPIRED" ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock className="h-3 w-3" /> Expirou
                        </span>
                      ) : t.outcome === "BE" ? (
                        <span className="inline-flex items-center gap-1 text-primary text-xs">
                          <Shield className="h-3 w-3" /> BE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success text-xs">
                          <CheckCircle2 className="h-3 w-3" /> {t.outcome}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono tabular-nums text-xs",
                        t.pnlR > 0
                          ? "text-success"
                          : t.pnlR < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {t.pnlR > 0 ? "+" : ""}
                      {t.pnlR.toFixed(2)}R
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Disclaimer */}
      <Card className="p-4 bg-warning/5 border-warning/30">
        <div className="flex items-start gap-3 text-xs text-muted-foreground">
          <span className="text-warning text-base leading-none">⚠</span>
          <div>
            <strong className="text-foreground">Limitacoes conhecidas:</strong>{" "}
            backtest walk-forward (sem custos de spread/slippage). Resultados
            passados nao garantem performance futura. Use como{" "}
            <em>baseline de confianca</em>, nao como prova de lucro.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Tabela comparativa das 3 estrategias
// ============================================================

function ComparisonTable({
  backtests,
  onRun,
  running,
}: {
  backtests: BacktestsMap;
  onRun: (s: BacktestStrategyKey) => void;
  running: BacktestStrategyKey | null;
}) {
  const strategies = Object.keys(STRATEGY_META) as BacktestStrategyKey[];

  // Identifica vencedor por metrica
  const getBest = (
    metricFn: (b: BacktestSummary) => number,
    higher = true
  ): BacktestStrategyKey | null => {
    let best: BacktestStrategyKey | null = null;
    let bestVal = higher ? -Infinity : Infinity;
    for (const s of strategies) {
      const b = backtests[s];
      if (!b) continue;
      const v = metricFn(b);
      if (higher ? v > bestVal : v < bestVal) {
        bestVal = v;
        best = s;
      }
    }
    return best;
  };

  const bestPF = getBest((b) => b.profitFactor);
  const bestWR = getBest((b) => b.winRate);
  const bestAvgR = getBest((b) => b.avgR);
  const bestDD = getBest((b) => b.maxDrawdownR, false);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/40 bg-card/50">
            <tr>
              <th className="px-3 py-3 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Metrica
              </th>
              {strategies.map((s) => (
                <th
                  key={s}
                  className="px-3 py-3 text-center text-[10px] uppercase tracking-wider font-semibold"
                >
                  <div className="flex items-center justify-center gap-1">
                    {(() => {
                      const Icon = STRATEGY_META[s].icon;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {STRATEGY_META[s].short}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs">
            <ComparisonRow
              label="Trades"
              strategies={strategies}
              backtests={backtests}
              format={(b) => String(b.totalTrades)}
            />
            <ComparisonRow
              label="Win Rate"
              strategies={strategies}
              backtests={backtests}
              best={bestWR}
              format={(b) => `${(b.winRate * 100).toFixed(1)}%`}
            />
            <ComparisonRow
              label="Profit Factor"
              strategies={strategies}
              backtests={backtests}
              best={bestPF}
              format={(b) =>
                b.profitFactor >= 99 ? "∞" : b.profitFactor.toFixed(2)
              }
            />
            <ComparisonRow
              label="Avg R / trade"
              strategies={strategies}
              backtests={backtests}
              best={bestAvgR}
              format={(b) =>
                `${b.avgR > 0 ? "+" : ""}${b.avgR.toFixed(2)}R`
              }
            />
            <ComparisonRow
              label="Max Drawdown"
              strategies={strategies}
              backtests={backtests}
              best={bestDD}
              format={(b) => `-${b.maxDrawdownR.toFixed(2)}R`}
            />
            <ComparisonRow
              label="TP1 Touched"
              strategies={strategies}
              backtests={backtests}
              format={(b) =>
                b.tp1TouchRate !== undefined
                  ? `${(b.tp1TouchRate * 100).toFixed(0)}%`
                  : "—"
              }
            />
            <tr className="border-b border-border/20">
              <td className="px-3 py-2 font-medium text-muted-foreground">
                Acoes
              </td>
              {strategies.map((s) => (
                <td key={s} className="px-3 py-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRun(s)}
                    disabled={running !== null}
                    className="text-[10px] h-7 px-2"
                  >
                    {running === s ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : backtests[s] ? (
                      <>
                        <Play className="h-3 w-3" /> Re-rodar
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" /> Rodar
                      </>
                    )}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ComparisonRow({
  label,
  strategies,
  backtests,
  best,
  format,
}: {
  label: string;
  strategies: BacktestStrategyKey[];
  backtests: BacktestsMap;
  best?: BacktestStrategyKey | null;
  format: (b: BacktestSummary) => string;
}) {
  return (
    <tr className="border-b border-border/20">
      <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </td>
      {strategies.map((s) => {
        const b = backtests[s];
        const isBest = best === s;
        return (
          <td
            key={s}
            className={cn(
              "px-3 py-2 text-center font-mono tabular-nums",
              !b && "text-muted-foreground/40",
              isBest && "text-success font-bold"
            )}
          >
            {b ? format(b) : "—"}
            {isBest && b && (
              <span className="ml-1 text-[10px]" title="Melhor nessa metrica">
                ★
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ============================================================
// Subcomponentes existentes
// ============================================================

function StatCard({
  label,
  value,
  subtitle,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-3 w-3", color)} />
      </div>
      <div className={cn("text-xl sm:text-2xl font-bold tabular-nums", color)}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{subtitle}</div>
    </Card>
  );
}

function OutcomeBar({
  label,
  value,
  total,
  color,
  textColor,
  tooltip,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  textColor: string;
  tooltip?: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="text-center" title={tooltip}>
      <div className="h-20 sm:h-24 relative bg-card/50 rounded overflow-hidden flex items-end">
        <div
          className={cn("w-full transition-all", color)}
          style={{ height: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <div className={cn("mt-2 text-base sm:text-lg font-bold", textColor)}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</div>
    </div>
  );
}

// ============================================================
// Legenda explicativa
// ============================================================

function BacktestLegend({
  onClose,
  collapsible,
  defaultOpen = true,
}: {
  onClose?: () => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-border/40 bg-card/50 hover:bg-card transition-colors text-sm"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="font-medium">Como interpretar essas metricas</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }
  return (
    <Card className="p-5 bg-card/40 border-border/60 relative">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Fechar legenda"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
      <div className="space-y-5">
        <section>
          <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Metricas principais
          </h5>
          <LegendTable
            rows={[
              {
                metric: "Win Rate",
                description:
                  "% de trades que terminaram com lucro (TP1, TP2 ou TP3) sobre os trades decisivos (excluindo BE e expirados).",
                good: ">= 50%",
                ok: "30 a 50%",
                bad: "< 30%",
              },
              {
                metric: "Profit Factor",
                description:
                  "Soma dos lucros / soma das perdas. Acima de 1.0 = lucrativo. Custos reais derrubam 0.1-0.2.",
                good: ">= 1.5",
                ok: "1.0 a 1.5",
                bad: "< 1.0",
              },
              {
                metric: "Avg R",
                description:
                  "Resultado medio por trade em multiplos do risco. +1R = cada trade lucra em media o tamanho do risco.",
                good: ">= +0.5R",
                ok: "0 a +0.5R",
                bad: "< 0R",
              },
              {
                metric: "Max Drawdown",
                description:
                  "Maior sequencia de perdas em R. Se arriscar 1% por trade, 10R = 10% de perda da banca.",
                good: "< 5R",
                ok: "5 a 12R",
                bad: "> 12R",
              },
              {
                metric: "TP1 Touched",
                description:
                  "% de trades em que o preco encostou em TP1 (mesmo voltando). Mede o quao frequente o sinal entra na direcao certa.",
                good: ">= 60%",
                ok: "40 a 60%",
                bad: "< 40%",
              },
            ]}
          />
        </section>

        <section>
          <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Tipos de saida
          </h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <LegendRow
              tag="TP1"
              tagColor="bg-success/20 text-success border-success/40"
              text="Preco atingiu TP1 e fechou ai. Resultado: +1.5R (estrategia exit-tp1) ou +0.75R (parcial)."
            />
            <LegendRow
              tag="TP2"
              tagColor="bg-success/30 text-success border-success/40"
              text="Continuou ate TP2. Resultado: +2.5R (BE) ou +2.0R (parcial)."
            />
            <LegendRow
              tag="TP3"
              tagColor="bg-success/40 text-success border-success/40"
              text="Extensao forte ate TP3. Resultado: +3.5R (BE) ou +2.5R (parcial)."
            />
            <LegendRow
              tag="BE"
              tagColor="bg-primary/20 text-primary border-primary/40"
              text="Encostou em TP1 mas reverteu. Resultado: 0R (move-to-BE) ou +0.75R (parcial, metade ja lockada)."
            />
            <LegendRow
              tag="Stop"
              tagColor="bg-destructive/20 text-destructive border-destructive/40"
              text="Stop loss original disparou antes de TP1. Perda de 1R em qualquer estrategia."
            />
            <LegendRow
              tag="Expirou"
              tagColor="bg-muted/30 text-muted-foreground border-muted/40"
              text="50 candles passaram sem desfecho. Trade fechou no close do ultimo."
            />
          </div>
        </section>

        <section className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-foreground/90 leading-relaxed">
            <strong className="text-primary">Regra de bolso:</strong> sinal e
            confiavel quando <strong>PF &gt;= 1.3</strong>,{" "}
            <strong>Win Rate &gt;= 45%</strong> e{" "}
            <strong>TP1 Touched &gt;= 55%</strong> em pelo menos uma estrategia.
            Compare as 3 — se nenhuma fica positiva, esse padrao nao tem edge
            historico nesse ativo/timeframe.
          </p>
        </section>

        <section>
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            O backtest e walk-forward (sem lookahead bias), mas nao considera
            spread/slippage. Use como baseline, nao como prova de lucro.
          </p>
        </section>
      </div>
    </Card>
  );
}

function LegendTable({
  rows,
}: {
  rows: Array<{
    metric: string;
    description: string;
    good: string;
    ok: string;
    bad: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/40">
            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Metrica
            </th>
            <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:table-cell">
              O que e
            </th>
            <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-success font-semibold">
              Bom
            </th>
            <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-warning font-semibold">
              Ok
            </th>
            <th className="px-2 py-2 text-center text-[10px] uppercase tracking-wider text-destructive font-semibold">
              Ruim
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.metric}
              className="border-b border-border/20 last:border-0 align-top"
            >
              <td className="px-2 py-2 font-semibold whitespace-nowrap">
                {r.metric}
                <p className="sm:hidden text-[10px] font-normal text-muted-foreground mt-1 leading-snug">
                  {r.description}
                </p>
              </td>
              <td className="px-2 py-2 text-muted-foreground hidden sm:table-cell leading-snug">
                {r.description}
              </td>
              <td className="px-2 py-2 text-center text-success font-mono tabular-nums whitespace-nowrap">
                {r.good}
              </td>
              <td className="px-2 py-2 text-center text-warning font-mono tabular-nums whitespace-nowrap">
                {r.ok}
              </td>
              <td className="px-2 py-2 text-center text-destructive font-mono tabular-nums whitespace-nowrap">
                {r.bad}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegendRow({
  tag,
  tagColor,
  text,
}: {
  tag: string;
  tagColor: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2 leading-snug">
      <span
        className={cn(
          "shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums",
          tagColor
        )}
      >
        {tag}
      </span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
