"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface RadialGaugeProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  decimals?: number;
  /** Anel sólido cyan (true) ou gradiente teal→cyan (false). */
  solid?: boolean;
  /** Mostra "/100" ao lado do número. */
  showOutOf?: boolean;
  /** Legenda curta abaixo do número. */
  caption?: string;
}

/**
 * Medidor radial animado (anel preenche + número conta) na montagem.
 * Respeita prefers-reduced-motion. Reutilizável (força do sinal, RSI, etc.).
 */
export function RadialGauge({
  value,
  max = 100,
  size = 172,
  stroke = 9,
  decimals = 0,
  solid = false,
  showOutOf = false,
  caption,
}: RadialGaugeProps) {
  const r = Math.round(size * 0.42);
  const circ = 2 * Math.PI * r;
  const gid = "rg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [disp, setDisp] = useState(0);
  const [offset, setOffset] = useState(circ);
  const raf = useRef<number>(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, value / max));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) {
      setDisp(value);
      setOffset(circ * (1 - target));
      return;
    }
    const t = setTimeout(() => setOffset(circ * (1 - target)), 60);
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisp(value * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf.current);
    };
  }, [value, max, circ]);

  const center = size / 2;
  const numStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    fontSize: size > 150 ? 42 : 27,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", overflow: "visible" }} aria-hidden>
        {!solid && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2BD49E" />
              <stop offset="1" stopColor="#54A8FF" />
            </linearGradient>
          </defs>
        )}
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(120,160,225,.12)" strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={solid ? "#54A8FF" : `url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 8px rgba(84,168,255,.5))" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={numStyle}>
            {disp.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
            {showOutOf ? <span style={{ fontSize: 14, color: "var(--ink-faint)" }}>/100</span> : null}
          </div>
          {caption ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: size > 150 ? 9 : 8.5, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--cyan)", marginTop: 5 }}>
              {caption}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
