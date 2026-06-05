"use client";

import { useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";

type State = "idle" | "loading" | "done" | "error" | "unconfigured";

/** Leitura em linguagem natural (IA), sob demanda e grounded nos números. */
export function AiNarrative({
  symbol,
  assetType,
  timeframe,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
}) {
  const [state, setState] = useState<State>("idle");
  const [text, setText] = useState("");

  async function generate() {
    setState("loading");
    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, assetType, timeframe }),
      });
      if (res.status === 503) return setState("unconfigured");
      const d: { narrative?: string } = await res.json();
      if (!res.ok || !d.narrative) return setState("error");
      setText(d.narrative);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      {state === "done" ? <p className="ai-text">{text}</p> : null}
      {state === "unconfigured" ? <p className="note">Narrativa de IA não configurada (defina OPENAI_API_KEY).</p> : null}
      {state === "error" ? <p className="note">Não foi possível gerar a leitura agora. Tente novamente.</p> : null}
      {state !== "done" && state !== "unconfigured" ? (
        <button type="button" className="btn" onClick={generate} disabled={state === "loading"}>
          {state === "loading" ? "Gerando leitura…" : state === "error" ? "Tentar de novo" : "Gerar leitura em linguagem natural"}
        </button>
      ) : null}
      <p className="ai-disc">Texto gerado por IA a partir dos números medidos — análise, não recomendação de investimento.</p>
    </div>
  );
}
