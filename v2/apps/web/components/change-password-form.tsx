"use client";

import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Alterar senha do usuário JÁ LOGADO — usa `auth.updateUser({ password })`, que
 * só funciona com sessão ativa (não depende do link de recuperação por e-mail).
 */
export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (pw.length < 6) return setError("A senha precisa de ao menos 6 caracteres.");
    if (pw !== confirm) return setError("As senhas não coincidem.");
    setBusy(true);
    try {
      const { error: err } = await supabaseBrowser().auth.updateUser({ password: pw });
      if (err) throw err;
      setDone(true);
      setPw("");
      setConfirm("");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cpw" onSubmit={submit}>
      <div className="field">
        <label htmlFor="np">Nova senha</label>
        <input id="np" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="cp">Confirmar nova senha</label>
        <input id="cp" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••" autoComplete="new-password" />
      </div>
      {error ? <p className="cpw-msg err">{error}</p> : null}
      {done ? <p className="cpw-msg ok">Senha alterada com sucesso ✓</p> : null}
      <button type="submit" className="cpw-save" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
      <p className="cpw-hint">Mínimo de 6 caracteres. Você continua logado após alterar.</p>
    </form>
  );
}
