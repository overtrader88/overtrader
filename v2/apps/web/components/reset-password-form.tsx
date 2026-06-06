"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * "Definir nova senha" — usada após o link de recuperação. O /auth/callback já
 * trocou o code por sessão (recovery); aqui só validamos que há sessão e
 * chamamos updateUser({ password }). Sem sessão → manda recomeçar.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("A senha precisa de ao menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const { error: err } = await sb.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  if (ready === null) return <div className="right"><p className="note">Carregando…</p></div>;

  if (!ready) {
    return (
      <div className="right">
        <div className="kick">Recuperação</div>
        <h1>Link inválido ou expirado</h1>
        <p className="auth-msg err">O link de recuperação não é mais válido. Peça um novo.</p>
        <div className="foot"><a href="/recuperar" className="link-btn">Pedir novo link →</a></div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="right">
        <div className="kick">Recuperação</div>
        <h1>Senha atualizada ✓</h1>
        <p className="auth-msg ok">Pronto! Redirecionando para o painel…</p>
      </div>
    );
  }

  return (
    <form className="right" onSubmit={submit}>
      <div className="kick">Recuperação</div>
      <h1>Definir nova senha</h1>
      <div className="field">
        <label htmlFor="np">Nova senha</label>
        <input id="np" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="cp">Confirmar senha</label>
        <input id="cp" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••" autoComplete="new-password" />
      </div>
      {error ? <p className="auth-msg err">{error}</p> : null}
      <button type="submit" className="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
