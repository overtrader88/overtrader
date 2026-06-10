"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUserDetail } from "./admin-user-detail";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  plan: string;
  credits: number;
  createdAt: string;
  hublaCode: string | null;
  periodEnd: string | null;
  analysisCount: number;
  lastAnalysisAt: string | null;
}

const PLANS = ["free", "pro", "pro_plus"] as const;

/** Iniciais (nome → 1ªs letras de 2 palavras; senão local-part do e-mail). */
function initials(email: string, fullName: string | null): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || email.slice(0, 2).toUpperCase();
  }
  return (email.split("@")[0] ?? email).slice(0, 2).toUpperCase();
}
/** Cor estável do avatar a partir do e-mail (hue determinístico). */
function avatarBg(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${(h + 38) % 360} 68% 44%))`;
}

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

  // Cortesia: data de expiração do plano (só planos pagos).
  const [courtesy, setCourtesy] = useState(user.periodEnd ? user.periodEnd.slice(0, 10) : "");
  const [pcSaving, setPcSaving] = useState(false);
  const [pcMsg, setPcMsg] = useState<string | null>(null);

  const [detail, setDetail] = useState(false);

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

  async function saveCourtesy(dateStr: string) {
    setCourtesy(dateStr);
    if (!dateStr) return;
    setPcSaving(true); setPcMsg(null);
    try {
      const r = await fetch("/api/admin/set-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan, expiresAt: dateStr, reason: "cortesia" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
      setPcMsg("✓");
      setTimeout(() => setPcMsg(null), 2000);
      router.refresh();
    } catch (e) {
      setPcMsg(e instanceof Error ? e.message : "erro");
      setTimeout(() => setPcMsg(null), 4000);
    } finally {
      setPcSaving(false);
    }
  }

  const date = new Date(user.createdAt).toLocaleDateString("pt-BR");

  return (
    <tr className="adm-row">
      <td>
        <div className="adm-user">
          <span className="adm-av" style={{ background: avatarBg(user.email) }}>{initials(user.email, user.fullName)}</span>
          <div style={{ minWidth: 0 }}>
            <button type="button" className="em" onClick={() => setDetail(true)} title="Ver perfil completo">{user.email}</button>
            {user.fullName ? <div className="sub">{user.fullName}</div> : null}
          </div>
        </div>
        {detail ? <AdminUserDetail userId={user.id} onClose={() => setDetail(false)} /> : null}
      </td>
      <td>
        {user.hublaCode ? (
          <button type="button" className="adm-hubla" onClick={() => { navigator.clipboard?.writeText(user.hublaCode as string); }} title={`Clique p/ copiar: ${user.hublaCode}`}>
            {user.hublaCode}
          </button>
        ) : (
          <span className="adm-dash">—</span>
        )}
      </td>
      <td style={{ fontVariantNumeric: "tabular-nums" }}>
        <input
          type="text"
          inputMode="numeric"
          className="adm-credits"
          value={draft}
          disabled={cSaving}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={saveCredits}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        {cSaving ? <span className="note" style={{ marginLeft: 6, fontSize: "0.75rem" }}>salvando…</span> : null}
        {cSaved ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bull)" }}>✓</span> : null}
        {cErr ? <span style={{ marginLeft: 6, fontSize: "0.75rem", color: "var(--bear)" }} title={cErr}>{cErr}</span> : null}
      </td>
      <td><span className="adm-date2">{date}</span></td>
      <td>
        <select className={`adm-plan ${plan}`} value={plan} disabled={saving} onChange={(e) => save(e.target.value)}>
          {PLANS.map((p) => <option key={p} value={p}>{p === "pro_plus" ? "PRO+" : p.toUpperCase()}</option>)}
        </select>
        {saving ? <span className="note" style={{ marginLeft: 8, fontSize: "0.75rem" }}>salvando…</span> : null}
        {saved ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bull)" }}>✓</span> : null}
        {err ? <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--bear)" }}>erro</span> : null}
        {plan !== "free" ? (
          <span className="adm-ext">
            <span className="lab">extensão até</span>
            <input type="date" className="adm-date" value={courtesy} disabled={pcSaving} onChange={(e) => saveCourtesy(e.target.value)}
              title="Define um vencimento de cortesia (aparece na aba Vencimentos)" />
            {pcMsg ? <span style={{ fontSize: "0.72rem", color: pcMsg === "✓" ? "var(--bull)" : "var(--bear)" }} title={pcMsg}>{pcMsg}</span> : null}
          </span>
        ) : null}
      </td>
      <td style={{ textAlign: "right" }}>
        <button type="button" className="adm-actions" onClick={() => setDetail(true)} aria-label="Ações do usuário" title="Ver perfil completo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
      </td>
    </tr>
  );
}
