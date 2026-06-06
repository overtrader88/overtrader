"use client";

import { useState } from "react";

const BTN: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border,#cbd5e1)",
  background: "#fff", color: "#0f172a", cursor: "pointer", fontSize: "0.72rem",
};

/** Botões de reativação (e-mail / Telegram) usados nas abas Em risco e Vencimentos. */
export function NotifyButton({ userId, kind }: { userId: string; kind: "reactivate" | "expiring" }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(channel: "email" | "telegram") {
    setBusy(channel); setMsg(null);
    try {
      const r = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, channel, kind }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
      setMsg("enviado ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button type="button" disabled={!!busy} onClick={() => send("email")} style={BTN} title="Enviar e-mail de reativação">{busy === "email" ? "…" : "✉️"}</button>
      <button type="button" disabled={!!busy} onClick={() => send("telegram")} style={BTN} title="Enviar Telegram">{busy === "telegram" ? "…" : "✈️"}</button>
      {msg ? <span className="note" style={{ fontSize: "0.7rem", color: msg.includes("✓") ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }} title={msg}>{msg.includes("✓") ? "✓" : msg}</span> : null}
    </span>
  );
}
