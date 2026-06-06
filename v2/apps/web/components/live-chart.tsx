"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, IPriceLine, UTCTimestamp, LineData } from "lightweight-charts";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { ChartLine } from "@/lib/analysis/chart-overlays";
import { emaSeries, bollingerSeries } from "@/lib/analysis/indicator-series";

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
  onPrice,
  showIndicators = true,
  markers = [],
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  lines: ChartLine[];
  candleRefreshMs?: number;
  onPrice?: (p: { price: number; changePct: number }) => void;
  showIndicators?: boolean;
  markers?: { time: number; type: "Spring" | "UTAD"; side: "bull" | "bear" }[];
}) {
  const onPriceRef = useRef(onPrice);
  onPriceRef.current = onPrice;
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const indRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const markersApiRef = useRef<{ setMarkers: (m: unknown[]) => void } | null>(null);
  const markersDataRef = useRef(markers);
  markersDataRef.current = markers;
  const lastClosesRef = useRef<number[]>([]);
  const lastTimesRef = useRef<number[]>([]);
  const setIndRef = useRef<() => void>(() => {});
  const lcRef = useRef<typeof import("lightweight-charts") | null>(null);
  const linesRef = useRef<ChartLine[]>(lines);
  linesRef.current = lines;

  function applyMarkers() {
    const api = markersApiRef.current;
    if (!api) return;
    const ms = markersDataRef.current.map((m) => ({
      time: Math.floor(m.time / 1000) as UTCTimestamp,
      position: m.side === "bull" ? "belowBar" : "aboveBar",
      color: m.side === "bull" ? "#2bd49e" : "#ff6b8a",
      shape: m.side === "bull" ? "arrowUp" : "arrowDown",
      text: m.type,
      size: 1,
    }));
    api.setMarkers(ms);
  }

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
    let ws: WebSocket | null = null;

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

      // Marcadores Wyckoff (Spring/UTAD) nos candles.
      try {
        markersApiRef.current = lc.createSeriesMarkers(series, []) as unknown as { setMarkers: (m: unknown[]) => void };
        applyMarkers();
      } catch { /* versão sem markers — ignora */ }

      // Médias + Bollinger (overlay no preço) — só se ligado.
      if (showIndicators) {
        const mk = (color: string, w: 1 | 2, dashed = false) =>
          chart.addSeries(lc.LineSeries, { color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineStyle: dashed ? lc.LineStyle.Dashed : lc.LineStyle.Solid });
        indRef.current = {
          ema20: mk("#54a8ff", 2),
          ema50: mk("#ffb020", 1),
          ema200: mk("#9aa7bd", 1),
          bbU: mk("rgba(84,168,255,0.35)", 1, true),
          bbL: mk("rgba(84,168,255,0.35)", 1, true),
        };
      }

      ro = new ResizeObserver(() => { if (ref.current && chart) chart.applyOptions({ width: ref.current.clientWidth }); });
      ro.observe(container);

      function setInd() {
        const inds = indRef.current;
        if (!showIndicators || !lastClosesRef.current.length) return;
        const closes = lastClosesRef.current;
        const times = lastTimesRef.current;
        const toLine = (vals: (number | null)[]): LineData[] => {
          const out: LineData[] = [];
          for (let i = 0; i < vals.length; i++) { const v = vals[i]; if (v != null && Number.isFinite(v)) out.push({ time: times[i] as UTCTimestamp, value: v }); }
          return out;
        };
        const bb = bollingerSeries(closes, 20, 2);
        inds.ema20?.setData(toLine(emaSeries(closes, 20)));
        inds.ema50?.setData(toLine(emaSeries(closes, 50)));
        inds.ema200?.setData(toLine(emaSeries(closes, 200)));
        inds.bbU?.setData(toLine(bb.upper));
        inds.bbL?.setData(toLine(bb.lower));
      }
      setIndRef.current = setInd;

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
          lastClosesRef.current = data.candles.map((c) => c.close);
          lastTimesRef.current = data.candles.map((c) => c.time);
          setIndRef.current(); // médias + Bollinger
          const cs = data.candles;
          const last = cs[cs.length - 1];
          const prev = cs[cs.length - 2];
          if (last && onPriceRef.current) {
            const changePct = prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0;
            onPriceRef.current({ price: last.close, changePct });
          }
        } catch { /* silencioso — tenta de novo no próximo tick */ }
      }

      await loadCandles(true);
      if (disposed) return;

      if (assetType === "crypto") {
        // WebSocket Binance — candle AO VIVO (tick-a-tick). REST só resync lento.
        try {
          ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${timeframe}`);
          ws.onmessage = (ev) => {
            try {
              const k = (JSON.parse(ev.data as string) as { k?: { t: number; o: string; h: string; l: string; c: string } }).k;
              const s = seriesRef.current;
              if (!k || !s) return;
              const t = Math.floor(k.t / 1000) as UTCTimestamp;
              const close = Number(k.c);
              s.update({ time: t, open: Number(k.o), high: Number(k.h), low: Number(k.l), close });
              // mantém arrays de closes/times p/ recomputar médias ao vivo
              const times = lastTimesRef.current; const closes = lastClosesRef.current;
              if (times.length && times[times.length - 1] === Math.floor(k.t / 1000)) { closes[closes.length - 1] = close; }
              else { times.push(Math.floor(k.t / 1000)); closes.push(close); }
              setIndRef.current();
              if (onPriceRef.current) {
                const prev = closes[closes.length - 2];
                onPriceRef.current({ price: close, changePct: prev ? ((close - prev) / prev) * 100 : 0 });
              }
            } catch { /* ignora msg malformada */ }
          };
        } catch { /* sem ws → cai no resync REST abaixo */ }
        timer = setInterval(() => loadCandles(false), 60000); // resync histórico/indicadores
      } else {
        timer = setInterval(() => loadCandles(false), candleRefreshMs);
      }
    })();

    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      if (timer) clearInterval(timer);
      if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }
      if (chartRef.current) chartRef.current.remove();
      chartRef.current = null; seriesRef.current = null; priceLinesRef.current = []; indRef.current = {}; markersApiRef.current = null; setIndRef.current = () => {}; lcRef.current = null;
    };
  }, [symbol, assetType, timeframe, candleRefreshMs, showIndicators]);

  // Quando a análise muda (novas linhas), redesenha sem reconstruir o chart.
  useEffect(() => { redrawLines(); }, [lines]);
  // Marcadores Wyckoff atualizados.
  useEffect(() => { applyMarkers(); }, [markers]);

  return <div ref={ref} style={{ width: "100%", minHeight: 440 }} />;
}
