"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, IPriceLine, UTCTimestamp } from "lightweight-charts";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { ChartLine } from "@/lib/analysis/chart-overlays";

interface Candle { time: number; open: number; high: number; low: number; close: number; }

/**
 * Gráfico AO VIVO: cria o chart uma vez, faz polling dos candles (setData) e
 * mantém as linhas de preço (entrada/stop/TPs + zonas) sincronizadas com a
 * análise — removendo/redesenhando quando `lines` muda, sem reconstruir o chart.
 */
export function LiveChart({
  symbol,
  assetType,
  timeframe,
  lines,
  candleRefreshMs = 12000,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  lines: ChartLine[];
  candleRefreshMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lcRef = useRef<typeof import("lightweight-charts") | null>(null);
  const linesRef = useRef<ChartLine[]>(lines);
  linesRef.current = lines;

  function redrawLines() {
    const lc = lcRef.current;
    const s = seriesRef.current;
    if (!lc || !s) return;
    for (const pl of priceLinesRef.current) s.removePriceLine(pl);
    priceLinesRef.current = linesRef.current
      .filter((l) => Number.isFinite(l.price))
      .map((ln) =>
        s.createPriceLine({
          price: ln.price,
          color: ln.color,
          lineWidth: 1,
          lineStyle: ln.dashed ? lc.LineStyle.Dashed : lc.LineStyle.Solid,
          axisLabelVisible: true,
          title: ln.title,
        }),
      );
  }

  // Setup do chart + polling dos candles. Reinicia ao trocar ativo/TF.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !ref.current) return;
      lcRef.current = lc;
      const container = ref.current;
      const chart = lc.createChart(container, {
        width: container.clientWidth,
        height: 440,
        layout: { background: { type: lc.ColorType.Solid, color: "transparent" }, textColor: "#93a0b6", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
        grid: { vertLines: { color: "rgba(120,160,225,0.06)" }, horzLines: { color: "rgba(120,160,225,0.06)" } },
        rightPriceScale: { borderColor: "rgba(120,170,235,0.17)" },
        timeScale: { borderColor: "rgba(120,170,235,0.17)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: lc.CrosshairMode.Normal },
      });
      const series = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#2bd49e", downColor: "#ff6b8a", wickUpColor: "#2bd49e", wickDownColor: "#ff6b8a", borderVisible: false,
      });
      chartRef.current = chart;
      seriesRef.current = series;

      ro = new ResizeObserver(() => { if (ref.current && chart) chart.applyOptions({ width: ref.current.clientWidth }); });
      ro.observe(container);

      async function loadCandles(fit: boolean) {
        try {
          const params = new URLSearchParams({ symbol, type: assetType, tf: timeframe });
          const res = await fetch(`/api/candles?${params.toString()}`);
          if (!res.ok) return;
          const data = (await res.json()) as { candles?: Candle[] };
          if (disposed || !seriesRef.current || !data.candles?.length) return;
          seriesRef.current.setData(data.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
          if (fit) chart.timeScale().fitContent();
          redrawLines(); // setData mantém price lines, mas garantimos consistência
        } catch { /* silencioso — tenta de novo no próximo tick */ }
      }

      await loadCandles(true);
      if (!disposed) timer = setInterval(() => loadCandles(false), candleRefreshMs);
    })();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      if (timer) clearInterval(timer);
      if (chartRef.current) chartRef.current.remove();
      chartRef.current = null; seriesRef.current = null; priceLinesRef.current = []; lcRef.current = null;
    };
  }, [symbol, assetType, timeframe, candleRefreshMs]);

  // Quando a análise muda (novas linhas), redesenha sem reconstruir o chart.
  useEffect(() => { redrawLines(); }, [lines]);

  return <div ref={ref} style={{ width: "100%", minHeight: 440 }} />;
}
