"use client";

/**
 * Live chart usando TradingView Lightweight Charts (open-source MIT).
 * Fluxo:
 *   1. No mount, busca histórico de candles via /api/market/candles
 *   2. Renderiza o gráfico de candles
 *   3. Conecta no WebSocket público da Binance para atualização em tempo real
 *      (apenas para cripto — Forex via Twelve Data não tem WS público no free tier)
 *   4. Marca linhas horizontais em Entry / SL / TP1/2/3
 *
 * Sem delay de 15 minutos — diferencial direto vs Vortex.
 */

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import { Loader2, Activity, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Timeframe } from "@/lib/market";
import type { SignalDirection } from "@/lib/analysis/types";
import {
  signalShortLabel,
  signalBadgeVariant,
  hasDirection,
} from "@/lib/analysis/signal-utils";

interface Props {
  symbol: string; // ex.: BTCUSDT
  assetType: "crypto" | "forex" | "stocks" | "indices" | "commodities";
  timeframe: Timeframe;
  /** Níveis para marcar no chart (entry, SL, TPs) */
  levels?: {
    entry?: number;
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
    takeProfit3?: number;
  };
  signal?: SignalDirection;
}

interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BINANCE_TF_MAP: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M", // M maiúsculo = mensal (Binance)
};

export function LiveChart({ symbol, assetType, timeframe, levels, signal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  // 1) Setup do chart
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.7)",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(0,184,217,0.5)", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "rgba(0,184,217,0.5)", width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
    });

    // @ts-expect-error - addCandlestickSeries existe em runtime mas tipo varia entre versões
    const series = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 2) Fetch inicial dos candles
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/market/candles?symbol=${symbol}&timeframe=${timeframe}&limit=300`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar dados");
        if (cancelled || !seriesRef.current) return;

        const candles: RawCandle[] = data.candles;
        const formatted = candles.map((c) => ({
          time: Math.floor(c.time / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.setData(formatted);

        if (candles.length > 0) {
          setLastPrice(candles[candles.length - 1].close);
        }

        // Marca níveis (entry, SL, TPs) — para QUALQUER sinal direcional
        // (forte, normal ou fraco). Só não desenha em NEUTRAL.
        // Sinais fracos têm direção e merecem o plano visualizado.
        const showLevels = signal ? hasDirection(signal) : false;
        if (showLevels && levels && seriesRef.current) {
          const lines = [
            { p: levels.entry, label: "Entrada", color: "#00B8D9" },
            { p: levels.stopLoss, label: "Stop", color: "#dc2626" },
            { p: levels.takeProfit1, label: "TP1", color: "#16a34a" },
            { p: levels.takeProfit2, label: "TP2", color: "#16a34a" },
            { p: levels.takeProfit3, label: "TP3", color: "#16a34a" },
          ];
          // Detecta se entry/SL/TP1 são todos iguais (caso engine tenha
          // zerado por sinal NEUTRAL fallback) - se sim, não desenha.
          const distinct =
            levels.entry !== levels.stopLoss ||
            levels.entry !== levels.takeProfit1;
          if (distinct) {
            for (const l of lines) {
              if (typeof l.p === "number" && !Number.isNaN(l.p) && l.p > 0) {
                seriesRef.current.createPriceLine({
                  price: l.p,
                  color: l.color,
                  lineStyle: LineStyle.Dashed,
                  lineWidth: 1,
                  title: l.label,
                  axisLabelVisible: true,
                });
              }
            }
          }
        }

        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro desconhecido");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, levels]);

  // 3) WebSocket Binance (apenas cripto)
  useEffect(() => {
    if (assetType !== "crypto") return; // Forex/Stocks: sem WS público

    const stream = `${symbol.toLowerCase()}@kline_${BINANCE_TF_MAP[timeframe]}`;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    wsRef.current = ws;

    ws.onopen = () => setStreaming(true);
    ws.onclose = () => setStreaming(false);
    ws.onerror = () => setStreaming(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const k = msg.k;
        if (!k || !seriesRef.current) return;
        const update = {
          time: Math.floor(k.t / 1000) as UTCTimestamp,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        seriesRef.current.update(update);
        setLastPrice(update.close);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol, timeframe, assetType]);

  return (
    <div className="space-y-2">
      {/* Header com badge de stream */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{symbol}</span>
          <span className="text-muted-foreground">{timeframe}</span>
          {lastPrice !== null && (
            <span className="font-mono font-bold tabular-nums">
              {lastPrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}
            </span>
          )}
          {signal && (
            <Badge variant={signalBadgeVariant(signal)} className="text-[10px]">
              {signalShortLabel(signal)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {assetType === "crypto" ? (
            streaming ? (
              <Badge variant="ghost" className="bg-success/10 text-success border-success/30">
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                AO VIVO
              </Badge>
            ) : (
              <Badge variant="ghost" className="bg-warning/10 text-warning border-warning/30">
                <WifiOff className="h-3 w-3 mr-1" />
                conectando...
              </Badge>
            )
          ) : (
            <Badge variant="ghost" className="text-[10px]">
              Atualiza a cada análise
            </Badge>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-video min-h-[300px] sm:min-h-[400px] rounded-lg border border-border bg-card overflow-hidden">
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-card/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-6 w-6 animate-spin" />
              Carregando dados de mercado...
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-card/80 backdrop-blur-sm z-10">
            <div className="text-center text-sm text-destructive max-w-md p-4">
              <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-80" />
              Não foi possível carregar o gráfico.
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
