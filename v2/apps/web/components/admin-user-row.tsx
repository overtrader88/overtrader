"use client";

import { useState } from "react";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  credits: number;
  createdAt: string;
}

const PLANS = ["free", "pro", "pro_plus"] as const;

/** Linha da tabela admin: mostra o usuário e permite trocar o plano. */
export function AdminUserRow({ user }: { user: AdminUser }) {
  const [plan, setPlan] = useState(user.plan);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(false);

  async function save(newPlan: string) {
    setPlan(newPlan);
    setSaving(true); setSaved(false); setErr(false);
    try {
      const r = await fetch("/api/admin/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: newPlan }),
      });
      if (!r.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setErr(true);
      setPlan(user.plan);
      setTimeout(() => setErr(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const date = new Date(user.createdAt).toLocaleDateString("pt-BR");

  return (
    <tr style={{ borderBottom: "1px solid var(--border-faint,#e4e8ef)" }}>
      <td style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 600 }}>{user.email}</div>
        {user.fullName ? <div className="note" style={{ fontSize: "0.75rem" }}>{user.fullName}</div> : null}
      </td>
      <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>{user.credits}</td>
      <td style={{ padding: "8px 10px" }} className="note">{date}</td>
      <td style={{ padding: "8px 10px" }}>
        <select value={plan} disabled={saving} onChange={(e) => save(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border,#cbd5e1)" }}>
          {PLANS.map((p) => <option key={p} value={p}>{p === "pro_plus" ? "PRO+" : p.toUpperCase()}</option>)}
        </select>
        {saving ? <span className="note" style={{ marginLeft: 8, fontSize: "0.75rem" }}>salvando…</span> : null}
        {saved ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bull,#16a34a)" }}>✓</span> : null}
        {err ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bear,#dc2626)" }}>erro</span> : null}
      </td>
    </tr>
  );
}
