"use client";

/**
 * Widget de tickers ao vivo — multi-stream WebSocket Binance.
 *
 * Conecta em uma única conexão WS pra todos os ativos (mais eficiente que N conexões).
 * Doc: https://binance-docs.github.io/apidocs/spot/en/#all-market-tickers-stream
 *
 * Mostra preço atual + % 24h + sparkline mini (próximo iteração).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface Ticker {
  symbol: string;
  display: string;
  emoji: string;
  price: number;
  change24h: number; // %
  highPrice: number;
  lowPrice: number;
}

const ASSETS = [
  { symbol: "BTCUSDT", display: "BTC", emoji: "₿" },
  { symbol: "ETHUSDT", display: "ETH", emoji: "Ξ" },
  { symbol: "SOLUSDT", display: "SOL", emoji: "◎" },
  { symbol: "BNBUSDT", display: "BNB", emoji: "🟡" },
];

function formatPrice(n: number, symbol: string): string {
  // Para criptos < 1, mais decimais
  const decimals = n < 1 ? 5 : n < 100 ? 3 : 2;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function MarketTickers() {
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [connected, setConnected] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Fetch inicial dos preços via REST (pra ter algo na tela antes do WS conectar)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const promises = ASSETS.map(async (a) => {
          const res = await fetch(
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${a.symbol}`,
            { cache: "no-store" }
          );
          if (!res.ok) throw new Error(`Failed ${a.symbol}`);
          const data = await res.json();
          return {
            ...a,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            highPrice: parseFloat(data.highPrice),
            lowPrice: parseFloat(data.lowPrice),
          } as Ticker;
        });
        const initial = await Promise.all(promises);
        if (cancelled) return;
        const map: Record<string, Ticker> = {};
        for (const t of initial) map[t.symbol] = t;
        setTickers(map);
      } catch {
        /* segue silenciosamente, o WS preencherá depois */
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Conexão WebSocket multi-stream
  useEffect(() => {
    const streams = ASSETS.map((a) => `${a.symbol.toLowerCase()}@ticker`).join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let closed = false;

    function connect() {
      if (closed) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30_000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => {
        // onclose dispara depois — backoff lida com reconexão
      };
      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          const data = payload.data;
          if (!data?.s) return;
          const asset = ASSETS.find((a) => a.symbol === data.s);
          if (!asset) return;
          setTickers((prev) => ({
            ...prev,
            [data.s]: {
              ...asset,
              price: parseFloat(data.c),
              change24h: parseFloat(data.P),
              highPrice: parseFloat(data.h),
              lowPrice: parseFloat(data.l),
            },
          }));
        } catch {
          /* ignore */
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
    };
  }, []);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Mercado ao vivo</h3>
          <p className="text-xs text-muted-foreground">
            Preços via Binance — atualização em tempo real
          </p>
        </div>
        {connected ? (
          <Badge
            variant="ghost"
            className="bg-success/10 text-success border-success/30 text-[10px]"
          >
            <Activity className="h-3 w-3 mr-1 animate-pulse" />
            AO VIVO
          </Badge>
        ) : (
          <Badge variant="ghost" className="text-[10px]">
            conectando...
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {ASSETS.map((a) => {
          const t = tickers[a.symbol];
          const up = (t?.change24h ?? 0) > 0;
          const down = (t?.change24h ?? 0) < 0;
          return (
            <Link
              key={a.symbol}
              href={`/dashboard/analise?asset=${a.symbol}`}
              className="block min-h-0"
              prefetch={false}
            >
              <div
                className={cn(
                  "rounded-lg border border-border/60 bg-card/50 p-3 transition-all hover:border-primary/40 hover:bg-card",
                  "h-full"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{a.emoji}</span>
                    <span className="text-xs font-bold">{a.display}</span>
                  </div>
                  {t && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[10px] font-bold tabular-nums",
                        up && "text-success",
                        down && "text-destructive",
                        !up && !down && "text-muted-foreground"
                      )}
                    >
                      {up && <ArrowUp className="h-3 w-3" />}
                      {down && <ArrowDown className="h-3 w-3" />}
                      {!up && !down && <Minus className="h-3 w-3" />}
                      {Math.abs(t.change24h).toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="font-mono font-bold text-sm sm:text-base tabular-nums">
                  {t
                    ? formatPrice(t.price, a.symbol)
                    : loadingInitial
                      ? "—"
                      : "..."}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
