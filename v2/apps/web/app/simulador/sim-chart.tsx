"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { SignalPlan } from "@tradeai/engine";

interface Candle { time: number; open: number; high: number; low: number; close: number }

/**
 * Gráfico da Máquina do Tempo: candles até o CORTE + candles futuros revelados
 * um a um. O marcador âmbar sinaliza o corte ("você está aqui"); o espaço vazio
 * à direita é reservado — o futuro entra nele conforme o usuário avança.
 * Linhas de preço do plano (entrada/stop/TPs); o stop se move (breakeven/TP1)
 * acompanhando o ciclo de vida revelado.
 */
export function SimChart({
  past,
  future,
  cutoffMs,
  revealed,
  plan,
  currentStop,
}: {
  past: Candle[];
  future: Candle[];
  /** Fim do dia simulado (ms) — separa passado e futuro na série dedupada. */
  cutoffMs: number;
  revealed: number;
  plan: SignalPlan | null;
  /** Stop vigente no estado revelado (move após TP1/TP2). */
  currentStop: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const stopLineRef = useRef<IPriceLine | null>(null);
  const [error, setError] = useState(false);

  // Série completa em segundos (formato lightweight-charts), sem duplicatas.
  const data = useMemo(() => {
    const seen = new Set<number>();
    return [...past, ...future]
      .map((c) => ({ time: Math.floor(c.time / 1000) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close }))
      .filter((c) => (seen.has(c.time) ? false : (seen.add(c.time), true)));
  }, [past, future]);
  const pastLen = useMemo(() => {
    const cutSec = Math.floor(cutoffMs / 1000);
    const i = data.findIndex((c) => c.time >= cutSec);
    return i === -1 ? data.length : i;
  }, [data, cutoffMs]);

  // Cria o gráfico uma vez por simulação (past/future novos ⇒ remonta).
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    void (async () => {
      try {
        const lc = await import("lightweight-charts");
        if (disposed || !ref.current) return;
        const container = ref.current;
        const chart = lc.createChart(container, {
          width: container.clientWidth,
          height: 360,
          layout: { background: { type: lc.ColorType.Solid, color: "transparent" }, textColor: "#93a0b6", fontFamily: "JetBrains Mono, monospace", fontSize: 11 },
          grid: { vertLines: { color: "rgba(120,160,225,0.06)" }, horzLines: { color: "rgba(120,160,225,0.06)" } },
          rightPriceScale: { borderColor: "rgba(120,170,235,0.17)" },
          timeScale: { borderColor: "rgba(120,170,235,0.17)", timeVisible: true, secondsVisible: false },
          crosshair: { mode: lc.CrosshairMode.Normal },
        });
        const series = chart.addSeries(lc.CandlestickSeries, {
          upColor: "#2bd49e", downColor: "#ff6b8a", wickUpColor: "#2bd49e", wickDownColor: "#ff6b8a", borderVisible: false,
        });
        series.setData(data.slice(0, pastLen));
        if (plan) {
          const mk = (price: number, color: string, title: string, dashed: boolean) =>
            series.createPriceLine({ price, color, lineWidth: 1, lineStyle: dashed ? lc.LineStyle.Dashed : lc.LineStyle.Solid, axisLabelVisible: true, title });
          mk(plan.entry, "#54a8ff", "ENTRADA", false);
          mk(plan.takeProfit1, "#2bd49e", "TP1", true);
          mk(plan.takeProfit2, "#2bd49e", "TP2", true);
          mk(plan.takeProfit3, "#2bd49e", "TP3", true);
          stopLineRef.current = mk(plan.stopLoss, "#ff6b8a", "STOP", false);
        }
        const cut = data[pastLen - 1];
        if (cut) {
          lc.createSeriesMarkers(series, [
            { time: cut.time, position: "aboveBar", color: "#ffb020", shape: "arrowDown", text: "CORTE" },
          ]);
        }
        // Reserva o espaço do futuro à direita — os candles revelados entram nele.
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, pastLen - 70), to: pastLen + future.length + 4 });
        ro = new ResizeObserver(() => {
          if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
        });
        ro.observe(container);
        chartRef.current = chart;
        seriesRef.current = series;
      } catch {
        if (!disposed) setError(true);
      }
    })();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      stopLineRef.current = null;
      seriesRef.current = null;
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [data]);

  // Revela candles futuros e move o stop vigente (breakeven/TP1) sem recriar nada.
  useEffect(() => {
    seriesRef.current?.setData(data.slice(0, pastLen + revealed));
  }, [data, pastLen, revealed]);
  useEffect(() => {
    if (stopLineRef.current && currentStop != null) stopLineRef.current.applyOptions({ price: currentStop });
  }, [currentStop, revealed]);

  return (
    <div className="pchart-wrap">
      <div ref={ref} className="pchart" />
      {error ? <p className="note">Não foi possível montar o gráfico agora.</p> : null}
    </div>
  );
}
