"use client";

import { useEffect } from "react";

/** Marca os alertas do usuário como lidos ao abrir a página (PATCH /api/alerts). */
export function MarkAlertsRead() {
  useEffect(() => {
    fetch("/api/alerts", { method: "PATCH" }).catch(() => {});
  }, []);
  return null;
}
