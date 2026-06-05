"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Crown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  ASSETS,
  SUPPORTED_TIMEFRAMES,
  assetTypeEmoji,
  assetTypeLabel,
  listAssetTypes,
  type AssetMeta,
  type AssetType,
  type Timeframe,
} from "@/lib/market";

interface Props {
  creditsSimple: number;
  creditsPro: number;
  /** Asset inicial via ?asset=XAUUSD na URL (pre-seleciona ativo e categoria) */
  initialAsset?: string;
  /** Timeframe inicial via ?timeframe=4h */
  initialTimeframe?: Timeframe;
}

const ASSET_TYPES_ORDER: AssetType[] = [
  "crypto",
  "forex",
  "stocks",
  "indices",
  "commodities",
];

export function AnalyzeForm({
  creditsSimple,
  creditsPro,
  initialAsset,
  initialTimeframe,
}: Props) {
  const router = useRouter();
  const availableTypes = listAssetTypes();
  const orderedTypes = ASSET_TYPES_ORDER.filter((t) =>
    availableTypes.includes(t)
  );

  // Pre-resolve asset/timeframe a partir das props (URL)
  const resolvedInitialAsset = useMemo(() => {
    if (!initialAsset) return null;
    return ASSETS.find((a) => a.symbol === initialAsset.toUpperCase()) ?? null;
  }, [initialAsset]);

  const [assetType, setAssetType] = useState<AssetType>(
    resolvedInitialAsset?.type ?? "crypto"
  );
  const [symbol, setSymbol] = useState<string>(
    resolvedInitialAsset?.symbol ?? "BTCUSDT"
  );
  const [timeframe, setTimeframe] = useState<Timeframe>(
    initialTimeframe ?? "1h"
  );
  const [analysisType, setAnalysisType] = useState<"simple" | "complete">(
    "complete"
  );
  const [running, setRunning] = useState(false);

  const filteredAssets: AssetMeta[] = useMemo(
    () => ASSETS.filter((a) => a.type === assetType),
    [assetType]
  );

  // Garante que o symbol selecionado pertence ao tipo escolhido
  useMemo(() => {
    if (!filteredAssets.find((a) => a.symbol === symbol)) {
      setSymbol(filteredAssets[0]?.symbol ?? "");
    }
  }, [filteredAssets, symbol]);

  const cost = analysisType === "simple" ? 1 : 1;
  const costType = analysisType === "simple" ? "Simples" : "PRO";
  const balance = analysisType === "simple" ? creditsSimple : creditsPro;
  const insufficient = balance < cost;

  async function onAnalyze() {
    if (insufficient) {
      toast.error("Créditos insuficientes.", {
        description: `Você tem ${balance} crédito(s) ${costType}.`,
      });
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe, type: analysisType }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg = data?.error ?? "Erro desconhecido.";
        if (res.status === 402) {
          toast.error("Créditos insuficientes.", { description: msg });
        } else {
          toast.error("Falha ao analisar.", { description: msg });
        }
        return;
      }
      toast.success("Análise concluída!");
      router.push(`/dashboard/analise/${data.id}`);
      router.refresh();
    } catch (err) {
      toast.error("Erro inesperado.", {
        description: err instanceof Error ? err.message : "Verifique sua conexão.",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tipo de ativo (segmented control 5 categorias) */}
      <div className="space-y-2">
        <Label>Mercado</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {orderedTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAssetType(t)}
              className={cn(
                "h-12 rounded-lg border text-xs sm:text-sm font-semibold transition-all min-h-[44px] px-2",
                assetType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40"
              )}
              title={assetTypeLabel(t)}
            >
              <span className="block sm:inline">{assetTypeEmoji(t)}</span>{" "}
              <span className="hidden sm:inline">{assetTypeLabel(t)}</span>
              <span className="sm:hidden text-[10px]">
                {t === "crypto" ? "Cripto" :
                  t === "forex" ? "Forex" :
                  t === "stocks" ? "Ações" :
                  t === "indices" ? "Índices" : "Commod."}
              </span>
            </button>
          ))}
        </div>
        {(assetType === "stocks" || assetType === "indices" || assetType === "commodities") && (
          <p className="text-[11px] text-warning">
            ⚠ Requer TWELVEDATA_API_KEY configurada. Free tier pode ter cobertura limitada para ações BR.
          </p>
        )}
      </div>

      {/* Ativo (grid de cards) */}
      <div className="space-y-2">
        <Label>Ativo</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredAssets.map((a) => (
            <button
              key={a.symbol}
              type="button"
              onClick={() => setSymbol(a.symbol)}
              className={cn(
                "h-16 rounded-lg border px-3 py-2 text-left transition-all min-h-[44px]",
                symbol === a.symbol
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{a.emoji ?? "•"}</span>
                <span className="font-bold text-sm">{a.symbol.replace("USDT", "").replace("USD", "")}</span>
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{a.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe */}
      <div className="space-y-2">
        <Label>Timeframe</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SUPPORTED_TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "h-12 rounded-lg border text-xs sm:text-sm font-semibold transition-all min-h-[44px] px-2",
                timeframe === tf.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40"
              )}
              title={tf.label}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Semanal e Mensal são ideais para análise de longo prazo (position trading).
          Para ativos novos pode haver poucos candles históricos.
        </p>
      </div>

      {/* Tipo de análise */}
      <div className="space-y-2">
        <Label>Tipo de análise</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Simples */}
          <button
            type="button"
            onClick={() => setAnalysisType("simple")}
            className={cn(
              "text-left p-4 rounded-xl border transition-all",
              analysisType === "simple"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Análise Simples
              </div>
              <Badge variant="outline" className="text-xs">1 crédito</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Visão rápida — sinal, indicadores essenciais e gráfico ao vivo.
            </p>
          </button>

          {/* Completa */}
          <button
            type="button"
            onClick={() => setAnalysisType("complete")}
            className={cn(
              "text-left p-4 rounded-xl border transition-all relative",
              analysisType === "complete"
                ? "border-accent bg-accent/5"
                : "border-border bg-card hover:border-accent/40"
            )}
          >
            <div className="absolute -top-2 -right-2">
              <Badge variant="accent" className="text-[10px] px-2 py-0.5">
                RECOMENDADO
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-semibold">
                <Crown className="h-4 w-4 text-accent" />
                Análise Completa
              </div>
              <Badge variant="accent" className="text-xs">1 PRO</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              20 indicadores + Sinal + Risco + 6 Gates de qualidade + Explicação detalhada.
            </p>
          </button>
        </div>
      </div>

      {/* Saldo + CTA */}
      <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Saldo:</span>
          <Badge variant="outline" className="px-2 py-1">
            <Sparkles className="h-3 w-3 mr-1 text-primary" />
            {creditsSimple} Simples
          </Badge>
          <Badge variant="outline" className="px-2 py-1">
            <Crown className="h-3 w-3 mr-1 text-accent" />
            {creditsPro} PRO
          </Badge>
        </div>
        <Button
          size="lg"
          onClick={onAnalyze}
          disabled={running || insufficient}
          className="w-full sm:w-auto"
        >
          {running ? (
            <>
              <Loader2 className="animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              Analisar agora ({cost} crédito{cost > 1 ? "s" : ""} {costType})
            </>
          )}
        </Button>
      </div>

      {insufficient && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Você não tem créditos {costType} suficientes. Escolha outro tipo de análise
          ou adquira mais créditos.
        </div>
      )}
    </div>
  );
}
