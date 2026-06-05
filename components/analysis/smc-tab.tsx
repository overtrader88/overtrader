"use client";

/**
 * Aba "SMC" — Smart Money Concepts.
 * Mostra:
 *   - Viés institucional + estado da estrutura (BOS/CHoCH)
 *   - Order Blocks ativos (com strength e mitigation status)
 *   - Fair Value Gaps (active/filled)
 *   - Zonas de Liquidez (swept/unswept)
 */

import {
  Brain,
  Layers,
  Activity,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface SmcLike {
  bias: "bullish" | "bearish" | "neutral";
  orderBlocks: Array<{
    type: "bullish" | "bearish";
    zoneTop: number;
    zoneBottom: number;
    formedAt: number;
    strength: number;
    mitigated: boolean;
  }>;
  fvgs: Array<{
    type: "bullish" | "bearish";
    zoneTop: number;
    zoneBottom: number;
    formedAt: number;
    status: "active" | "filled";
  }>;
  liquidityZones: Array<{
    type: "buy_stops_above" | "sell_stops_below";
    level: number;
    formedAt: number;
    cluster: number;
    swept: boolean;
  }>;
  marketStructure:
    | "bullish_bos"
    | "bearish_bos"
    | "bullish_choch"
    | "bearish_choch"
    | "consolidating";
  summary?: string;
}

interface Props {
  smc?: SmcLike | null;
}

const STRUCTURE_META: Record<
  SmcLike["marketStructure"],
  { label: string; description: string; tone: "success" | "destructive" | "muted" }
> = {
  bullish_bos: {
    label: "BOS Bullish",
    description: "Continuação de tendência de alta — quebra de estrutura confirmada.",
    tone: "success",
  },
  bearish_bos: {
    label: "BOS Bearish",
    description: "Continuação de tendência de baixa — quebra de estrutura confirmada.",
    tone: "destructive",
  },
  bullish_choch: {
    label: "CHoCH Bullish",
    description: "Mudança de caráter pra alta — possível reversão.",
    tone: "success",
  },
  bearish_choch: {
    label: "CHoCH Bearish",
    description: "Mudança de caráter pra baixa — possível reversão.",
    tone: "destructive",
  },
  consolidating: {
    label: "Consolidando",
    description: "Sem quebra recente da estrutura — preço em range.",
    tone: "muted",
  },
};

function formatPrice(n: number): string {
  if (!n || !Number.isFinite(n)) return "—";
  const decimals = n < 1 ? 5 : n < 100 ? 3 : 2;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function SmcTab({ smc }: Props) {
  if (!smc) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-base font-semibold mb-1">
          Análise SMC não disponível
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Esta análise foi gerada antes da v9.1. Refaça a análise para incluir
          Smart Money Concepts.
        </p>
      </Card>
    );
  }

  const structureMeta = STRUCTURE_META[smc.marketStructure];
  const biasMeta = {
    bullish: {
      label: "Comprador (Bullish)",
      icon: TrendingUp,
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
    },
    bearish: {
      label: "Vendedor (Bearish)",
      icon: TrendingDown,
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
    },
    neutral: {
      label: "Neutro",
      icon: Minus,
      color: "text-muted-foreground",
      bg: "bg-muted/20",
      border: "border-border/40",
    },
  }[smc.bias];
  const BiasIcon = biasMeta.icon;

  return (
    <div className="space-y-4">
      {/* Header — viés + estrutura */}
      <Card className={cn("p-5", biasMeta.bg, biasMeta.border, "border-2")}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "grid h-10 w-10 place-items-center rounded-full shrink-0",
                biasMeta.bg
              )}
            >
              <BiasIcon className={cn("h-5 w-5", biasMeta.color)} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Viés Institucional
              </p>
              <p className={cn("text-lg font-bold", biasMeta.color)}>
                {biasMeta.label}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Estrutura de Mercado
            </p>
            <p
              className={cn(
                "text-base font-semibold",
                structureMeta.tone === "success" && "text-success",
                structureMeta.tone === "destructive" && "text-destructive",
                structureMeta.tone === "muted" && "text-muted-foreground"
              )}
            >
              {structureMeta.label}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {structureMeta.description}
            </p>
          </div>
        </div>
        {smc.summary && (
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/30 italic">
            {smc.summary}
          </p>
        )}
      </Card>

      {/* Order Blocks */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Order Blocks
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {smc.orderBlocks.length} detectados ·{" "}
            {smc.orderBlocks.filter((o) => !o.mitigated).length} ativos
          </span>
        </div>
        {smc.orderBlocks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum OB significativo detectado.</p>
        ) : (
          <ul className="space-y-2">
            {smc.orderBlocks.map((ob, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md border p-3",
                  ob.type === "bullish"
                    ? "border-success/30 bg-success/5"
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={ob.type === "bullish" ? "success" : "destructive"}
                      className="text-[10px]"
                    >
                      OB {ob.type === "bullish" ? "Alta" : "Baixa"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Força:{" "}
                      <strong
                        className={
                          ob.strength > 70
                            ? "text-success"
                            : ob.strength > 40
                              ? "text-warning"
                              : "text-muted-foreground"
                        }
                      >
                        {ob.strength}%
                      </strong>
                    </span>
                    {ob.mitigated ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-warning border-warning/40"
                      >
                        <AlertTriangle className="h-3 w-3" /> Mitigado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-success border-success/40"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Ativo
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums">
                    {formatPrice(ob.zoneBottom)} — {formatPrice(ob.zoneTop)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {ob.type === "bullish"
                    ? "Zona de demanda — preço pode encontrar suporte aqui."
                    : "Zona de oferta — preço pode encontrar resistência aqui."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Fair Value Gaps */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Fair Value Gaps (FVGs)
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {smc.fvgs.filter((f) => f.status === "active").length} ativos ·{" "}
            {smc.fvgs.filter((f) => f.status === "filled").length} preenchidos
          </span>
        </div>
        {smc.fvgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum gap de valor detectado.
          </p>
        ) : (
          <ul className="space-y-2">
            {smc.fvgs.map((fvg, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md border p-3",
                  fvg.status === "filled"
                    ? "border-border/40 bg-card/40 opacity-70"
                    : fvg.type === "bullish"
                      ? "border-success/30 bg-success/5"
                      : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={fvg.type === "bullish" ? "success" : "destructive"}
                      className="text-[10px]"
                    >
                      FVG {fvg.type === "bullish" ? "Alta" : "Baixa"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        fvg.status === "active"
                          ? "text-primary border-primary/40"
                          : "text-muted-foreground"
                      )}
                    >
                      {fvg.status === "active" ? "Ativo" : "Preenchido"}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs tabular-nums">
                    {formatPrice(fvg.zoneBottom)} — {formatPrice(fvg.zoneTop)}
                  </span>
                </div>
                {fvg.status === "active" && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Preço pode retornar a esta zona antes de continuar o movimento.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Zonas de Liquidez */}
      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Zonas de Liquidez
          </h4>
          <span className="text-[11px] text-muted-foreground">
            {smc.liquidityZones.filter((z) => !z.swept).length} não varridas
          </span>
        </div>
        {smc.liquidityZones.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma zona de liquidez clusterizada identificada.
          </p>
        ) : (
          <ul className="space-y-2">
            {smc.liquidityZones.map((lz, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-baseline justify-between gap-2 rounded-md border p-3",
                  lz.swept
                    ? "border-border/40 bg-card/40 opacity-70"
                    : "border-warning/30 bg-warning/5"
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      lz.type === "buy_stops_above"
                        ? "text-success border-success/40 text-[10px]"
                        : "text-destructive border-destructive/40 text-[10px]"
                    }
                  >
                    {lz.type === "buy_stops_above"
                      ? "Stops de compra acima"
                      : "Stops de venda abaixo"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {lz.cluster}x clusterizado
                  </span>
                  {lz.swept && (
                    <Badge variant="outline" className="text-[10px]">
                      Varrido
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums">
                  {formatPrice(lz.level)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Disclaimer */}
      <Card className="p-4 bg-muted/5 border-border/40">
        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
          Smart Money Concepts identifica padrões usados por traders
          institucionais. Indicador <strong>contextual</strong> — combine com a
          análise técnica tradicional, gates de qualidade e backtest pra tomar
          decisão.
        </p>
      </Card>
    </div>
  );
}
