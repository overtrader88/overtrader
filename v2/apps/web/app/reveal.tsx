"use client";

/**
 * Observa todos os [data-rv] da página e marca data-in="1" quando entram na
 * viewport — o CSS faz a transição (com stagger via --rd). Um observer só para
 * a página inteira; cada elemento é des-observado após revelar.
 * Reduced-motion: revela tudo imediatamente.
 */
import { useEffect } from "react";

export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-rv]"));
    if (els.length === 0) return;
    // reduced-motion ou browser sem IO → revela tudo (conteúdo nunca fica oculto)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      for (const el of els) el.setAttribute("data-in", "1");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-in", "1");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);
  return null;
}
