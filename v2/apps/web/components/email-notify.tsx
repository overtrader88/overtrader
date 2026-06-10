"use client";

import { useEffect, useState } from "react";

/**
 * Opt-in de alertas por e-mail (Fase C2). Persiste profiles.notify_email via
 * /api/notify-prefs. O envio real só acontece se o Resend estiver configurado
 * no servidor (RESEND_API_KEY/EMAIL_FROM) — senão fica como preferência salva.
 */
export function EmailNotify() {
  const [on, setOn] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/notify-prefs")
      .then((r) => (r.ok ? r.json() : { notifyEmail: false }))
      .then((d: { notifyEmail?: boolean; email?: string }) => {
        setOn(!!d.notifyEmail);
        setEmail(d.email);
      })
      .catch(() => setOn(false));
  }, []);

  async function toggle() {
    if (on === null || saving) return;
    const next = !on;
    setSaving(true);
    setErr(false);
    setOn(next); // otimista
    try {
      const r = await fetch("/api/notify-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setOn(!next); // reverte
      setErr(true);
      setTimeout(() => setErr(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (on === null) return null;

  return (
    <div className="tg-connect">
      <div className="tg-l">
        <span className="tg-ico" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
        </span>
        <div>
          <div className="tg-t">E-mail {on ? "ativado" : "para alertas"}</div>
          <div className="note">
            {on ? (
              <>Os alertas da watchlist também chegam em <span className="tg-mail">{email ?? "seu e-mail"}</span>.</>
            ) : (
              "Receba os alertas da watchlist por e-mail, além do app."
            )}
            {err ? <span style={{ color: "var(--bear)" }}> · falhou ao salvar, tente de novo</span> : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        className={`tg-btn${on ? " ghost" : ""}`}
        onClick={toggle}
        disabled={saving}
        aria-pressed={on}
      >
        {saving ? "Salvando…" : on ? "Desativar" : "Ativar e-mail"}
      </button>
    </div>
  );
}
