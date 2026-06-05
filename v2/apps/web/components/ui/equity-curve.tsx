export interface EquityCurveProps {
  /** Série de capital acumulado (ex.: R acumulado por trade). */
  data: number[];
  height?: number;
  /** Id único do gradiente (há ≥1 curva por página). */
  gradientId?: string;
}

/**
 * Curva de capital (equity curve) do backtest — área + linha, com baseline no
 * zero. SVG responsivo (preserveAspectRatio none + traço não-escalável).
 */
export function EquityCurve({ data, height = 72, gradientId = "eqgrad" }: EquityCurveProps) {
  const n = data.length;
  if (n < 2) return null;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 0);
  const span = max - min || 1;
  const px = (i: number) => (i / (n - 1)) * 100;
  const py = (v: number) => height - 4 - ((v - min) / span) * (height - 8);
  const line = data.map((v, i) => `${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const area = `0,${height} ${line} 100,${height}`;
  const zeroY = py(0).toFixed(2);

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: "block" }} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(43,212,158,.28)" />
          <stop offset="1" stopColor="rgba(43,212,158,0)" />
        </linearGradient>
      </defs>
      <line x1="0" x2="100" y1={zeroY} y2={zeroY} stroke="var(--line-2)" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke="var(--bull)" strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 5px rgba(43,212,158,.4))" }} />
    </svg>
  );
}
