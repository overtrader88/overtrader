"use client";

import { useEffect, useState } from "react";

interface Detail {
  profile: { email: string; full_name: string | null; plan: string; created_at: string };
  balance: number;
  analyses: { symbol: string; asset_type: string; timeframe: string; signal: string; created_at: string }[];
  subscriptions: { plan: string; period: string; status: string; current_period_end: string | null; hubla_event_id: string | null; created_at: string }[];
  transactions: { amount: number; source: string; metadata: Record<string, unknown> | null; created_at: string }[];
  alertsCount: number;
  watchlistCount: number;
  telegram: { chat_id: string | null; linked_at: string | null } | null;
  liveSessions: { symbol: string; asset_type: string; hours_charged: number; activated_at: string }[];
  monitor: { expires_at: string; activated_at: string; credits: number }[];
}

const CARD: React.CSSProperties = { border: "1px solid var(--border-faint,#e4e8ef)", borderRadius: 8, padding: "10px 12px" };
const TH: React.CSSProperties = { padding: "5px 8px", textAlign: "left" };
const TD: React.CSSProperties = { padding: "5px 8px" };
function planLbl(p: string) { return p === "pro_plus" ? "PRO+" : p.toUpperCase(); }
function dmy(iso: string | null) { return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—"; }
function dmyhm(iso: string | null) { return iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"; }

// "Onde" — origem do movimento em PT.
const SOURCE_PT: Record<string, string> = {
  analysis: "Análise", live_trading: "Ao vivo", monitor_activation: "Monitor",
  signup_trial: "Bônus de cadastro", subscription: "Assinatura", admin: "Ajuste admin", hubla: "Hubla",
};
/** "O quê" — resumo legível do metadata por origem. */
function metaLabel(source: string, m: Record<string, unknown> | null): string {
  if (!m) return "—";
  const s = (k: string) => (typeof m[k] === "string" || typeof m[k] === "number" ? String(m[k]) : "");
  if (source === "analysis") return [s("symbol"), s("timeframe") && s("timeframe").toUpperCase()].filter(Boolean).join(" · ") || "—";
  if (source === "live_trading") return [s("symbol"), s("hour") && `hora ${s("hour")}`].filter(Boolean).join(" · ") || "—";
  if (source === "monitor_activation") return s("days") ? `${s("days")} dias` : "ativação";
  if (source === "subscription") return [s("plan") && planLbl(s("plan")), s("period") === "annual" ? "anual" : s("period") === "monthly" ? "mensal" : ""].filter(Boolean).join(" · ") || "—";
  const keys = Object.keys(m);
  return keys.length ? keys.map((k) => `${k}: ${s(k)}`).filter((x) => !x.endsWith(": ")).join(" · ") || "—" : "—";
}

export function AdminUserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/user/${userId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setErr((d as { error?: string }).error || `HTTP ${r.status}`);
        else setData(d as Detail);
      })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [userId]);

  return (
    <>
      <button type="button" aria-label="Fechar" onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", border: 0, zIndex: 50, cursor: "pointer" }} />
      <div role="dialog" aria-modal="true"
        style={{ position: "fixed", zIndex: 51, top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(720px,94vw)", maxHeight: "88vh", overflowY: "auto", background: "var(--bg,#0b1220)", color: "var(--fg,#e5e7eb)", border: "1px solid var(--border,#334155)", borderRadius: 12, padding: 20 }}
        onClick={(e) => e.stopPropagation()}>
        {err ? (
          <div>
            <p style={{ color: "var(--bear,#dc2626)" }}>Erro: {err}</p>
            <button type="button" onClick={onClose} style={{ ...CARD, cursor: "pointer", background: "#fff", color: "#0f172a" }}>Fechar</button>
          </div>
        ) : !data ? (
          <p className="note">Carregando…</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem" }}>{data.profile.email}</h2>
                <div className="note" style={{ fontSize: "0.8rem" }}>{data.profile.full_name ?? "—"} · cadastro {dmy(data.profile.created_at)}</div>
              </div>
              <button type="button" onClick={onClose} style={{ ...CARD, cursor: "pointer", background: "#fff", color: "#0f172a", fontWeight: 600 }}>Fechar</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 16 }}>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Plano</div><div style={{ fontWeight: 700 }}>{planLbl(data.profile.plan)}</div></div>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Créditos</div><div style={{ fontWeight: 700 }}>{data.balance}</div></div>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Análises</div><div style={{ fontWeight: 700 }}>{data.analyses.length >= 10 ? "10+" : data.analyses.length}</div></div>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Alertas</div><div style={{ fontWeight: 700 }}>{data.alertsCount}</div></div>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Watchlist</div><div style={{ fontWeight: 700 }}>{data.watchlistCount}</div></div>
              <div style={CARD}><div className="note" style={{ fontSize: "0.7rem" }}>Telegram</div><div style={{ fontWeight: 700 }}>{data.telegram?.chat_id ? "✓" : "—"}</div></div>
            </div>

            <Section title="Ativo agora">
              {data.liveSessions.length === 0 && data.monitor.length === 0 ? (
                <p className="note" style={{ fontSize: "0.8rem", margin: 0 }}>Nada ativo no momento.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {data.liveSessions.map((l, i) => (
                    <div key={`l${i}`} style={{ ...CARD, borderColor: "var(--bull,#16a34a)" }}>
                      <div style={{ fontWeight: 700, color: "var(--bull,#16a34a)" }}>● Ao vivo · {l.symbol}</div>
                      <div className="note" style={{ fontSize: "0.72rem" }}>ativa desde {dmyhm(l.activated_at)} · {l.hours_charged}h cobradas (−2/h)</div>
                    </div>
                  ))}
                  {data.monitor.map((mo, i) => (
                    <div key={`m${i}`} style={{ ...CARD, borderColor: "var(--accent,#2563eb)" }}>
                      <div style={{ fontWeight: 700, color: "var(--accent,#2563eb)" }}>● Monitor</div>
                      <div className="note" style={{ fontSize: "0.72rem" }}>ativo até {dmyhm(mo.expires_at)} · {mo.credits} créditos</div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Assinaturas">
              {data.subscriptions.length === 0 ? <Empty /> : (
                <Tbl head={["Plano", "Período", "Status", "Vence", "Hubla"]}>
                  {data.subscriptions.map((s, i) => (
                    <tr key={i}><td style={TD}>{planLbl(s.plan)}</td><td style={TD}>{s.period === "annual" ? "Anual" : "Mensal"}</td><td style={TD}>{s.status}</td><td style={TD}>{dmy(s.current_period_end)}</td><td style={{ ...TD, fontFamily: "ui-monospace,monospace", fontSize: "0.7rem" }}>{s.hubla_event_id ?? "—"}</td></tr>
                  ))}
                </Tbl>
              )}
            </Section>

            <Section title="Análises recentes">
              {data.analyses.length === 0 ? <Empty /> : (
                <Tbl head={["Ativo", "TF", "Sinal", "Quando"]}>
                  {data.analyses.map((a, i) => (
                    <tr key={i}><td style={TD}>{a.symbol}</td><td style={TD}>{a.timeframe}</td><td style={TD}>{a.signal}</td><td style={TD} className="note">{dmy(a.created_at)}</td></tr>
                  ))}
                </Tbl>
              )}
            </Section>

            <Section title={`Consumo / créditos · ${data.transactions.length} movimento(s)`}>
              {data.transactions.length === 0 ? <Empty /> : (
                <Tbl head={["Quando", "Onde", "O quê", "Quanto"]}>
                  {data.transactions.map((t, i) => (
                    <tr key={i}>
                      <td style={TD} className="note">{dmyhm(t.created_at)}</td>
                      <td style={TD}>{SOURCE_PT[t.source] ?? t.source}</td>
                      <td style={TD} className="note">{metaLabel(t.source, t.metadata)}</td>
                      <td style={{ ...TD, fontWeight: 700, textAlign: "right", color: t.amount >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{t.amount >= 0 ? `+${t.amount}` : t.amount}</td>
                    </tr>
                  ))}
                </Tbl>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="note" style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
function Empty() { return <p className="note" style={{ fontSize: "0.8rem", margin: 0 }}>—</p>; }
function Tbl({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead><tr style={{ borderBottom: "1px solid var(--border,#334155)" }}>{head.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
