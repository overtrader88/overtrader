"use client";

import { useMemo, useState } from "react";
import { AdminUserRow, type AdminUser } from "./admin-user-row";

type Tab = "users" | "growth" | "expiring";
type Bucket = "day" | "week" | "month";

const FIELD: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border,#cbd5e1)",
  background: "#fff", color: "#0f172a", fontSize: "0.85rem",
};
const CARD: React.CSSProperties = { border: "1px solid var(--border-faint,#e4e8ef)", borderRadius: 10, padding: "14px 18px" };
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 86_400_000;

/** Segunda-feira 00:00 da semana de `d` (ms). */
function startOfWeekMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}
function bucketKey(iso: string, b: Bucket): string {
  const d = new Date(iso);
  if (b === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (b === "week") return new Date(startOfWeekMs(d)).toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
function bucketLabel(key: string, b: Bucket): string {
  const [y = "", m = "01", dd = "01"] = key.split("-");
  if (b === "month") return `${MONTHS_PT[+m - 1]}/${y}`;
  if (b === "week") return `sem. ${dd}/${m}`;
  return `${dd}/${m}`;
}

export function AdminPanel({ users, now }: { users: AdminUser[]; now: number }) {
  const [tab, setTab] = useState<Tab>("users");
  const [q, setQ] = useState("");
  const [planF, setPlanF] = useState("");
  const [monthF, setMonthF] = useState("");
  const [bucket, setBucket] = useState<Bucket>("day");
  const [windowDays, setWindowDays] = useState(30);

  // Meses de cadastro presentes (YYYY-MM, desc).
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) set.add(u.createdAt.slice(0, 7));
    return [...set].sort().reverse();
  }, [users]);

  // Tabela filtrada.
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (planF && u.plan !== planF) return false;
      if (monthF && u.createdAt.slice(0, 7) !== monthF) return false;
      if (s && !(u.email.toLowerCase().includes(s) || (u.fullName ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [users, q, planF, monthF]);

  // Série de cadastros por período.
  const series = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) { const k = bucketKey(u.createdAt, bucket); counts.set(k, (counts.get(k) ?? 0) + 1); }
    const keys = [...counts.keys()].sort();
    const max = Math.max(1, ...keys.map((k) => counts.get(k)!));
    return keys.map((k) => ({ key: k, label: bucketLabel(k, bucket), count: counts.get(k)!, pct: (counts.get(k)! / max) * 100 }));
  }, [users, bucket]);

  // Vencimentos dentro da janela.
  const expiring = useMemo(() => {
    const horizon = now + windowDays * DAY;
    return users
      .filter((u) => u.periodEnd && u.plan !== "free")
      .map((u) => ({ u, endMs: new Date(u.periodEnd as string).getTime() }))
      .filter((x) => x.endMs <= horizon)
      .sort((a, b) => a.endMs - b.endMs);
  }, [users, now, windowDays]);

  const hasFilter = q || planF || monthF;

  return (
    <>
      {/* Abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {([["users", "Usuários"], ["growth", "Crescimento"], ["expiring", `Vencimentos${expiring.length ? ` (${expiring.length})` : ""}`]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            style={{ ...FIELD, cursor: "pointer", fontWeight: tab === k ? 700 : 500, background: tab === k ? "var(--accent,#2563eb)" : "#fff", color: tab === k ? "#fff" : "#0f172a", borderColor: tab === k ? "var(--accent,#2563eb)" : "var(--border,#cbd5e1)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ---- USUÁRIOS ---- */}
      {tab === "users" ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            <input type="text" placeholder="Buscar nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...FIELD, minWidth: 220, flex: "1 1 220px" }} />
            <select value={planF} onChange={(e) => setPlanF(e.target.value)} style={FIELD}>
              <option value="">Todos os planos</option>
              <option value="free">FREE</option>
              <option value="pro">PRO</option>
              <option value="pro_plus">PRO+</option>
            </select>
            <select value={monthF} onChange={(e) => setMonthF(e.target.value)} style={FIELD}>
              <option value="">Qualquer mês</option>
              {monthOptions.map((m) => { const [y = "", mm = "01"] = m.split("-"); return <option key={m} value={m}>{MONTHS_PT[+mm - 1]}/{y}</option>; })}
            </select>
            {hasFilter ? <button type="button" onClick={() => { setQ(""); setPlanF(""); setMonthF(""); }} style={{ ...FIELD, cursor: "pointer" }}>Limpar</button> : null}
            <span className="note" style={{ fontSize: "0.8rem" }}>{filtered.length} de {users.length}</span>
          </div>

          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}>
                  <th style={{ padding: "8px 10px" }}>Usuário</th>
                  <th style={{ padding: "8px 10px" }}>Cód. compra (Hubla)</th>
                  <th style={{ padding: "8px 10px" }}>Créditos</th>
                  <th style={{ padding: "8px 10px" }}>Cadastro</th>
                  <th style={{ padding: "8px 10px" }}>Plano</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => <AdminUserRow key={u.id} user={u} />)}
              </tbody>
            </table>
            {filtered.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>{users.length === 0 ? "Nenhum usuário ainda." : "Nenhum usuário com esses filtros."}</p> : null}
          </div>
        </>
      ) : null}

      {/* ---- CRESCIMENTO ---- */}
      {tab === "growth" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([["day", "Por dia"], ["week", "Por semana"], ["month", "Por mês"]] as [Bucket, string][]).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setBucket(k)}
                style={{ ...FIELD, cursor: "pointer", fontWeight: bucket === k ? 700 : 500, background: bucket === k ? "var(--accent,#2563eb)" : "#fff", color: bucket === k ? "#fff" : "#0f172a", borderColor: bucket === k ? "var(--accent,#2563eb)" : "var(--border,#cbd5e1)" }}>
                {label}
              </button>
            ))}
          </div>
          <div style={CARD}>
            <div className="note" style={{ fontSize: "0.75rem", marginBottom: 12 }}>Cadastros por {bucket === "day" ? "dia" : bucket === "week" ? "semana" : "mês"}</div>
            {series.length === 0 ? <p className="note">Sem dados.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {series.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="note" style={{ width: 80, fontSize: "0.78rem", textAlign: "right", flexShrink: 0 }}>{s.label}</span>
                    <div style={{ flex: 1, background: "var(--border-faint,#eef2f7)", borderRadius: 6, height: 22, position: "relative" }}>
                      <div style={{ width: `${s.pct}%`, minWidth: 2, height: "100%", background: "var(--accent,#2563eb)", borderRadius: 6 }} />
                    </div>
                    <span style={{ width: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ---- VENCIMENTOS ---- */}
      {tab === "expiring" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span className="note" style={{ fontSize: "0.8rem" }}>Vencendo em até</span>
            {[7, 15, 30].map((d) => (
              <button key={d} type="button" onClick={() => setWindowDays(d)}
                style={{ ...FIELD, cursor: "pointer", fontWeight: windowDays === d ? 700 : 500, background: windowDays === d ? "var(--accent,#2563eb)" : "#fff", color: windowDays === d ? "#fff" : "#0f172a", borderColor: windowDays === d ? "var(--accent,#2563eb)" : "var(--border,#cbd5e1)" }}>
                {d} dias
              </button>
            ))}
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}>
                  <th style={{ padding: "8px 10px" }}>Usuário</th>
                  <th style={{ padding: "8px 10px" }}>Plano</th>
                  <th style={{ padding: "8px 10px" }}>Vence em</th>
                  <th style={{ padding: "8px 10px" }}>Faltam</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map(({ u, endMs }) => {
                  const days = Math.ceil((endMs - now) / DAY);
                  const urgent = days <= 7;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border-faint,#e4e8ef)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{u.email}</div>
                        {u.fullName ? <div className="note" style={{ fontSize: "0.75rem" }}>{u.fullName}</div> : null}
                      </td>
                      <td style={{ padding: "8px 10px" }}>{u.plan === "pro_plus" ? "PRO+" : u.plan.toUpperCase()}</td>
                      <td style={{ padding: "8px 10px" }} className="note">{new Date(endMs).toLocaleDateString("pt-BR")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: days < 0 ? "var(--bear,#dc2626)" : urgent ? "var(--bear,#dc2626)" : undefined }}>
                        {days < 0 ? "vencido" : days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {expiring.length === 0 ? (
              <p className="note" style={{ padding: 20, textAlign: "center" }}>
                Nenhuma assinatura vencendo nos próximos {windowDays} dias.
              </p>
            ) : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>
            Só aparecem assinaturas ativas com vencimento conhecido (vindo do webhook da Hubla). Planos concedidos manualmente pelo admin não têm data de vencimento registrada.
          </p>
        </>
      ) : null}
    </>
  );
}
