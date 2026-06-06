"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Mode = "signin" | "signup";

/** Formulário de acesso (email + senha) com cadastro e Google (OAuth). */
export function LoginForm({ next, initialMode = "signin" }: { next: string; initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const dest = next && next.startsWith("/") ? next : "/dashboard";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const sb = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error: err } = await sb.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.push(dest);
        router.refresh();
      } else {
        const { data, error: err } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (err) throw err;
        if (data.session) {
          router.push(dest);
          router.refresh();
        } else {
          setInfo("Conta criada! Se pedirmos confirmação por e-mail, confirme e então entre.");
          setMode("signin");
        }
      }
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Falha na autenticação.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
    });
    if (err) setError(err.message);
  }

  return (
    <form className="right" onSubmit={submit}>
      <div className="kick">Acesso à conta</div>
      <h1>{mode === "signin" ? "Entrar" : "Criar conta"}</h1>

      {mode === "signup" ? (
        <div className="field">
          <label htmlFor="nome">Nome</label>
          <input id="nome" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
        {mode === "signin" ? (
          <a href="/recuperar" className="link-btn" style={{ alignSelf: "flex-end", marginTop: 6, fontSize: "0.8rem" }}>Esqueci a senha</a>
        ) : null}
      </div>

      {error ? <p className="auth-msg err">{error}</p> : null}
      {info ? <p className="auth-msg ok">{info}</p> : null}

      <button type="submit" className="submit" disabled={busy}>
        {busy ? "Processando…" : mode === "signin" ? "Entrar" : "Criar conta grátis"}
      </button>

      <div className="divider">ou continue com</div>
      <button type="button" className="alt" onClick={google} disabled={busy}>
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
          <path fill="#fff" d="M17.6 9.2c0-.6-.05-1.2-.16-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
          <path fill="#fff" opacity=".7" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
          <path fill="#fff" opacity=".5" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z" />
          <path fill="#fff" opacity=".85" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
        </svg>
        Google
      </button>

      <div className="foot">
        {mode === "signin" ? (
          <>Não tem conta? <button type="button" className="link-btn" onClick={() => { setMode("signup"); setError(null); }}>Criar conta grátis →</button></>
        ) : (
          <>Já tem conta? <button type="button" className="link-btn" onClick={() => { setMode("signin"); setError(null); }}>Entrar →</button></>
        )}
      </div>
    </form>
  );
}
