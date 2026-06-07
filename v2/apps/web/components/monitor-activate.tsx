"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Tela de ativação do Monitor (PRO/PRO+ · 20 créditos / 5 dias). */
export function MonitorActivate({ canActivate, credits }: { canActivate: boolean; credits: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function activate() {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/monitor/activate", { method: "POST" });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && data.ok) { router.refresh(); return; }
      setErr(data.error ?? "Falha ao ativar.");
    } catch {
      setErr("Falha de rede ao ativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mon-activate">
      <div className="ma-card">
        <div className="ma-ico">📡</div>
        <h2>Ativar o Monitor ao vivo</h2>
        <p className="note">
          Acompanhe preço, regime e sinais dos mercados em tempo real. A ativação custa <b>20 créditos</b> e libera{" "}
          <b>5 dias</b> de uso. Ao expirar, reative por mais 20.
        </p>
        {canActivate ? (
          <>
            <button type="button" className="btn primary" onClick={activate} disabled={busy || credits < 20}>
              {busy ? "Ativando…" : credits < 20 ? "Créditos insuficientes (20)" : "Ativar por 20 créditos · 5 dias"}
            </button>
            <div className="ma-bal">Seu saldo: <b>{credits}</b> créditos</div>
          </>
        ) : (
          <>
            <p className="note" style={{ color: "var(--amber)" }}>O Monitor é exclusivo para assinantes <b>PRO</b> e <b>PRO+</b>.</p>
            <a href="/planos" className="btn primary">Ver planos →</a>
          </>
        )}
        {err ? <p className="auth-msg err" style={{ marginTop: 10 }}>{err}</p> : null}
      </div>
    </div>
  );
}
