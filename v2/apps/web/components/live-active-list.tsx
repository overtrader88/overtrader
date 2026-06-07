"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ActiveLiveItem { symbol: string; name: string; activatedAt: string; }

/** Lista das lives ativas do usuário, com botão de desligar (encerra o metering). */
export function LiveActiveList({ items }: { items: ActiveLiveItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState(items);

  async function turnOff(symbol: string) {
    setBusy(symbol);
    try {
      await fetch("/api/live", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol }) });
      setList((l) => l.filter((x) => x.symbol !== symbol));
      router.refresh();
    } finally { setBusy(null); }
  }

  if (list.length === 0) return <p className="note" style={{ padding: "6px 2px" }}>Nenhuma live ativa. Ative em <a href="/ao-vivo" style={{ color: "var(--cyan)" }}>Trading ao vivo</a>.</p>;

  return (
    <div className="cr-lives">
      {list.map((it) => (
        <div className="cr-live" key={it.symbol}>
          <span className="cr-live-sym"><span className="cr-dot" /><b>{it.symbol}</b> <small>{it.name}</small></span>
          <span className="cr-live-rate">−2 créditos/h</span>
          <span className="cr-live-since">desde {new Date(it.activatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          <div className="cr-live-act">
            <a className="cr-link" href={`/ao-vivo?symbol=${encodeURIComponent(it.symbol)}`}>Acessar</a>
            <button type="button" className="cr-off" disabled={busy === it.symbol} onClick={() => turnOff(it.symbol)}>
              {busy === it.symbol ? "…" : "Desligar"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
