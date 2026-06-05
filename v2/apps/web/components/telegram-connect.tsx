"use client";

import { useEffect, useState } from "react";

/**
 * Conectar Telegram (Fase C5) — gera o deep link de pareamento e abre o bot.
 * Mostra o status do vínculo. Os alertas da watchlist passam a chegar por DM.
 */
export function TelegramConnect() {
  const [linked, setLinked] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    fetch("/api/telegram/link")
      .then((r) => (r.ok ? r.json() : { linked: false }))
      .then((d: { linked?: boolean }) => setLinked(!!d.linked))
      .catch(() => setLinked(false));
  }, []);

  async function connect() {
    setState("loading");
    try {
      const r = await fetch("/api/telegram/link", { method: "POST" });
      const d: { url?: string } = await r.json();
      if (!r.ok || !d.url) throw new Error();
      setUrl(d.url);
      window.open(d.url, "_blank", "noopener");
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  if (linked === null) return null;

  return (
    <div className="tg-connect">
      <div className="tg-l">
        <span className="tg-i">✈</span>
        <div>
          <div className="tg-t">Telegram {linked ? "conectado" : "para alertas por DM"}</div>
          <div className="note">
            {linked
              ? "Os alertas da sua watchlist chegam no seu Telegram. Envie /stop no bot para desconectar."
              : "Receba os alertas da watchlist direto no Telegram, em tempo real."}
          </div>
          {url ? <div className="note" style={{ marginTop: 4 }}>Não abriu? <a href={url} target="_blank" rel="noopener" style={{ color: "var(--cyan)" }}>Abrir o bot</a></div> : null}
        </div>
      </div>
      {!linked ? (
        <button type="button" className="tg-btn" onClick={connect} disabled={state === "loading"}>
          {state === "loading" ? "Gerando link…" : state === "error" ? "Falhou — tentar de novo" : "Conectar Telegram"}
        </button>
      ) : (
        <span className="tg-ok">✓ ativo</span>
      )}
    </div>
  );
}
