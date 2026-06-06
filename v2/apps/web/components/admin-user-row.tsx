"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  credits: number;
  createdAt: string;
  hublaCode: string | null;
  periodEnd: string | null;
}

const PLANS = ["free", "pro", "pro_plus"] as const;

// Campos legíveis sobre o tema escuro (fundo claro + texto escuro).
const FIELD: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid var(--border,#cbd5e1)",
  background: "#fff",
  color: "#0f172a",
};

/** Linha da tabela admin: mostra o usuário e permite trocar o plano e os créditos. */
export function AdminUserRow({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [plan, setPlan] = useState(user.plan);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(false);

  // Créditos (editável). `credits` é o saldo confirmado; `draft` é o input.
  const [credits, setCredits] = useState(user.credits);
  const [draft, setDraft] = useState(String(user.credits));
  const [cSaving, setCSaving] = useState(false);
  const [cSaved, setCSaved] = useState(false);
  const [cErr, setCErr] = useState<string | null>(null);

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
      router.refresh();
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
    if (draft.trim() === "" || !Number.isInteger(value) || value < 0) {
      setCErr("inválido"); setDraft(String(credits));
      setTimeout(() => setCErr(null), 3000);
      return;
    }
    if (value === credits) return; // nada mudou
    setCSaving(true); setCSaved(false); setCErr(null);
    try {
      const r = await fetch("/api/admin/set-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, credits: value }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
      setCredits(value);
      setCSaved(true);
      setTimeout(() => setCSaved(false), 2000);
      router.refresh();
    } catch (e) {
      setCErr(e instanceof Error ? e.message : "erro");
      setDraft(String(credits));
      setTimeout(() => setCErr(null), 5000);
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
      <td style={{ padding: "8px 10px" }}>
        {user.hublaCode ? (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(user.hublaCode as string); }}
            title={`Clique p/ copiar: ${user.hublaCode}`}
            style={{
              maxWidth: 180, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: "0.75rem",
              padding: "2px 6px", borderRadius: 6, border: "1px solid var(--border,#cbd5e1)", background: "#fff", color: "#0f172a",
              cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block",
            }}
          >
            {user.hublaCode}
          </button>
        ) : (
          <span className="note" style={{ fontSize: "0.8rem" }}>—</span>
        )}
      </td>
      <td style={{ padding: "8px 10px", fontVariantNumeric: "tabular-nums" }}>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={cSaving}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={saveCredits}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{ ...FIELD, width: 80, fontVariantNumeric: "tabular-nums" }}
        />
        {cSaving ? <span className="note" style={{ marginLeft: 6, fontSize: "0.75rem" }}>salvando…</span> : null}
        {cSaved ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bull,#16a34a)" }}>✓</span> : null}
        {cErr ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bear,#dc2626)" }} title={cErr}>{cErr}</span> : null}
      </td>
      <td style={{ padding: "8px 10px" }} className="note">{date}</td>
      <td style={{ padding: "8px 10px" }}>
        <select value={plan} disabled={saving} onChange={(e) => save(e.target.value)} style={FIELD}>
          {PLANS.map((p) => <option key={p} value={p}>{p === "pro_plus" ? "PRO+" : p.toUpperCase()}</option>)}
        </select>
        {saving ? <span className="note" style={{ marginLeft: 8, fontSize: "0.75rem" }}>salvando…</span> : null}
        {saved ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bull,#16a34a)" }}>✓</span> : null}
        {err ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bear,#dc2626)" }}>erro</span> : null}
      </td>
    </tr>
  );
}
