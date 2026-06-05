"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { ChartLine } from "@/lib/analysis/chart-overlays";

interface Candle { time: number; open: number; high: number; low: number; close: number; }
type State = "loading" | "done" | "error";

/**
 * Candlestick (lightweight-charts) com overlays: entrada/stop/TPs + OB/FVG/PRZ.
 * Busca a janela de candles em /api/candles e desenha as linhas de preço passadas
 * por prop. A lib só é importada no client (dynamic import dentro do efeito).
 */
export function PriceChart({
  symbol,
  assetType,
  timeframe,
  lines,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  lines: ChartLine[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let chart: IChartApi | null = null;
    let disposed = false;
    let ro: ResizeObserver | null = null;

    void (async () => {
      try {
        const params = new URLSearchParams({ symbol, type: assetType, tf: timeframe });
        const res = await fetch(`/api/candles?${params.toString()}`);
        if (!res.ok) throw new Error("candles");
        const data = (await res.json()) as { candles?: Candle[] };
        if (disposed || !ref.current || !data.candles?.length) {
          if (!disposed) setState("error");
          return;
        }
        const lc = await import("lightweight-charts");
        if (disposed || !ref.current) return;
        const container = ref.current;
        chart = lc.createChart(container, {
          width: container.clientWidth,
          height: 360,
          layout: { background: { type: lc.ColorType.Solid, color: "transparent" }, textColor: "#93a0b6", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
          grid: { vertLines: { color: "rgba(120,160,225,0.06)" }, horzLines: { color: "rgba(120,160,225,0.06)" } },
          rightPriceScale: { borderColor: "rgba(120,170,235,0.17)" },
          timeScale: { borderColor: "rgba(120,170,235,0.17)", timeVisible: true, secondsVisible: false },
          crosshair: { mode: lc.CrosshairMode.Normal },
        });
        const series = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#2bd49e",
          downColor: "#ff6b8a",
          wickUpColor: "#2bd49e",
          wickDownColor: "#ff6b8a",
          borderVisible: false,
        });
        series.setData(data.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
        for (const ln of lines) {
          series.createPriceLine({
            price: ln.price,
            color: ln.color,
            lineWidth: 1,
            lineStyle: ln.dashed ? lc.LineStyle.Dashed : lc.LineStyle.Solid,
            axisLabelVisible: true,
            title: ln.title,
          });
        }
        chart.timeScale().fitContent();
        ro = new ResizeObserver(() => {
          if (ref.current && chart) chart.applyOptions({ width: ref.current.clientWidth });
        });
        ro.observe(container);
        setState("done");
      } catch {
        if (!disposed) setState("error");
      }
    })();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      if (chart) chart.remove();
    };
  }, [symbol, assetType, timeframe, lines]);

  return (
    <div className="pchart-wrap">
      <div ref={ref} className="pchart" />
      {state === "loading" ? <p className="note">Carregando gráfico…</p> : null}
      {state === "error" ? <p className="note">Não foi possível carregar o gráfico agora.</p> : null}
      {state === "done" ? <p className="note">Entrada/Stop/TPs e zonas (OB/FVG/PRZ) projetadas como níveis de preço. Janela recente; contexto, não recomendação.</p> : null}
    </div>
  );
}
