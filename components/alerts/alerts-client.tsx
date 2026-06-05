"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  CheckCheck,
  Plus,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResultTabs } from "@/components/analysis/tabs";
import {
  listAssetTypes,
  getAssetsByType,
  getAsset,
  assetTypeLabel,
} from "@/lib/market";
import type { AssetType } from "@/lib/market";
import {
  signalLabel,
  signalBadgeVariant,
  signalSide,
} from "@/lib/analysis/signal-utils";
import type { SignalDirection } from "@/lib/analysis/types";
import { cn } from "@/lib/utils/cn";

interface AlertRow {
  id: string;
  asset: string;
  timeframe: string;
  signal: string;
  strength: number | null;
  confluence: number | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit1: number | null;
  message: string | null;
  read_at: string | null;
  created_at: string;
  analysis_id: string | null;
}

interface WatchItem {
  id: string;
  asset: string;
  asset_type: string;
  timeframe: string;
  min_signal_strength: "WEAK_BUY" | "BUY" | "STRONG_BUY";
  last_checked_at: string | null;
  last_alerted_signal: string | null;
}

interface Props {
  initialAlerts: AlertRow[];
  initialWatchlist: WatchItem[];
  initialTab: "alerts" | "watchlist";
}

export function AlertsClient({
  initialAlerts,
  initialWatchlist,
  initialTab,
}: Props) {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts);
  const [watchlist, setWatchlist] = useState<WatchItem[]>(initialWatchlist);

  const unreadCount = alerts.filter((a) => !a.read_at).length;

  async function markAllRead() {
    if (unreadCount === 0) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Falha", { description: data.error });
        return;
      }
      const now = new Date().toISOString();
      setAlerts((prev) =>
        prev.map((a) => (a.read_at ? a : { ...a, read_at: now }))
      );
      toast.success(`${data.action === "marked_all_read" ? unreadCount : 0} marcados como lidos`);
    } catch (err) {
      toast.error("Erro de rede");
    }
  }

  async function markOneRead(id: string) {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) return;
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, read_at: new Date().toISOString() } : a
        )
      );
    } catch {
      // silencia — UX otimista nao precisa toast em update single
    }
  }

  async function removeFromWatchlist(id: string) {
    try {
      const res = await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Falha ao remover", { description: data.error });
        return;
      }
      setWatchlist((prev) => prev.filter((w) => w.id !== id));
      toast.success("Removido da watchlist");
    } catch {
      toast.error("Erro de rede");
    }
  }

  async function addToWatchlist(payload: {
    asset: string;
    timeframe: string;
    min_signal_strength: string;
  }) {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Falha", { description: data.error });
        return false;
      }
      setWatchlist((prev) => [data.item, ...prev]);
      toast.success(`${payload.asset} ${payload.timeframe} adicionado`);
      return true;
    } catch {
      toast.error("Erro de rede");
      return false;
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Alertas
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount} novos
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Voce sera avisado quando ativos da sua watchlist tiverem sinais fortes.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            className="min-h-[44px]"
          >
            <CheckCheck className="h-4 w-4" /> Marcar todos como lidos
          </Button>
        )}
      </div>

      <ResultTabs
        defaultTab={initialTab}
        tabs={[
          {
            id: "alerts",
            label: "Notificacoes",
            badge: unreadCount > 0 ? `${unreadCount}` : undefined,
          },
          {
            id: "watchlist",
            label: "Watchlist",
            badge: String(watchlist.length),
          },
        ]}
      >
        {(active) => (
          <>
            {active === "alerts" && (
              <AlertsList alerts={alerts} onMarkRead={markOneRead} />
            )}
            {active === "watchlist" && (
              <WatchlistManager
                items={watchlist}
                onRemove={removeFromWatchlist}
                onAdd={addToWatchlist}
              />
            )}
          </>
        )}
      </ResultTabs>
    </div>
  );
}

// ============================================================
// Lista de alertas
// ============================================================

