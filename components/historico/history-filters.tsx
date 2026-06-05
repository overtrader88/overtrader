"use client";

/**
 * Filtros do histórico — Client Component que manipula URL params
 * (filtros bookmarkáveis + back/forward funciona naturalmente).
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";
import {
  ASSETS,
  SUPPORTED_TIMEFRAMES,
  assetTypeEmoji,
  assetTypeLabel,
  listAssetTypes,
  type AssetType,
  type Timeframe,
} from "@/lib/market";

const SIGNALS = [
  { value: "STRONG_BUY", label: "Compra Forte" },
  { value: "BUY", label: "Compra" },
  { value: "WEAK_BUY", label: "Compra Fraca" },
  { value: "NEUTRAL", label: "Neutro" },
  { value: "WEAK_SELL", label: "Venda Fraca" },
  { value: "SELL", label: "Venda" },
  { value: "STRONG_SELL", label: "Venda Forte" },
];

const PERIODS = [
  { value: "1d", label: "24h" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Tudo" },
];

const TYPES = [
  { value: "simple", label: "Simples" },
  { value: "complete", label: "Completa" },
];

export function HistoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      // Reset paginação se mudou filtro
      if (key !== "page") next.delete("page");
      router.push(`${pathname}?${next.toString()}` as never, { scroll: false });
    },
    [router, pathname, params]
  );

  const clearAll = useCallback(() => {
    router.push(pathname as never, { scroll: false });
  }, [router, pathname]);

  const currentAssetType = params.get("type_asset") ?? "";
  const currentAsset = params.get("asset") ?? "";
  const currentTimeframe = params.get("timeframe") ?? "";
  const currentSignal = params.get("signal") ?? "";
  const currentPeriod = params.get("period") ?? "all";
  const currentType = params.get("type") ?? "";

  const hasAnyFilter =
    !!currentAssetType ||
    !!currentAsset ||
    !!currentTimeframe ||
    !!currentSignal ||
    currentPeriod !== "all" ||
    !!currentType;

  const filteredAssets = currentAssetType
    ? ASSETS.filter((a) => a.type === currentAssetType)
    : ASSETS;

  const availableTypes = listAssetTypes();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-primary" />
          Filtros
        </div>
        {hasAnyFilter && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Período */}
      <div className="space-y-2">
        <Label className="text-xs">Período</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIODS.map((p) => (
            <FilterPill
              key={p.value}
              active={currentPeriod === p.value}
              onClick={() => setParam("period", p.value === "all" ? null : p.value)}
            >
              {p.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Tipo de ativo (5 categorias) */}
      <div className="space-y-2">
        <Label className="text-xs">Mercado</Label>
        <div className="grid grid-cols-3 gap-1.5">
          <FilterPill
            active={currentAssetType === ""}
            onClick={() => {
              setParam("type_asset", null);
              setParam("asset", null);
            }}
          >
            Todos
          </FilterPill>
          {availableTypes.map((t) => (
            <FilterPill
              key={t}
              active={currentAssetType === t}
              onClick={() => {
                setParam("type_asset", currentAssetType === t ? null : t);
                setParam("asset", null);
              }}
              title={assetTypeLabel(t)}
            >
              {assetTypeEmoji(t)}{" "}
              {t === "crypto" ? "Cripto" :
                t === "forex" ? "Forex" :
                t === "stocks" ? "Ações" :
                t === "indices" ? "Índices" : "Commod."}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Ativo específico (mostra apenas se mercado escolhido) */}
      {currentAssetType && (
        <div className="space-y-2">
          <Label className="text-xs">Ativo</Label>
          <select
            value={currentAsset}
            onChange={(e) => setParam("asset", e.target.value || null)}
            className="w-full h-11 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Filtrar por ativo"
          >
            <option value="">Todos {currentAssetType}</option>
            {filteredAssets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.emoji} {a.symbol} — {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Timeframe */}
      <div className="space-y-2">
        <Label className="text-xs">Timeframe</Label>
        <div className="grid grid-cols-3 gap-1.5">
          <FilterPill
            active={currentTimeframe === ""}
            onClick={() => setParam("timeframe", null)}
          >
            Todos
          </FilterPill>
          {SUPPORTED_TIMEFRAMES.map((tf) => (
            <FilterPill
              key={tf.value}
              active={currentTimeframe === tf.value}
              onClick={() =>
                setParam("timeframe", currentTimeframe === tf.value ? null : tf.value)
              }
            >
              {tf.value}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Sinal (7 níveis) */}
      <div className="space-y-2">
        <Label className="text-xs">Sinal</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {SIGNALS.map((s) => (
            <FilterPill
              key={s.value}
              active={currentSignal === s.value}
              onClick={() =>
                setParam("signal", currentSignal === s.value ? null : s.value)
              }
              className={cn(currentSignal === s.value && "bg-primary/10")}
            >
              {s.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Tipo de análise */}
      <div className="space-y-2">
        <Label className="text-xs">Tipo de análise</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPES.map((t) => (
            <FilterPill
              key={t.value}
              active={currentType === t.value}
              onClick={() =>
                setParam("type", currentType === t.value ? null : t.value)
              }
            >
              {t.label}
            </FilterPill>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  className,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-9 rounded-lg border text-xs font-medium transition-all min-h-[44px] sm:min-h-[36px] px-2",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export type { AssetType, Timeframe };
