"use client";

import { useEffect, useState } from "react";

/** Badge de alertas não lidos no nav (busca /api/alerts no mount). */
export function AlertsNavBadge() {
  const [n, setN] = useState(0);
  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d: { unread?: number }) => setN(d.unread ?? 0))
      .catch(() => {});
  }, []);
  if (n <= 0) return null;
  return <span className="nav-badge">{n > 9 ? "9+" : n}</span>;
}