function AlertsList({
  alerts,
  onMarkRead,
}: {
  alerts: AlertRow[];
  onMarkRead: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BellRing className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="text-base font-semibold mb-1">
          Nenhum alerta ainda
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Adicione ativos a sua watchlist e voce sera avisado quando aparecer um
          sinal forte. O sistema verifica a cada 15 minutos.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const side = signalSide(alert.signal as SignalDirection);
        const unread = !alert.read_at;
        return (
          <li key={alert.id}>
            <Card
              className={cn(
                "p-4 hover:bg-card/70 transition-colors",
                unread && "border-primary/40 bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                {unread && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm font-bold">
                        {alert.asset}
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {alert.timeframe}
                      </span>
                      <Badge
                        variant={
                          signalBadgeVariant(alert.signal as SignalDirection) ===
                          "success"
                            ? "success"
                            : signalBadgeVariant(alert.signal as SignalDirection) ===
                                "destructive"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {signalLabel(alert.signal as SignalDirection)}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {new Date(alert.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {alert.message && (
                    <p className="text-xs text-foreground/85 mt-2 leading-relaxed line-clamp-2">
                      {alert.message}
                    </p>
                  )}
                  {(alert.entry || alert.confluence !== null) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {alert.confluence !== null && (
                        <span>
                          <span className="text-muted-foreground">
                            Conflu.:
                          </span>{" "}
                          <strong className="tabular-nums">
                            {alert.confluence}/10
                          </strong>
                        </span>
                      )}
                      {alert.strength !== null && (
                        <span>
                          <span className="text-muted-foreground">Forca:</span>{" "}
                          <strong className="tabular-nums">
                            {alert.strength}/100
                          </strong>
                        </span>
                      )}
                      {alert.entry !== null && side !== "neutral" && (
                        <span>
                          <span className="text-muted-foreground">
                            Entrada:
                          </span>{" "}
                          <strong className="font-mono tabular-nums">
                            {alert.entry.toFixed(2)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/dashboard/analise?asset=${alert.asset}&timeframe=${alert.timeframe}`}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 min-h-[44px]"
                    >
                      <Eye className="h-3 w-3" /> Analisar agora
                    </Link>
                    {unread && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(alert.id)}
                        className="text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
                      >
                        Marcar como lido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

// ============================================================
// Gestao da watchlist
// ============================================================

const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M"] as const;
const THRESHOLDS = ["STRONG_BUY", "BUY", "WEAK_BUY"] as const;

function WatchlistManager({
  items,
  onRemove,
  onAdd,
}: {
  items: WatchItem[];
  onRemove: (id: string) => void;
  onAdd: (p: {
    asset: string;
    timeframe: string;
    min_signal_strength: string;
  }) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [assetType, setAssetType] = useState<string>("crypto");
  const [asset, setAsset] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [threshold, setThreshold] = useState<string>("STRONG_BUY");

  const types = listAssetTypes();
  const catalogForType = getAssetsByType(assetType as AssetType);

  async function handleAdd() {
    if (!asset) {
      toast.error("Escolha um ativo");
      return;
    }
    setAdding(true);
    const ok = await onAdd({
      asset,
      timeframe,
      min_signal_strength: threshold,
    });
    if (ok) {
      setAsset("");
    }
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {/* Form de adicionar */}
      <Card className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Adicionar ativo a watchlist
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Categoria
            </label>
            <select
              value={assetType}
              onChange={(e) => {
                setAssetType(e.target.value);
                setAsset("");
              }}
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {assetTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Ativo
            </label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Selecione...</option>
              {catalogForType.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Timeframe
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {TIMEFRAMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Forca minima
            </label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] rounded-md border border-border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {THRESHOLDS.map((t) => (
                <option key={t} value={t}>
                  {t === "WEAK_BUY"
                    ? "Fraco ou mais"
                    : t === "BUY"
                      ? "Normal ou mais"
                      : "Apenas forte"}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleAdd}
            disabled={adding || !asset}
            className="min-h-[44px] w-full sm:w-auto"
          >
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adicionando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Adicionar
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Lista atual */}
      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sua watchlist esta vazia. Adicione ativos acima.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const meta = getAsset(item.asset);
            return (
              <li key={item.id}>
                <Card className="p-3 sm:p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-sm">{item.asset}</strong>
                      <span className="text-xs text-muted-foreground">
                        {item.timeframe}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Min: {item.min_signal_strength}
                      </Badge>
                      {meta && (
                        <span className="text-[10px] text-muted-foreground">
                          {meta.emoji} {meta.name}
                        </span>
                      )}
                    </div>
                    {item.last_checked_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Ultimo check:{" "}
                        {new Date(item.last_checked_at).toLocaleString("pt-BR")}
                        {item.last_alerted_signal && (
                          <span className="ml-2">
                            · ultimo sinal: {item.last_alerted_signal}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px]"
                    aria-label={`Remover ${item.asset} ${item.timeframe}`}
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
