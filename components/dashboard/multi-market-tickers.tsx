"use client";

/**
 * Widget unificado de tickers ao vivo com tabs por categoria.
 *
 * Categoria "crypto":
 *   - Inicial via API REST (snapshot)
 *   - Upgrade pra WebSocket Binance pra atualizacao ao vivo
 *
 * Outras categorias (forex/commodities/stocks/indices):
 *   - REST via Twelve Data
 *   - Refresh a cada 60s (free tier de TwelveData = 8 req/min)
 *
 * Lazy loading: so busca a categoria ativa (economiza requests/cota).
 */

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Activity, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface Ticker {
  symbol: string;
  display: string;
  emoji: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
}

type Category = "crypto" | "forex" | "commodities" | "stocks" | "indices";

const CATEGORIES: Array<{ id: Category; label: string; emoji: string }> = [
  { id: "crypto", label: "Cripto", emoji: "₿" },
  { id: "forex", label: "Forex", emoji: "💱" },
  { id: "commodities", label: "Commodities", emoji: "🛢️" },
  { id: "stocks", label: "Ações", emoji: "📈" },
  { id: "indices", label: "Índices", emoji: "🇺🇸" },
];

function formatPrice(n: number): string {
  if (!n) return "—";
  const decimals = n < 1 ? 5 : n < 100 ? 3 : 2;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatTimeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 5) return "agora";
  if (sec < 60) return `${sec}s atras`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min atras`;
  return new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MultiMarketTickers() {
  const [activeCategory, setActiveCategory] = useState<Category>("crypto");
  const [tickersByCategory, setTickersByCategory] = useState<
    Partial<Record<Category, Ticker[]>>
  >({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Category, string>>>({});
  const [lastUpdated, setLastUpdated] = useState<
    Partial<Record<Category, number>>
  >({});
  const [liveConnected, setLiveConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch via REST pra categoria especifica
  const fetchCategory = useCallback(async (cat: Category) => {
    setLoading(true);
    setErrors((prev) => ({ ...prev, [cat]: undefined }));
    try {
      const res = await fetch(`/api/market/tickers/${cat}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrors((prev) => ({
          ...prev,
          [cat]: data.error ?? `Erro HTTP ${res.status}`,
        }));
        return;
      }
      setTickersByCategory((prev) => ({ ...prev, [cat]: data.tickers }));
      setLastUpdated((prev) => ({ ...prev, [cat]: Date.now() }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [cat]: err instanceof Error ? err.message : "Erro de rede",
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega a categoria ativa (lazy)
  useEffect(() => {
    if (!tickersByCategory[activeCategory]) {
      fetchCategory(activeCategory);
    }
  }, [activeCategory, tickersByCategory, fetchCategory]);

  // Auto-refresh nao-crypto a cada 5min, e SO quando aba esta visivel.
  // Economiza calls do free tier TwelveData (800/dia).
  // Cripto nao precisa — WebSocket atualiza em tempo real sem consumir cota.
  useEffect(() => {
    if (activeCategory === "crypto") return;

    const REFRESH_MS = 5 * 60 * 1000; // 5 minutos

    function tick() {
      if (document.visibilityState === "visible") {
        fetchCategory(activeCategory);
      }
    }

    const interval = setInterval(tick, REFRESH_MS);

    // Quando o usuario volta pra aba, refaz se passou tempo suficiente
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const last = lastUpdated[activeCategory] ?? 0;
        if (Date.now() - last > REFRESH_MS) {
          fetchCategory(activeCategory);
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeCategory, fetchCategory, lastUpdated]);

  // WebSocket Binance pra cripto ativa
  useEffect(() => {
    if (activeCategory !== "crypto") {
      // Desconecta WS se sair de cripto
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setLiveConnected(false);
      return;
    }

    const cryptoTickers = tickersByCategory.crypto;
    if (!cryptoTickers || cryptoTickers.length === 0) return;

    const streams = cryptoTickers
      .map((t) => `${t.symbol.toLowerCase()}@ticker`)
      .join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    let closed = false;
    let attempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setLiveConnected(true);
        attempts = 0;
      };
      ws.onclose = () => {
        setLiveConnected(false);
        if (closed) return;
        const delay = Math.min(1000 * Math.pow(2, attempts), 30_000);
        attempts++;
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const d = payload.data;
          if (!d?.s) return;
          setTickersByCategory((prev) => {
            const cur = prev.crypto ?? [];
            const updated = cur.map((t) =>
              t.symbol === d.s
                ? {
                    ...t,
                    price: parseFloat(d.c),
                    change24h: parseFloat(d.P),
                    high24h: parseFloat(d.h),
                    low24h: parseFloat(d.l),
                  }
                : t
            );
            return { ...prev, crypto: updated };
          });
          setLastUpdated((prev) => ({ ...prev, crypto: Date.now() }));
        } catch {
          /* ignore */
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeCategory, tickersByCategory.crypto]);

  const tickers = tickersByCategory[activeCategory] ?? [];
  const error = errors[activeCategory];
  const updated = lastUpdated[activeCategory];

  return (
    <Card className="p-4 sm:p-5">
      {/* Header + tabs scrollable horizontal pra mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold">Mercado ao vivo</h3>
          <p className="text-xs text-muted-foreground">
            {activeCategory === "crypto"
              ? "Cripto via Binance · atualizacao em tempo real"
              : "Snapshot via Twelve Data · refresh a cada 5 min"}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activeCategory === "crypto" && liveConnected && (
            <Badge
              variant="ghost"
              className="bg-success/10 text-success border-success/30 text-[10px]"
            >
              <Activity className="h-3 w-3 mr-1 animate-pulse" />
              AO VIVO
            </Badge>
          )}
          {activeCategory !== "crypto" && updated && (
            <span className="text-[10px] text-muted-foreground">
              {formatTimeAgo(updated)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs de categoria */}
      <div className="overflow-x-auto -mx-1 mb-4">
        <div className="flex gap-1 px-1 min-w-fit">
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap min-h-[40px] transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && tickers.length === 0 && (
        <div className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Carregando tickers...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && tickers.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-sm text-destructive mb-2">Erro: {error}</p>
          <p className="text-xs text-muted-foreground">
            {activeCategory !== "crypto" &&
              "Possivelmente sem TWELVEDATA_API_KEY ou rate limit excedido."}
          </p>
          <button
            type="button"
            onClick={() => fetchCategory(activeCategory)}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Tickers grid — sempre 2 cols mobile / 4 cols desktop.
          Cripto (8 itens) -> 2 linhas no desktop, 4 linhas mobile.
          Demais (4 itens) -> 1 linha no desktop, 2 linhas mobile.
          Cards consistentes em tamanho independente do n de itens. */}
      {tickers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {tickers.map((t) => (
            <TickerCard key={t.symbol} ticker={t} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TickerCard({ ticker }: { ticker: Ticker }) {
  const up = ticker.change24h > 0;
  const down = ticker.change24h < 0;
  const hasPrice = ticker.price > 0;
  return (
    <Link
      href={`/dashboard/analise?asset=${ticker.symbol}`}
      className="block min-h-0 group"
      prefetch={false}
    >
      <div
        className={cn(
          "rounded-xl border bg-card/40 p-3 sm:p-4 transition-all h-full",
          "border-border/60",
          "group-hover:border-primary/50 group-hover:bg-card group-hover:shadow-lg group-hover:shadow-primary/5",
          "group-hover:-translate-y-0.5"
        )}
      >
        {/* Header: emoji + simbolo + % change */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg sm:text-xl shrink-0">{ticker.emoji}</span>
            <span className="text-xs sm:text-sm font-bold truncate">
              {ticker.display}
            </span>
          </div>
          {hasPrice && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[10px] sm:text-xs font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md",
                up && "text-success bg-success/10",
                down && "text-destructive bg-destructive/10",
                !up && !down && "text-muted-foreground bg-muted/30"
              )}
            >
              {up && <ArrowUp className="h-3 w-3" />}
              {down && <ArrowDown className="h-3 w-3" />}
              {!up && !down && <Minus className="h-3 w-3" />}
              {Math.abs(ticker.change24h).toFixed(2)}%
            </span>
          )}
        </div>

        {/* Preco principal */}
        <div className="font-mono font-bold text-base sm:text-lg lg:text-xl tabular-nums leading-tight">
          {hasPrice ? formatPrice(ticker.price) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Rodape: high/low 24h (so quando ha dados) */}
        {hasPrice && ticker.high24h > 0 && ticker.low24h > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>L {formatPrice(ticker.low24h)}</span>
            <span>H {formatPrice(ticker.high24h)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
