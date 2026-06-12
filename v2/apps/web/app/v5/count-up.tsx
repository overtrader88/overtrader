"use client";

/**
 * Contador que sobe quando entra na viewport (rAF + ease-out, 1×).
 * Reduced-motion / fallback: mostra o valor final direto.
 */
import { useEffect, useRef, useState } from "react";

export function CountUp({ to, suffix = "", duration = 1100 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setVal(to); return; } // fallback: valor final
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        io.disconnect();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setVal(to);
          return;
        }
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{val}{suffix}</span>;
}
