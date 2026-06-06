/**
 * Primitive de VOLUME PROFILE (histograma lateral volume-por-preço) para
 * lightweight-charts v5 — barras horizontais na margem direita, proporcionais ao
 * volume de cada faixa. POC em destaque (âmbar), Value Area em cyan, resto fraco.
 * Igual ao look da concorrência. Tipagem frouxa + try/catch (não derruba o chart).
 */
import type { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";

export interface VolumeProfileData {
  bins: { price: number; volume: number }[];
  poc: number;
  vah: number;
  val: number;
  binSize: number;
}

interface BitmapScope {
  context: CanvasRenderingContext2D;
  bitmapSize: { width: number; height: number };
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

export function createVolumeProfilePrimitive() {
  let data: VolumeProfileData | null = null;
  let series: ISeriesApi<SeriesType> | null = null;
  let requestUpdate: (() => void) | null = null;

  const renderer = {
    draw(target: { useBitmapCoordinateSpace: (cb: (s: BitmapScope) => void) => void }) {
      try {
        target.useBitmapCoordinateSpace((scope) => {
          if (!series || !data || data.bins.length === 0) return;
          const ctx = scope.context;
          const hr = scope.horizontalPixelRatio;
          const vr = scope.verticalPixelRatio;
          const W = scope.bitmapSize.width;
          const maxBar = Math.min(170 * hr, W * 0.24);
          const maxVol = Math.max(...data.bins.map((b) => b.volume), 1);
          ctx.save();
          for (const b of data.bins) {
            if (b.volume <= 0) continue;
            const y = series.priceToCoordinate(b.price);
            const yNext = series.priceToCoordinate(b.price + data.binSize);
            if (y == null) continue;
            const h = yNext != null ? Math.max(1, Math.abs(y - yNext) * vr * 0.86) : 2 * vr;
            const w = (b.volume / maxVol) * maxBar;
            const x = W - w;
            const inVA = b.price >= data.val && b.price <= data.vah;
            const isPoc = Math.abs(b.price - data.poc) <= data.binSize / 2;
            ctx.fillStyle = isPoc ? "rgba(255,176,32,0.55)" : inVA ? "rgba(84,168,255,0.30)" : "rgba(120,160,225,0.14)";
            ctx.fillRect(x, y * vr - h / 2, w, h);
          }
          ctx.restore();
        });
      } catch { /* não derruba o gráfico */ }
    },
  };

  const paneView = { renderer: () => renderer, zOrder: () => "bottom" as const };

  return {
    primitive: {
      attached(p: { chart: IChartApi; series: ISeriesApi<SeriesType>; requestUpdate: () => void }) {
        series = p.series; requestUpdate = p.requestUpdate;
      },
      detached() { series = null; requestUpdate = null; },
      paneViews() { return [paneView]; },
      updateAllViews() { /* estado vem de setData */ },
    },
    setData(d: VolumeProfileData | null) { data = d; requestUpdate?.(); },
  };
}
