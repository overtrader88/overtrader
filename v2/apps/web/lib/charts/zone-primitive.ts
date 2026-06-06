/**
 * Primitive de ZONAS preenchidas para lightweight-charts v5 — desenha retângulos
 * sombreados (order blocks, FVG, value area) que se estendem do candle de origem
 * até a borda direita, com rótulo. Renderiza ATRÁS dos candles (zOrder bottom).
 *
 * Tipagem propositalmente frouxa (o alvo de canvas é da fancy-canvas) — guardamos
 * nulls e qualquer erro de desenho não derruba o gráfico.
 */
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";

export interface ChartZone {
  top: number;
  bottom: number;
  from: number; // segundos (UTCTimestamp) ou 0 = começo do gráfico
  fill: string;
  border: string;
  label: string;
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

export function createZonePrimitive() {
  let zones: ChartZone[] = [];
  let chart: IChartApi | null = null;
  let series: ISeriesApi<SeriesType> | null = null;
  let requestUpdate: (() => void) | null = null;

  const renderer = {
    draw(target: { useBitmapCoordinateSpace: (cb: (scope: BitmapScope) => void) => void }) {
      try {
        target.useBitmapCoordinateSpace((scope) => {
          if (!series || !chart || zones.length === 0) return;
          const ctx = scope.context;
          const hr = scope.horizontalPixelRatio;
          const vr = scope.verticalPixelRatio;
          const ts = chart.timeScale();
          const width = scope.bitmapSize.width;
          ctx.save();
          for (const z of zones) {
            const yTop = series.priceToCoordinate(z.top);
            const yBot = series.priceToCoordinate(z.bottom);
            if (yTop == null || yBot == null) continue;
            let x = 0;
            if (z.from > 0) {
              const cx = ts.timeToCoordinate(z.from as Time);
              if (cx != null) x = cx * hr;
            }
            const y1 = Math.min(yTop, yBot) * vr;
            const y2 = Math.max(yTop, yBot) * vr;
            const w = Math.max(0, width - x);
            ctx.fillStyle = z.fill;
            ctx.fillRect(x, y1, w, y2 - y1);
            ctx.strokeStyle = z.border;
            ctx.lineWidth = Math.max(1, hr);
            ctx.strokeRect(x, y1, w, y2 - y1);
            ctx.fillStyle = z.border;
            ctx.font = `${Math.round(10 * vr)}px JetBrains Mono, monospace`;
            ctx.textBaseline = "top";
            ctx.fillText(z.label, x + 4 * hr, y1 + 2 * vr);
          }
          ctx.restore();
        });
      } catch { /* desenho falhou — não derruba o gráfico */ }
    },
  };

  const paneView = { renderer: () => renderer, zOrder: () => "bottom" as const };

  return {
    primitive: {
      attached(p: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }) {
        chart = p.chart; series = p.series; requestUpdate = p.requestUpdate;
      },
      detached() { chart = null; series = null; requestUpdate = null; },
      paneViews() { return [paneView]; },
      updateAllViews() { /* estado vem de setZones */ },
    },
    setZones(z: ChartZone[]) { zones = z; requestUpdate?.(); },
  };
}
