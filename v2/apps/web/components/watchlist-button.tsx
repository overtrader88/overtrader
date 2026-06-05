"use client";

import { useState } from "react";
import type { Timeframe } from "@tradeai/shared";

type State = "idle" | "saving" | "saved" | "login" | "error";

/** Botão "Acompanhar" — adiciona o ativo atual à watchlist do usuário. */
export function WatchlistButton({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  const [state, setState] = useState<State>("idle");

  async function add() {
    setState("saving");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe, min_signal_strength: "STRONG_BUY" }),
      });
      if (res.status === 401) return setState("login");
      if (!res.ok) return setState("error");
      setState("saved");
    } catch {
      setState("error");
    }
  }

  if (state === "login") {
    return <a className="wl-btn" href={`/login?next=${encodeURIComponent(`/analise?symbol=${symbol}&tf=${timeframe}`)}`}>Entrar p/ acompanhar</a>;
  }
  const label =
    state === "saved" ? "✓ Na watchlist" : state === "saving" ? "Salvando…" : state === "error" ? "Erro — tentar" : "★ Acompanhar";
  return (
    <button type="button" className="wl-btn" onClick={add} disabled={state === "saving" || state === "saved"}>
      {label}
    </button>
  );
}
