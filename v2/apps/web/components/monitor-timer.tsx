"use client";

import { useEffect, useState } from "react";

/** Card "AO VIVO" com countdown até a expiração da sessão do monitor + loader circular. */
export function MonitorTimer({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let label = "—";
  if (expiresAt && now != null) {
    const ms = Math.max(0, new Date(expiresAt).getTime() - now);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    label = `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  return (
    <div className="mon-timer">
      <div className="mt-l">
        <span className="mt-live"><span className="dot" /> AO VIVO</span>
        <span className="mt-sub">Atualiza a cada 45s</span>
      </div>
      <span className="mt-count" suppressHydrationWarning>{label}</span>
      <span className="mt-ring" aria-hidden>
        <svg viewBox="0 0 36 36">
          <circle className="mt-ring-t" cx="18" cy="18" r="15" />
          <circle className="mt-ring-p" cx="18" cy="18" r="15" />
        </svg>
      </span>
    </div>
  );
}
