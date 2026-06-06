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

  // Créditos (editável). `credits` é o saldo confirmado; `draft` é o input.
  const [credits, setCredits] = useState(user.credits);
  const [draft, setDraft] = useState(String(user.credits));
  const [cSaving, setCSaving] = useState(false);
  const [cSaved, setCSaved] = useState(false);
  const [cErr, setCErr] = useState(false);

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

  async function saveCredits() {
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 0) {
      setCErr(true); setDraft(String(credits));
      setTimeout(() => setCErr(false), 3000);
      return;
    }
    if (value === credits) return; // nada mudou
    setCSaving(true); setCSaved(false); setCErr(false);
    try {
      const r = await fetch("/api/admin/set-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, credits: value }),
      });
      if (!r.ok) throw new Error();
      setCredits(value);
      setCSaved(true);
      setTimeout(() => setCSaved(false), 2000);
    } catch {
      setCErr(true);
      setDraft(String(credits));
      setTimeout(() => setCErr(false), 3000);
    } finally {
      setCSaving(false);
    }
  }

  const date = new Date(user.createdAt).toLocaleDateString("pt-BR");

  return (
    <tr style={{ borderBottom: "1px solid var(--border-faint,#e4e8ef)" }}>
      <td style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 600 }}>{user.email}</div>
        {user.fullName ? <div className="note" style={{ fontSize: "0.75rem" }}>{user.fullName}</div> : null}
      </td>
      <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>
        <input
          type="number"
          min={0}
          value={draft}
          disabled={cSaving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveCredits}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{ width: 72, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border,#cbd5e1)", fontVariantNumeric: "tabular-nums" }}
        />
        {cSaving ? <span className="note" style={{ marginLeft: 6, fontSize: "0.75rem" }}>salvando…</span> : null}
        {cSaved ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bull,#16a34a)" }}>✓</span> : null}
        {cErr ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bear,#dc2626)" }}>erro</span> : null}
      </td>
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
