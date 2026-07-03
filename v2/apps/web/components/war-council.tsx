"use client";

import { useEffect, useRef, useState } from "react";
import { WAR_COUNCIL_COST } from "@/lib/billing-constants";
import type { FullAnalysis } from "@/lib/analysis/full";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Por que esse selo de qualidade?",
  "Qual o maior risco deste plano?",
  "O que invalidaria esse sinal?",
];

/**
 * CONSELHO DE GUERRA — chat pós-análise. Cada pergunta vai à /api/war-council
 * com o id salvo (ou o dto serializado, quando a análise acabou de ser gerada)
 * e o histórico recente; a resposta vem ancorada SÓ nos dados desta análise.
 * Custa 1 crédito por pergunta; falha de IA estorna no servidor.
 */
export function WarCouncil({ analysisId, dto }: { analysisId: string | null; dto: FullAnalysis }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (question.length < 3 || busy) return;
    setError(null);
    setNoCredits(false);
    setBusy(true);
    setInput("");
    const history = turns.slice(-20); // ~10 turnos — mesmo teto do servidor
    setTurns((t) => [...t, { role: "user", content: question }]);
    try {
      const res = await fetch("/api/war-council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisId ? { analysisId, question, history } : { dto, question, history }),
      });
      const d: { answer?: string; credits?: number | null; error?: string } = await res.json();
      if (!res.ok || !d.answer) {
        setTurns((t) => t.slice(0, -1)); // remove a pergunta sem resposta
        setInput(question); // devolve o texto p/ tentar de novo
        if (res.status === 402) setNoCredits(true);
        setError(d.error ?? "O Conselho não respondeu. Tente de novo.");
        return;
      }
      setTurns((t) => [...t, { role: "assistant", content: d.answer! }]);
      if (typeof d.credits === "number") setCredits(d.credits);
    } catch {
      setTurns((t) => t.slice(0, -1));
      setInput(question);
      setError("Falha de rede. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="war-council">
      {turns.length === 0 && !busy ? (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            Interrogue a IA sobre <b>esta análise</b>. As respostas usam somente os dados medidos acima — o que não
            estiver nos dados, o Conselho diz que <b>não tem</b>.
          </p>
          <div className="wc-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="wc-chip" onClick={() => ask(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="wc-log" ref={logRef}>
          {turns.map((t, i) => (
            <div className={`wc-msg ${t.role === "user" ? "user" : "ai"}`} key={i}>
              <span className="who">{t.role === "user" ? "VOCÊ" : "CONSELHO"}</span>
              {t.content}
            </div>
          ))}
          {busy ? (
            <div className="wc-msg ai">
              <span className="who">CONSELHO</span>
              <span className="wc-typing">deliberando…</span>
            </div>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="note wc-error">
          {error}
          {noCredits ? (
            <>
              {" "}
              <a href="/planos">Ver planos →</a>
            </>
          ) : null}
        </p>
      ) : null}
      <form
        className="wc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          className="wc-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre esta análise…"
          maxLength={600}
          disabled={busy}
        />
        <button type="submit" className="btn primary" disabled={busy || input.trim().length < 3}>
          {busy ? "…" : "Perguntar"}
        </button>
      </form>
      <div className="wc-meta">
        <span>
          {WAR_COUNCIL_COST} crédito por pergunta
          {credits != null ? ` · saldo ${credits}` : ""}
        </span>
        <span>ancorado nos dados desta análise · IA, não recomendação</span>
      </div>
    </div>
  );
}
