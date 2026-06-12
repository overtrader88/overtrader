"use client";

/**
 * Gauge de confluência animado: o arco preenche (transição CSS de
 * stroke-dasharray) e o número sobe (rAF) quando entra na viewport.
 * Reduced-motion: estado final imediato.
 */
import { useEffect, useRef, useState } from "react";
import s from "./page.module.css";

export function GaugeAnim({ value = 72, size = 200 }: { value?: number; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const started = useRef(false);

  const stroke = 13;
  const c = size / 2;
  const r = c - stroke;
  const C = 2 * Math.PI * r;
  const SPAN = 0.75; // 270°
  const progress = (n / 100) * SPAN * C;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setN(value); return; } // fallback: estado final
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setN(value);
          return;
        }
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / 1200);
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <div ref={ref} className={s.gaugeBox}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score de confluência: ${value} de 100`}>
        <g transform={`rotate(135 ${c} ${c})`}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${SPAN * C} ${C}`} />
          <circle className={s.garc} cx={c} cy={c} r={r} fill="none" stroke="var(--cyan)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${progress} ${C}`} style={{ filter: "drop-shadow(0 0 10px var(--glow))" }} />
        </g>
        <text className={s.gtxt} x={c} y={c - 2} textAnchor="middle" dominantBaseline="central">{n}</text>
        <text className={s.gsub} x={c} y={c + 24} textAnchor="middle">/ 100</text>
      </svg>
      <div className={s.gcap}>score de confluência</div>
    </div>
  );
}
