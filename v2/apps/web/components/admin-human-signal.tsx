"use client";

/**
 * DESAFIO HUMANOS vs MÁQUINAS — form do /admin (aba Motores) p/ registrar o
 * sinal de um competidor HUMANO no mesmo track record forward dos motores.
 * POST /api/admin/human-signal → RPC record_signal com engine="humano_<slug>".
 * O plano é manual (entrada/stop/tp1-3); o cron resolve-signals é o juiz.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKED_MARKETS } from "@/lib/signals/tracked";
import { HUMAN_ENGINE_COLOR, slugifyCompetitor, validateHumanPlan } from "@/lib/signals/human";

const FIELD: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line-2)",
  background: "var(--panel-2)", color: "var(--ink)", fontSize: "0.85rem",
};
const LBL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "#aebccd" };
const ASSET_PT: Record<string, string> = {
  crypto: "Cripto", forex: "Forex", commodities: "Commodities", indices: "Índices", stocks: "Ações",
};

/** Aceita vírgula como separador decimal (padrão BR). */
const num = (s: string): number => Number(s.trim().replace(",", "."));

export function AdminHumanSignal() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [market, setMarket] = useState(0); // índice em TRACKED_MARKETS
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [strong, setStrong] = useState(false);
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [tp1, setTp1] = useState("");
  const [tp2, setTp2] = useState("");
  const [tp3, setTp3] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const slug = useMemo(() => slugifyCompetitor(name), [name]);
  const m = TRACKED_MARKETS[market] ?? TRACKED_MARKETS[0]!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const plan = { side, entry: num(entry), stop: num(stop), tp1: num(tp1), tp2: num(tp2), tp3: num(tp3) };
    if (!slug) { setMsg({ ok: false, text: "Informe o nome do competidor." }); return; }
    if ([plan.entry, plan.stop, plan.tp1, plan.tp2, plan.tp3].some((v) => !Number.isFinite(v) || v <= 0)) {
      setMsg({ ok: false, text: "Preencha entrada, stop e os 3 alvos com números positivos." }); return;
    }
    const planError = validateHumanPlan(plan);
    if (planError) { setMsg({ ok: false, text: planError }); return; }

    setBusy(true);
    try {
      const r = await fetch("/api/admin/human-signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, symbol: m.symbol, assetType: m.assetType, timeframe: m.timeframe, strong, ...plan }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string; engine?: string };
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMsg({ ok: true, text: `Sinal registrado ✓ — ${data.engine} em ${m.symbol} ${m.timeframe.toUpperCase()}. O cron resolve o desfecho.` });
      setEntry(""); setStop(""); setTp1(""); setTp2(""); setTp3("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro ao registrar." });
    } finally {
      setBusy(false);
    }
  }

  const sideBtn = (v: "buy" | "sell", color: string): React.CSSProperties => ({
    ...FIELD, cursor: "pointer", fontWeight: side === v ? 800 : 500,
    background: side === v ? `color-mix(in srgb, ${color} 18%, transparent)` : "var(--panel-2)",
    borderColor: side === v ? color : "var(--line-2)", color: side === v ? color : "var(--ink-soft)",
  });

  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: 14, padding: "15px 18px", marginBottom: 18, background: `linear-gradient(135deg, color-mix(in srgb, ${HUMAN_ENGINE_COLOR} 8%, transparent), transparent)` }}>
      <details>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aebccd", fontWeight: 700 }}>
          🧑 Humanos vs Máquinas · registrar sinal de competidor humano
        </summary>
        <p className="note" style={{ fontSize: "0.76rem", margin: "10px 0 12px", maxWidth: "80ch" }}>
          O sinal entra no <b>mesmo track record forward</b> dos motores (engine <code>humano_&lt;slug&gt;</code>) e é resolvido
          pelo mesmo cron — mesmas regras, mesmo juiz. Plano manual: entrada, stop e os 3 alvos do competidor.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ ...LBL, flex: "1 1 180px" }}>
              Competidor
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: João" style={FIELD} />
              {slug ? <span style={{ fontSize: "0.66rem", color: HUMAN_ENGINE_COLOR, fontFamily: "var(--font-mono)" }}>motor: humano_{slug}</span> : null}
            </label>
            <label style={{ ...LBL, flex: "1 1 200px" }}>
              Mercado (universo do track record)
              <select value={market} onChange={(e) => setMarket(Number(e.target.value))} style={FIELD}>
                {TRACKED_MARKETS.map((t, i) => (
                  <option key={`${t.symbol}-${t.timeframe}`} value={i}>{t.symbol} · {t.timeframe.toUpperCase()} · {ASSET_PT[t.assetType] ?? t.assetType}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => setSide("buy")} style={sideBtn("buy", "var(--bull,#16a34a)")}>↗ Compra</button>
              <button type="button" onClick={() => setSide("sell")} style={sideBtn("sell", "var(--bear,#dc2626)")}>↘ Venda</button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.76rem", color: "#aebccd", cursor: "pointer" }}>
                <input type="checkbox" checked={strong} onChange={(e) => setStrong(e.target.checked)} /> convicção alta
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {([["Entrada", entry, setEntry], ["Stop", stop, setStop], ["Alvo 1 (TP1)", tp1, setTp1], ["Alvo 2 (TP2)", tp2, setTp2], ["Alvo 3 (TP3)", tp3, setTp3]] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
              <label key={label} style={{ ...LBL, flex: "1 1 110px" }}>
                {label}
                <input type="text" inputMode="decimal" value={val} onChange={(e) => set(e.target.value)} placeholder="0,00" style={FIELD} />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" disabled={busy}
              style={{ ...FIELD, cursor: busy ? "wait" : "pointer", fontWeight: 700, background: HUMAN_ENGINE_COLOR, color: "#1a0508", borderColor: HUMAN_ENGINE_COLOR, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Registrando…" : "Registrar sinal humano"}
            </button>
            {msg ? <span style={{ fontSize: "0.78rem", fontWeight: 600, color: msg.ok ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{msg.text}</span> : null}
          </div>
        </form>
      </details>
    </div>
  );
}
