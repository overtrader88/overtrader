"use client";

import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * "Esqueci a senha" — envia o e-mail de recuperação (Supabase). O link cai em
 * /auth/callback?next=/redefinir-senha, que troca o code por sessão e leva o
 * usuário pra definir a nova senha.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/redefinir-senha")}`;
      const { error: err } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) throw err;
      setSent(true);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Não foi possível enviar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="right">
        <div className="kick">Recuperação</div>
        <h1>Confira seu e-mail</h1>
        <p className="auth-msg ok">
          Se existir uma conta com <b>{email}</b>, enviamos um link para redefinir a senha.
          Abra o e-mail e clique no link (verifique o spam).
        </p>
        <div className="foot"><a href="/login" className="link-btn">← Voltar para o login</a></div>
      </div>
    );
  }

  return (
    <form className="right" onSubmit={submit}>
      <div className="kick">Recuperação</div>
      <h1>Esqueci a senha</h1>
      <p className="note">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
      </div>

      {error ? <p className="auth-msg err">{error}</p> : null}

      <button type="submit" className="submit" disabled={busy}>
        {busy ? "Enviando…" : "Enviar link de recuperação"}
      </button>

      <div className="foot"><a href="/login" className="link-btn">← Voltar para o login</a></div>
    </form>
  );
}
