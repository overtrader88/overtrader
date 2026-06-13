"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminUserRow, type AdminUser } from "./admin-user-row";
import { AdminUserDetail } from "./admin-user-detail";
import { NotifyButton } from "./admin-notify-button";
import { type AdminExtra, type EngineStat, type ClassEngines, type OpenPosition, type BreakdownRow, type EquityPoint, type ClosedOpRow, type DailyRow, type DailyCell, MRR_PRICE } from "./admin-shared";

const ANALYSIS_COST = 0.013; // R$ por análise (LLM + dados)

type Tab = "users" | "risk" | "expiring" | "growth" | "revenue" | "funnel" | "consumption" | "cohort" | "hubla" | "audit" | "ops" | "motores";
type Bucket = "day" | "week" | "month";

const FIELD: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line-2)",
  background: "var(--panel-2)", color: "var(--ink)", fontSize: "0.85rem",
};
const CARD: React.CSSProperties = { border: "1px solid var(--line-2)", borderRadius: 12, padding: "14px 18px", background: "linear-gradient(180deg,var(--panel),var(--panel-2))" };
const TH: React.CSSProperties = { padding: "11px 12px", fontFamily: "var(--font-mono)", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-faint)" };
const TD: React.CSSProperties = { padding: "10px 12px" };
const ROW: React.CSSProperties = { borderBottom: "1px solid var(--line)" };
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 86_400_000;
const PER_PAGE = 10;

/** Botão-segmento dark (toggles de janela nas abas risco/vencimentos/crescimento). */
function tabBtn(active: boolean): React.CSSProperties {
  return { ...FIELD, cursor: "pointer", fontWeight: active ? 700 : 500, background: active ? "var(--cyan)" : "var(--panel-2)", color: active ? "#04121a" : "var(--ink-soft)", borderColor: active ? "var(--cyan)" : "var(--line-2)" };
}

/** Ícone por aba (stroke, 24-grid). */
function TabIcon({ k }: { k: Tab }) {
  const p = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (k) {
    case "users": return <svg viewBox="0 0 24 24" {...p}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M19 19a5.5 5.5 0 0 0-3-4.9" /></svg>;
    case "risk": return <svg viewBox="0 0 24 24" {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.5" /></svg>;
    case "expiring": return <svg viewBox="0 0 24 24" {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>;
    case "growth": return <svg viewBox="0 0 24 24" {...p}><path d="m4 16 5-5 4 3 7-8" /><path d="M16 6h4v4" /></svg>;
    case "revenue": return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><path d="M14 9.2A2.6 2.6 0 0 0 12 8.2c-1.3 0-2.3.7-2.3 1.7 0 2.3 4.6 1.1 4.6 3.4 0 1-1 1.7-2.3 1.7A2.6 2.6 0 0 1 10 14M12 6.8v10.4" /></svg>;
    case "funnel": return <svg viewBox="0 0 24 24" {...p}><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /></svg>;
    case "consumption": return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "cohort": return <svg viewBox="0 0 24 24" {...p}><circle cx="8" cy="9" r="2.5" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 18a4.5 4.5 0 0 1 9 0M11.5 18a4.5 4.5 0 0 1 9 0" /></svg>;
    case "hubla": return <svg viewBox="0 0 24 24" {...p}><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" /></svg>;
    case "audit": return <svg viewBox="0 0 24 24" {...p}><path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "ops": return <svg viewBox="0 0 24 24" {...p}><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>;
    case "motores": return <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>;
  }
}
const SortIco = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m8 9 4-4 4 4M8 15l4 4 4-4" /></svg>);
function brl(n: number): string { return `R$${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`; }
function planLbl(p: string): string { return p === "pro_plus" ? "PRO+" : p.toUpperCase(); }
function monthLbl(ym: string): string { const [y = "", m = "01"] = ym.split("-"); return `${MONTHS_PT[+m - 1]}/${y}`; }
function dmy(iso: string): string { return new Date(iso).toLocaleDateString("pt-BR"); }
function dmyhm(iso: string): string { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
function ago(iso: string | null, now: number): string {
  if (!iso) return "nunca";
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60); if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function startOfWeekMs(d: Date): number {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime();
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

/** Barras horizontais simples. */
function Bars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) return <p className="note">Sem dados.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="note" style={{ width: 80, fontSize: "0.78rem", textAlign: "right", flexShrink: 0 }}>{s.label}</span>
          <div style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6, height: 22 }}>
            <div style={{ width: `${(s.count / max) * 100}%`, minWidth: 2, height: "100%", background: "var(--cyan)", borderRadius: 6, boxShadow: "0 0 10px var(--glow)" }} />
          </div>
          <span style={{ width: 36, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminPanel({ users, now, extra }: { users: AdminUser[]; now: number; extra: AdminExtra }) {
  const [tab, setTab] = useState<Tab>("users");
  const [q, setQ] = useState("");
  const [consumoUser, setConsumoUser] = useState(""); // detalhe de consumo por usuário (aba Consumo)
  const [planF, setPlanF] = useState("");
  const [monthF, setMonthF] = useState("");
  const [bucket, setBucket] = useState<Bucket>("day");
  const [windowDays, setWindowDays] = useState(30);
  const [riskDays, setRiskDays] = useState(7);
  const [auditAction, setAuditAction] = useState("");
  const [auditQ, setAuditQ] = useState("");

  const monthOptions = useMemo(() => [...new Set(users.map((u) => u.createdAt.slice(0, 7)))].sort().reverse(), [users]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (planF && u.plan !== planF) return false;
      if (monthF && u.createdAt.slice(0, 7) !== monthF) return false;
      if (s && !(u.email.toLowerCase().includes(s) || (u.fullName ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [users, q, planF, monthF]);

  // ordenação + paginação da tabela de usuários
  const [sortKey, setSortKey] = useState<"email" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const sortedUsers = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = sortKey === "email" ? a.email.toLowerCase() : a.createdAt;
      const vb = sortKey === "email" ? b.email.toLowerCase() : b.createdAt;
      return va < vb ? -1 * sortDir : va > vb ? 1 * sortDir : 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / perPage));
  const pageSafe = Math.min(page, totalPages);
  const pagedUsers = sortedUsers.slice((pageSafe - 1) * perPage, pageSafe * perPage);
  const toggleSort = (k: "email" | "createdAt") => {
    if (sortKey === k) setSortDir((d) => (d * -1) as 1 | -1);
    else { setSortKey(k); setSortDir(1); }
    setPage(1);
  };

  const series = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) { const k = bucketKey(u.createdAt, bucket); counts.set(k, (counts.get(k) ?? 0) + 1); }
    return [...counts.keys()].sort().map((k) => ({ label: bucketLabel(k, bucket), count: counts.get(k)! }));
  }, [users, bucket]);

  const expiring = useMemo(() => {
    const horizon = now + windowDays * DAY;
    return users
      .filter((u) => u.periodEnd && u.plan !== "free")
      .map((u) => ({ u, endMs: new Date(u.periodEnd as string).getTime() }))
      .filter((x) => x.endMs <= horizon)
      .sort((a, b) => a.endMs - b.endMs);
  }, [users, now, windowDays]);

  const revenue = useMemo(() => {
    const g = new Map<string, { count: number; mrr: number }>();
    for (const s of extra.activeSubs) {
      const price = MRR_PRICE[s.plan]?.[s.period] ?? 0;
      const cur = g.get(`${s.plan}|${s.period}`) ?? { count: 0, mrr: 0 };
      cur.count++; cur.mrr += price; g.set(`${s.plan}|${s.period}`, cur);
    }
    const rows = [...g.entries()].map(([k, v]) => { const [plan = "", period = ""] = k.split("|"); return { plan, period, ...v }; });
    const mrr = rows.reduce((s, r) => s + r.mrr, 0);
    return { rows, mrr, arr: mrr * 12 };
  }, [extra.activeSubs]);

  const funnel = useMemo(() => ({
    signups: users.length,
    activated: users.filter((u) => u.analysisCount >= 1).length,
    paying: users.filter((u) => u.plan !== "free").length,
  }), [users]);

  const consumption = useMemo(() => {
    const totalAnalyses = extra.analysisSeries.reduce((s, d) => s + d.count, 0);
    const daily = extra.analysisSeries.map((d) => ({ label: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`, count: d.count }));
    const top = [...users].filter((u) => u.analysisCount > 0).sort((a, b) => b.analysisCount - a.analysisCount).slice(0, 10);
    return { totalAnalyses, cost: totalAnalyses * ANALYSIS_COST, daily, top };
  }, [extra.analysisSeries, users]);

  const cohort = useMemo(() => {
    const m = new Map<string, { signups: number; activated: number; paying: number }>();
    for (const u of users) {
      const k = u.createdAt.slice(0, 7);
      const cur = m.get(k) ?? { signups: 0, activated: 0, paying: 0 };
      cur.signups++; if (u.analysisCount >= 1) cur.activated++; if (u.plan !== "free") cur.paying++;
      m.set(k, cur);
    }
    return [...m.entries()].map(([month, v]) => ({ month, ...v })).sort((a, b) => b.month.localeCompare(a.month));
  }, [users]);

  const risk = useMemo(() => {
    const cutoff = now - riskDays * DAY;
    const out: { u: AdminUser; reason: string; urgent: boolean; sortKey: number }[] = [];
    for (const u of users) {
      if (u.plan !== "free") {
        const last = u.lastAnalysisAt ? new Date(u.lastAnalysisAt).getTime() : 0;
        if (last <= cutoff) out.push({ u, reason: u.lastAnalysisAt ? `pagante inativo há ${Math.floor((now - last) / DAY)}d` : "pagante sem nenhuma análise", urgent: true, sortKey: last });
      } else if (u.analysisCount <= 1) {
        out.push({ u, reason: u.analysisCount === 0 ? "trial sem uso" : "trial usou 1 de 3", urgent: false, sortKey: new Date(u.createdAt).getTime() });
      }
    }
    return out.sort((a, b) => a.sortKey - b.sortKey);
  }, [users, now, riskDays]);

  const hublaEvents = useMemo(() => extra.audit.filter((a) => a.action === "activate_sub" || a.action === "deactivate_sub"), [extra.audit]);
  const auditActions = useMemo(() => [...new Set(extra.audit.map((a) => a.action))].sort(), [extra.audit]);
  const auditFiltered = useMemo(() => {
    const s = auditQ.trim().toLowerCase();
    return extra.audit.filter((a) => {
      if (auditAction && a.action !== auditAction) return false;
      if (s && !((a.actor ?? "").toLowerCase().includes(s) || (a.target ?? "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [extra.audit, auditAction, auditQ]);

  const TABS: [Tab, string][] = [
    ["users", "Usuários"],
    ["risk", `Em risco${risk.length ? ` (${risk.length})` : ""}`],
    ["expiring", `Vencimentos${expiring.length ? ` (${expiring.length})` : ""}`],
    ["growth", "Crescimento"],
    ["revenue", "Receita"],
    ["funnel", "Funil"],
    ["consumption", "Consumo"],
    ["cohort", "Cohort"],
    ["hubla", "HubLA"],
    ["audit", "Auditoria"],
    ["ops", "Saúde"],
    ["motores", "Motores"],
  ];
  const hasFilter = q || planF || monthF;
  const stageStyle: React.CSSProperties = { ...CARD, flex: "1 1 140px", textAlign: "center" };
  const fromN = sortedUsers.length === 0 ? 0 : (pageSafe - 1) * perPage + 1;
  const toN = Math.min(sortedUsers.length, pageSafe * perPage);

  return (
    <>
      <div className="adm-tabs">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`adm-tab${tab === k ? " on" : ""}`}>
            <TabIcon k={k} />{label}
          </button>
        ))}
      </div>

      {/* ---- USUÁRIOS ---- */}
      {tab === "users" ? (
        <>
          <div className="adm-toolbar">
            <div className="adm-search">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <input type="text" placeholder="Buscar nome ou e-mail…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <select className="adm-field" value={planF} onChange={(e) => { setPlanF(e.target.value); setPage(1); }}>
              <option value="">Todos os planos</option><option value="free">FREE</option><option value="pro">PRO</option><option value="pro_plus">PRO+</option>
            </select>
            <select className="adm-field" value={monthF} onChange={(e) => { setMonthF(e.target.value); setPage(1); }}>
              <option value="">Qualquer mês</option>
              {monthOptions.map((m) => <option key={m} value={m}>{monthLbl(m)}</option>)}
            </select>
            {hasFilter ? <button type="button" className="adm-field" style={{ cursor: "pointer" }} onClick={() => { setQ(""); setPlanF(""); setMonthF(""); setPage(1); }}>Limpar</button> : null}
            <span className="adm-count">{filtered.length} de {users.length}</span>
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr>
                <th className="adm-th">Usuário<button type="button" className={`adm-sort${sortKey === "email" ? " on" : ""}`} aria-label="Ordenar por usuário" onClick={() => toggleSort("email")}><SortIco /></button></th>
                <th className="adm-th">Cód. compra (HubLA)</th>
                <th className="adm-th">Créditos</th>
                <th className="adm-th">Cadastro<button type="button" className={`adm-sort${sortKey === "createdAt" ? " on" : ""}`} aria-label="Ordenar por cadastro" onClick={() => toggleSort("createdAt")}><SortIco /></button></th>
                <th className="adm-th">Plano</th>
                <th className="adm-th rgt">Ações</th>
              </tr></thead>
              <tbody>{pagedUsers.map((u) => <AdminUserRow key={u.id} user={u} />)}</tbody>
            </table>
            {filtered.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>{users.length === 0 ? "Nenhum usuário ainda." : "Nenhum usuário com esses filtros."}</p> : null}
          </div>
          {sortedUsers.length > 0 ? (
            <div className="adm-pager">
              <span className="info">Exibindo {fromN} a {toN} de {sortedUsers.length} resultados</span>
              <div className="adm-pages">
                <button type="button" className="adm-pg" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)} aria-label="Anterior">‹</button>
                <span className="adm-pg on">{pageSafe}</span>
                <button type="button" className="adm-pg" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)} aria-label="Próxima">›</button>
                <select className="adm-field" style={{ height: 34, marginLeft: 6 }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10 por página</option>
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                </select>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ---- EM RISCO (churn radar) ---- */}
      {tab === "risk" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span className="note" style={{ fontSize: "0.8rem" }}>Pagante inativo há</span>
            {[7, 14].map((d) => <button key={d} type="button" onClick={() => setRiskDays(d)} style={tabBtn(riskDays === d)}>{d} dias+</button>)}
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}>
                <th style={TH}>Usuário</th><th style={TH}>Plano</th><th style={TH}>Motivo</th><th style={TH}>Últ. análise</th><th style={TH}>Análises</th><th style={TH}>Ação</th>
              </tr></thead>
              <tbody>
                {risk.map(({ u, reason, urgent }) => (
                  <tr key={u.id} style={ROW}>
                    <td style={TD}><div style={{ fontWeight: 600 }}>{u.email}</div>{u.fullName ? <div className="note" style={{ fontSize: "0.75rem" }}>{u.fullName}</div> : null}</td>
                    <td style={TD}>{planLbl(u.plan)}</td>
                    <td style={{ ...TD, color: urgent ? "var(--bear,#dc2626)" : undefined, fontWeight: urgent ? 600 : 400 }}>{reason}</td>
                    <td style={TD} className="note">{u.lastAnalysisAt ? dmy(u.lastAnalysisAt) : "—"}</td>
                    <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{u.analysisCount}</td>
                    <td style={TD}><NotifyButton userId={u.id} kind="reactivate" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {risk.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Ninguém em risco no momento. 🎉</p> : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>
            Pagantes (PRO/PRO+) sem análise no período + trials (FREE) que usaram 0–1 das 3 análises. Atividade medida por <code>analyses.created_at</code>.
          </p>
        </>
      ) : null}

      {/* ---- VENCIMENTOS ---- */}
      {tab === "expiring" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span className="note" style={{ fontSize: "0.8rem" }}>Vencendo em até</span>
            {[7, 15, 30].map((d) => <button key={d} type="button" onClick={() => setWindowDays(d)} style={tabBtn(windowDays === d)}>{d} dias</button>)}
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}>
                <th style={TH}>Usuário</th><th style={TH}>Plano</th><th style={TH}>Vence em</th><th style={TH}>Faltam</th><th style={TH}>Ação</th>
              </tr></thead>
              <tbody>
                {expiring.map(({ u, endMs }) => {
                  const days = Math.ceil((endMs - now) / DAY); const urgent = days <= 7;
                  return (
                    <tr key={u.id} style={ROW}>
                      <td style={TD}><div style={{ fontWeight: 600 }}>{u.email}</div>{u.fullName ? <div className="note" style={{ fontSize: "0.75rem" }}>{u.fullName}</div> : null}</td>
                      <td style={TD}>{planLbl(u.plan)}</td>
                      <td style={TD} className="note">{dmy(new Date(endMs).toISOString())}</td>
                      <td style={{ ...TD, fontWeight: 700, color: urgent ? "var(--bear,#dc2626)" : undefined }}>{days < 0 ? "vencido" : days === 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`}</td>
                      <td style={TD}><NotifyButton userId={u.id} kind="expiring" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {expiring.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhuma assinatura vencendo nos próximos {windowDays} dias.</p> : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>Só assinaturas ativas com vencimento conhecido (webhook Hubla ou cortesia com data). Planos concedidos sem data não aparecem.</p>
        </>
      ) : null}

      {/* ---- CRESCIMENTO ---- */}
      {tab === "growth" ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([["day", "Por dia"], ["week", "Por semana"], ["month", "Por mês"]] as [Bucket, string][]).map(([k, label]) => <button key={k} type="button" onClick={() => setBucket(k)} style={tabBtn(bucket === k)}>{label}</button>)}
          </div>
          <div style={CARD}>
            <div className="note" style={{ fontSize: "0.75rem", marginBottom: 12 }}>Cadastros por {bucket === "day" ? "dia" : bucket === "week" ? "semana" : "mês"}</div>
            <Bars data={series} />
          </div>
        </>
      ) : null}

      {/* ---- RECEITA (MRR real) ---- */}
      {tab === "revenue" ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ ...CARD, flex: "1 1 140px" }}><div className="note" style={{ fontSize: "0.75rem" }}>MRR real</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{brl(revenue.mrr)}</div></div>
            <div style={{ ...CARD, flex: "1 1 140px" }}><div className="note" style={{ fontSize: "0.75rem" }}>ARR (×12)</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{brl(revenue.arr)}</div></div>
            <div style={{ ...CARD, flex: "1 1 140px" }}><div className="note" style={{ fontSize: "0.75rem" }}>Assinaturas ativas</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{extra.activeSubs.length}</div></div>
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}><th style={TH}>Plano</th><th style={TH}>Período</th><th style={TH}>Assinantes</th><th style={TH}>MRR</th></tr></thead>
              <tbody>{revenue.rows.map((r, i) => (
                <tr key={i} style={ROW}><td style={TD}>{planLbl(r.plan)}</td><td style={TD}>{r.period === "annual" ? "Anual" : "Mensal"}</td><td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{r.count}</td><td style={{ ...TD, fontWeight: 600 }}>{brl(r.mrr)}</td></tr>
              ))}</tbody>
            </table>
            {revenue.rows.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhuma assinatura ativa registrada (via webhook Hubla).</p> : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>Receita de assinaturas <b>ativas reais</b> (subscriptions). Planos concedidos manualmente sem assinatura não contam aqui — é receita de verdade, não estimativa por contagem de plano.</p>
        </>
      ) : null}

      {/* ---- FUNIL ---- */}
      {tab === "funnel" ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
            <div style={stageStyle}><div className="note" style={{ fontSize: "0.75rem" }}>Cadastros</div><div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{funnel.signups}</div></div>
            <div style={stageStyle}><div className="note" style={{ fontSize: "0.75rem" }}>Ativados (≥1 análise)</div><div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{funnel.activated}</div><div className="note" style={{ fontSize: "0.75rem" }}>{funnel.signups ? Math.round((funnel.activated / funnel.signups) * 100) : 0}% dos cadastros</div></div>
            <div style={stageStyle}><div className="note" style={{ fontSize: "0.75rem" }}>Pagantes</div><div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{funnel.paying}</div><div className="note" style={{ fontSize: "0.75rem" }}>{funnel.activated ? Math.round((funnel.paying / funnel.activated) * 100) : 0}% dos ativados · {funnel.signups ? Math.round((funnel.paying / funnel.signups) * 100) : 0}% do total</div></div>
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 12, maxWidth: "70ch" }}>Ativação = fez ≥1 análise. A 1ª análise é o ponto que decide se o trial vira PRO — acompanhe a queda entre Cadastros → Ativados.</p>
        </>
      ) : null}

      {/* ---- CONSUMO / CUSTO ---- */}
      {tab === "consumption" ? (
        <>
          <div style={{ ...CARD, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Detalhar consumo do usuário:</span>
            <select value={consumoUser} onChange={(e) => setConsumoUser(e.target.value)} style={{ ...FIELD, minWidth: 260 }}>
              <option value="">— selecione um usuário —</option>
              {[...users].sort((a, b) => a.email.localeCompare(b.email)).map((u) => (
                <option key={u.id} value={u.id}>{u.email} ({planLbl(u.plan)})</option>
              ))}
            </select>
            <span className="note" style={{ fontSize: "0.75rem" }}>data · onde · o quê · quanto + o que está ativo (ao vivo / monitor)</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ ...CARD, flex: "1 1 140px" }}><div className="note" style={{ fontSize: "0.75rem" }}>Análises (período)</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{consumption.totalAnalyses}</div></div>
            <div style={{ ...CARD, flex: "1 1 140px" }}><div className="note" style={{ fontSize: "0.75rem" }}>Custo estimado</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{brl(consumption.cost)}</div><div className="note" style={{ fontSize: "0.7rem" }}>~R$0,013/análise</div></div>
          </div>
          <div style={{ ...CARD, marginBottom: 16 }}>
            <div className="note" style={{ fontSize: "0.75rem", marginBottom: 12 }}>Análises por dia</div>
            <Bars data={consumption.daily} />
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}><th style={TH}>Top consumidores</th><th style={TH}>Plano</th><th style={TH}>Análises</th></tr></thead>
              <tbody>{consumption.top.map((u) => (
                <tr key={u.id} style={{ ...ROW, cursor: "pointer" }} onClick={() => setConsumoUser(u.id)} title="Ver detalhe de consumo">
                  <td style={{ ...TD, color: "var(--accent,#2563eb)", fontWeight: 600 }}>{u.email}</td><td style={TD}>{planLbl(u.plan)}</td><td style={{ ...TD, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{u.analysisCount}</td></tr>
              ))}</tbody>
            </table>
            {consumption.top.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhuma análise ainda.</p> : null}
          </div>
          {consumoUser ? <AdminUserDetail userId={consumoUser} onClose={() => setConsumoUser("")} /> : null}
        </>
      ) : null}

      {/* ---- COHORT ---- */}
      {tab === "cohort" ? (
        <>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}><th style={TH}>Safra (mês)</th><th style={TH}>Cadastros</th><th style={TH}>Ativados</th><th style={TH}>Pagantes</th><th style={TH}>Conversão</th></tr></thead>
              <tbody>{cohort.map((c) => (
                <tr key={c.month} style={ROW}>
                  <td style={TD}>{monthLbl(c.month)}</td>
                  <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{c.signups}</td>
                  <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{c.activated}</td>
                  <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{c.paying}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{c.signups ? Math.round((c.paying / c.signups) * 100) : 0}%</td>
                </tr>
              ))}</tbody>
            </table>
            {cohort.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Sem dados.</p> : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>Conversão por safra de cadastro (<b>estado atual</b>, não histórico). Útil pra comparar a qualidade de quem entrou em cada mês.</p>
        </>
      ) : null}

      {/* ---- HUBLA (eventos de pagamento) ---- */}
      {tab === "hubla" ? (
        <div className="tbl" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}><th style={TH}>Quando</th><th style={TH}>Evento</th><th style={TH}>Usuário</th><th style={TH}>Plano</th><th style={TH}>Detalhe</th></tr></thead>
            <tbody>{hublaEvents.map((a) => {
              const activate = a.action === "activate_sub";
              return (
                <tr key={a.id} style={ROW}>
                  <td style={TD} className="note">{dmyhm(a.created_at)}</td>
                  <td style={{ ...TD, fontWeight: 600, color: activate ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{activate ? "ativou" : "cancelou"}</td>
                  <td style={TD}>{a.target ?? "—"}</td>
                  <td style={TD}>{a.metadata?.plan ? planLbl(String(a.metadata.plan)) : "—"}</td>
                  <td style={{ ...TD, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.72rem" }} className="note">{a.metadata?.event ? String(a.metadata.event) : JSON.stringify(a.metadata)}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {hublaEvents.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhum evento de pagamento registrado ainda (chega via webhook Hubla).</p> : null}
        </div>
      ) : null}

      {/* ---- AUDITORIA ---- */}
      {tab === "audit" ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            <input type="text" placeholder="Buscar ator ou alvo…" value={auditQ} onChange={(e) => setAuditQ(e.target.value)} style={{ ...FIELD, minWidth: 200, flex: "1 1 200px" }} />
            <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)} style={FIELD}>
              <option value="">Todas as ações</option>
              {auditActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="note" style={{ fontSize: "0.8rem" }}>{auditFiltered.length} de {extra.audit.length}</span>
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}><th style={TH}>Quando</th><th style={TH}>Ator</th><th style={TH}>Ação</th><th style={TH}>Alvo</th><th style={TH}>Detalhe</th></tr></thead>
              <tbody>{auditFiltered.map((a) => (
                <tr key={a.id} style={ROW}>
                  <td style={TD} className="note">{dmyhm(a.created_at)}</td>
                  <td style={TD}>{a.actor ?? "—"}</td>
                  <td style={{ ...TD, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.75rem" }}>{a.action}</td>
                  <td style={{ ...TD, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.72rem" }} className="note">{a.target ?? "—"}</td>
                  <td style={{ ...TD, fontFamily: "ui-monospace,Menlo,monospace", fontSize: "0.72rem" }} className="note">{JSON.stringify(a.metadata)}</td>
                </tr>
              ))}</tbody>
            </table>
            {auditFiltered.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhum registro.</p> : null}
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 10, maxWidth: "70ch" }}>Trilha de operações sensíveis (<code>audit_log</code>): mudança de plano/crédito, eventos de assinatura. Últimos 300 registros.</p>
        </>
      ) : null}

      {/* ---- SAÚDE (ops) ---- */}
      {tab === "ops" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
            {([
              { label: "Último sinal emitido", iso: extra.ops.lastSignalAt, th: 6, sub: "cron emit-signals (~4h)" },
              { label: "Última checagem de sinais", iso: extra.ops.lastCheckedAt, th: 6, sub: "cron resolve/check" },
              { label: "Última análise (atividade)", iso: extra.ops.lastAnalysisAt, th: 0, sub: "uso de usuário" },
              { label: "Último evento Hubla", iso: extra.ops.lastHublaAt, th: 0, sub: "pagamento/cancelamento" },
            ] as { label: string; iso: string | null; th: number; sub: string }[]).map((c, i) => {
              const stale = c.th > 0 && !!c.iso && now - new Date(c.iso).getTime() > c.th * 3_600_000;
              const color = c.th === 0 ? "#94a3b8" : c.iso && !stale ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)";
              return (
                <div key={i} style={CARD}>
                  <div className="note" style={{ fontSize: "0.75rem" }}>{c.label}</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block" }} />{ago(c.iso, now)}
                  </div>
                  <div className="note" style={{ fontSize: "0.72rem" }}>{c.iso ? dmyhm(c.iso) : "—"} · {c.sub}</div>
                </div>
              );
            })}
            <div style={CARD}>
              <div className="note" style={{ fontSize: "0.75rem" }}>Sinais em aberto</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{extra.ops.openSignals}</div>
              <div className="note" style={{ fontSize: "0.72rem" }}>aguardando resolução forward</div>
            </div>
          </div>
          <p className="note" style={{ fontSize: "0.78rem", marginTop: 12, maxWidth: "70ch" }}>
            Proxies de saúde a partir dos dados (não é monitor de cron real). Verde = recente; vermelho = pode estar travado. Cota da TwelveData não é exposta aqui.
          </p>
        </>
      ) : null}

      {/* ---- MOTORES (comparação de performance) ---- */}
      {tab === "motores" ? (
        <EnginesTab
          engines={extra.engines?.engines ?? []}
          byClassEngine={extra.engines?.byClassEngine ?? []}
          open={extra.engines?.open ?? []}
          byClass={extra.engines?.byClass ?? []}
          byTimeframe={extra.engines?.byTimeframe ?? []}
          byAsset={extra.engines?.byAsset ?? []}
          bySymbolTf={extra.engines?.bySymbolTf ?? []}
          equity={extra.engines?.equity ?? []}
          closed={extra.engines?.closed ?? []}
          daily={extra.engines?.daily ?? []}
          now={now}
        />
      ) : null}
    </>
  );
}

// =================== Aba Motores ===================
const sgn = (x: number, d = 2) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: d })}`;
const STATUS_PT: Record<OpenPosition["status"], { label: string; color: string }> = {
  profit: { label: "lucro", color: "var(--bull,#16a34a)" },
  loss: { label: "prejuízo", color: "var(--bear,#dc2626)" },
  flat: { label: "neutro", color: "#94a3b8" },
  unknown: { label: "—", color: "#94a3b8" },
};

/** Curva de R acumulado por motor (SVG) — uma linha por motor visível. */
function EquityChart({ equity, engineIds }: { equity: EquityPoint[]; engineIds: string[] }) {
  if (equity.length < 2) return <p className="note">A curva aparece quando houver ≥2 desfechos resolvidos.</p>;
  const ids = ENGINE_ORDER.filter((id) => engineIds.includes(id));
  const W = 100, H = 40, PAD = 2;
  const vals = [0, ...equity.flatMap((e) => ids.map((id) => e.values[id] ?? 0))];
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i: number) => (equity.length === 1 ? 0 : (i / (equity.length - 1)) * (W - PAD * 2) + PAD);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const line = (id: string) => equity.map((e, i) => `${x(i).toFixed(2)},${y(e.values[id] ?? 0).toFixed(2)}`).join(" ");
  const y0 = y(0);
  const lastOf = (id: string) => equity[equity.length - 1]!.values[id] ?? 0;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 160, border: "1px solid var(--line-2)", borderRadius: 10, background: "var(--bg-2, #0a0d14)" }}>
        <line x1={0} y1={y0} x2={W} y2={y0} stroke="#3a4a66" strokeWidth={0.3} strokeDasharray="1,1" />
        {ids.map((id) => (
          <polyline key={id} points={line(id)} fill="none" stroke={ENGINE_COLOR[id] ?? "#64748b"} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: "0.8rem" }}>
        {ids.map((id) => {
          const last = lastOf(id);
          return (
            <span key={id} style={{ display: "flex", alignItems: "center", gap: 6, color: "#aebccd" }}>
              <span style={{ width: 14, height: 3, background: ENGINE_COLOR[id] ?? "#64748b", display: "inline-block", borderRadius: 2 }} /> {ENGINE_LABEL[id] ?? id} <b style={{ color: last >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)", fontVariantNumeric: "tabular-nums" }}>{sgn(last, 1)} R</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Tabela de recorte (classe ou TF) × motor. */
// Metadados de motor — fonte única (ordem + rótulo curto + tag com ícone p/ listas).
const ENGINE_ORDER = ["padrao", "padrao_b", "classe", "classe_b", "llm", "llm_ds", "condicional", "contrario", "consenso"] as const;
const ENGINE_LABEL: Record<string, string> = {
  padrao: "Padrão", padrao_b: "Padrão-B", classe: "Classe", classe_b: "Classe-B", llm: "GPT-4.1", llm_ds: "DeepSeek",
  condicional: "Condicional", contrario: "Contrário", consenso: "Consenso",
};
const ENGINE_TAG: Record<string, string> = {
  padrao: "Padrão", padrao_b: "Padrão-B", classe: "⚙ Classe", classe_b: "⚙ Classe-B", llm: "🤖 GPT-4.1", llm_ds: "🐋 DeepSeek",
  condicional: "⚡ Condicional", contrario: "🔁 Contrário", consenso: "🤝 Consenso",
};
const ENGINE_COLOR: Record<string, string> = {
  padrao: "#2563eb", padrao_b: "#0ea5e9", classe: "#9333ea", classe_b: "#c026d3", llm: "#f59e0b", llm_ds: "#a78bfa",
  condicional: "#22c55e", contrario: "#94a3b8", consenso: "#06b6d4",
};
/** Bolinha de cor do motor — amarra coluna/tabela à linha do gráfico de equity. */
const EngineDot = ({ id }: { id: string }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: ENGINE_COLOR[id] ?? "#64748b", flex: "none" }} aria-hidden />
);
/** 1ª coluna fixa em tabelas largas (8 motores → scroll horizontal). */
const STICKY_COL: React.CSSProperties = { position: "sticky", left: 0, zIndex: 1, background: "var(--panel, #0d1119)" };

type BreakdownSort = "n" | "r" | "wr";
const BREAKDOWN_SORTS: [BreakdownSort, string][] = [["n", "Amostra (n)"], ["r", "R total"], ["wr", "Win% médio"]];

function BreakdownTable({ title, rows, engineIds }: { title: string; rows: BreakdownRow[]; engineIds: string[] }) {
  const [sortBy, setSortBy] = useState<BreakdownSort>("n");
  const cell = (g: { n: number; winRatePct: number; totalR: number } | undefined) =>
    !g || g.n === 0 ? <span style={{ color: "#64748b" }}>—</span> : (
      <>
        n={g.n} · {g.winRatePct.toFixed(0)}% · <b style={{ color: g.totalR >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{sgn(g.totalR, 1)}R</b>
      </>
    );
  // agrega a métrica de ordenação SOBRE os motores visíveis.
  const score = (r: BreakdownRow): number => {
    const gs = engineIds.map((e) => r.stats[e]).filter((g): g is NonNullable<typeof g> => !!g && g.n > 0);
    if (gs.length === 0) return -Infinity;
    if (sortBy === "r") return gs.reduce((s, g) => s + g.totalR, 0);
    if (sortBy === "wr") { const n = gs.reduce((s, g) => s + g.n, 0); return n ? gs.reduce((s, g) => s + g.winRatePct * g.n, 0) / n : 0; }
    return gs.reduce((s, g) => s + g.n, 0);
  };
  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  // Totalizador por motor (soma sobre todos os grupos).
  const totals: Record<string, { n: number; winRatePct: number; totalR: number }> = {};
  for (const e of engineIds) {
    let n = 0, wins = 0, decisive = 0, totalR = 0;
    for (const r of rows) { const g = r.stats[e]; if (g) { n += g.n; wins += g.wins; decisive += g.decisive; totalR += g.totalR; } }
    totals[e] = { n, totalR, winRatePct: decisive > 0 ? (wins / decisive) * 100 : 0 };
  }
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem" }}>{title}</h3>
        {rows.length > 0 ? (
          <label style={{ fontSize: "0.78rem", color: "#aebccd", display: "flex", alignItems: "center", gap: 6 }}>
            Ordenar por
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as BreakdownSort)} style={FIELD}>
              {BREAKDOWN_SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {rows.length === 0 ? <p className="note">Sem desfechos resolvidos ainda.</p> : (
        <div style={{ overflowX: "auto", border: "1px solid var(--line-2)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: 160 + engineIds.length * 124 }}>
            <thead>
              <tr style={ROW}>
                <th style={{ ...TH, ...STICKY_COL, textAlign: "left" }}>Grupo</th>
                {engineIds.map((e) => (
                  <th key={e} style={{ ...TH, textAlign: "left", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><EngineDot id={e} />{ENGINE_LABEL[e] ?? e}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.key} style={ROW}>
                  <td style={{ ...TD, ...STICKY_COL, whiteSpace: "nowrap" }}><b>{r.label}</b></td>
                  {engineIds.map((e) => <td key={e} style={{ ...TD, whiteSpace: "nowrap" }}>{cell(r.stats[e])}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ ...ROW, borderTop: "2px solid var(--line-3, #475569)" }}>
                <td style={{ ...TD, ...STICKY_COL, fontWeight: 700 }}>Total</td>
                {engineIds.map((e) => <td key={e} style={{ ...TD, fontWeight: 700, whiteSpace: "nowrap" }}>{cell(totals[e])}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Filtros + ordenação das listas.
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir };

function useTableControls(initialKey: string, initialDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState>({ key: initialKey, dir: initialDir });
  const onSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  return { sort, onSort };
}

/** Cabeçalho de coluna clicável (ordena asc/desc; mostra ▲/▼). */
function SortHeader({ label, k, sort, onSort, align = "left" }: { label: string; k: string; sort: SortState; onSort: (k: string) => void; align?: "left" | "right" }) {
  const active = sort.key === k;
  return (
    <th onClick={() => onSort(k)} style={{ ...TH, textAlign: align, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} title="Ordenar">
      {label}{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

/** Ordena por uma chave usando um accessor (numérico ou string). Nulos por último. */
function applySort<T>(rows: T[], sort: SortState, accessor: (r: T, key: string) => string | number | null): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = accessor(a, sort.key), vb = accessor(b, sort.key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
    return String(va).localeCompare(String(vb)) * sign;
  });
}

/** Select de filtro compacto (estilo claro do admin). */
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...FIELD, fontSize: "0.8rem" }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
const ENGINE_FILTER_OPTS: [string, string][] = [["all", "Todos os motores"], ...ENGINE_ORDER.map((e) => [e, ENGINE_LABEL[e]!] as [string, string])];
const SIDE_OPTS: [string, string][] = [["all", "Compra e venda"], ["buy", "Só compra"], ["sell", "Só venda"]];
const OPEN_STATUS_OPTS: [string, string][] = [["all", "Todas situações"], ["lucro", "Lucro"], ["prejuizo", "Prejuízo"], ["neutro", "Neutro"]];
const CLOSED_OUTCOME_OPTS: [string, string][] = [["all", "Todos desfechos"], ["take", "Take"], ["stop", "Stop"], ["exp", "Expirou"]];
const FILTER_BAR: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 8px" };
const C_GREEN = "var(--bull,#16a34a)";
const C_RED = "var(--bear,#dc2626)";

// ===================== Quadro de resultado diário (finalizadas + abertas) =====================
function DailyBoard({ daily, engines, engineIds }: { daily: DailyRow[]; engines: EngineStat[]; engineIds: string[] }) {
  const fmtDay = (d: string) => { const [, m, dd] = d.split("-"); return `${dd}/${m}`; };
  const openByEngine: Record<string, EngineStat> = Object.fromEntries(engines.map((e) => [e.engine, e]));
  const totals: Record<string, { wins: number; stops: number; totalR: number }> = {};
  for (const id of engineIds) {
    let wins = 0, stops = 0, totalR = 0;
    for (const d of daily) { const c = d.perEngine[id]; if (c) { wins += c.wins; stops += c.stops; totalR += c.totalR; } }
    totals[id] = { wins, stops, totalR };
  }
  const dayCell = (c: DailyCell | undefined) =>
    !c || c.n === 0 ? <span style={{ color: "#64748b" }}>—</span> : (
      <><span style={{ color: C_GREEN }}>✅{c.wins}</span> <span style={{ color: C_RED }}>❌{c.stops}</span> <b style={{ color: c.totalR >= 0 ? C_GREEN : C_RED }}>{sgn(c.totalR, 1)}R</b></>
    );
  const hasAnyOpen = engines.some((e) => e.open > 0);
  return (
    <div style={{ width: "100%" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Resultado diário · finalizadas + abertas</h3>
      {daily.length === 0 && !hasAnyOpen ? <p className="note">Sem operações ainda.</p> : (
        <div style={{ overflowX: "auto", border: "1px solid var(--line-2)", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 160 + engineIds.length * 130 }}>
            <thead>
              <tr style={ROW}>
                <th style={{ ...TH, ...STICKY_COL, textAlign: "left" }}>Dia</th>
                {engineIds.map((e) => (
                  <th key={e} style={{ ...TH, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><EngineDot id={e} />{ENGINE_LABEL[e] ?? e}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ ...ROW, background: "rgba(96,165,250,0.10)" }}>
                <td style={{ ...TD, ...STICKY_COL, fontWeight: 700 }}>Abertas (agora)</td>
                {engineIds.map((id) => {
                  const e = openByEngine[id];
                  return <td key={id} style={{ ...TD, textAlign: "right" }}>{e && e.open > 0 ? <>{e.open} ab · <b style={{ color: e.openUnrealizedR >= 0 ? C_GREEN : C_RED }}>{sgn(e.openUnrealizedR, 1)}R</b></> : <span style={{ color: "#64748b" }}>—</span>}</td>;
                })}
              </tr>
              {daily.map((d) => (
                <tr key={d.date} style={ROW}>
                  <td style={{ ...TD, ...STICKY_COL, fontWeight: 600 }}>{fmtDay(d.date)}</td>
                  {engineIds.map((id) => <td key={id} style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dayCell(d.perEngine[id])}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ ...ROW, borderTop: "2px solid var(--line-3, #475569)" }}>
                <td style={{ ...TD, ...STICKY_COL, fontWeight: 700 }}>Total finalizadas</td>
                {engineIds.map((id) => {
                  const t = totals[id] ?? { wins: 0, stops: 0, totalR: 0 };
                  return <td key={id} style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{t.wins + t.stops === 0 ? <span style={{ color: "#64748b" }}>—</span> : <><span style={{ color: C_GREEN }}>✅{t.wins}</span> <span style={{ color: C_RED }}>❌{t.stops}</span> <b style={{ color: t.totalR >= 0 ? C_GREEN : C_RED }}>{sgn(t.totalR, 1)}R</b></>}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== Ranking dos motores (ordenável por métrica) =====================
type RankMetric = { key: string; label: string; value: (e: EngineStat) => number | null; dir: "higher" | "lower"; fmt: (v: number) => string; tone?: (v: number) => string | null };
const RANK_METRICS: RankMetric[] = [
  { key: "totalR", label: "R acumulado (realizado)", value: (e) => (e.resolved > 0 ? e.totalR : null), dir: "higher", fmt: (v) => `${sgn(v, 1)}R`, tone: (v) => (v < 0 ? C_RED : v > 0 ? C_GREEN : null) },
  { key: "winRatePct", label: "Assertividade (win rate)", value: (e) => (e.decisive > 0 ? e.winRatePct : null), dir: "higher", fmt: (v) => `${v.toFixed(1)}%` },
  { key: "profitFactor", label: "Profit factor", value: (e) => (e.decisive > 0 ? e.profitFactor : null), dir: "higher", fmt: (v) => v.toFixed(2) },
  { key: "avgR", label: "R médio / sinal", value: (e) => (e.resolved > 0 ? e.avgR : null), dir: "higher", fmt: (v) => sgn(v), tone: (v) => (v < 0 ? C_RED : v > 0 ? C_GREEN : null) },
  { key: "avgWinR", label: "Ganho médio (R)", value: (e) => (e.wins > 0 ? e.avgWinR : null), dir: "higher", fmt: (v) => sgn(v), tone: () => C_GREEN },
  { key: "avgLossR", label: "Perda média (R)", value: (e) => (e.losses > 0 ? e.avgLossR : null), dir: "higher", fmt: (v) => sgn(v), tone: () => C_RED },
  { key: "payoff", label: "Payoff (ganho / |perda|)", value: (e) => (e.wins > 0 && e.losses > 0 ? e.payoff : null), dir: "higher", fmt: (v) => `${v.toFixed(2)}×`, tone: (v) => (v >= 1 ? C_GREEN : C_RED) },
  { key: "stopPct", label: "Stop loss (% dos decisivos)", value: (e) => (e.decisive > 0 ? (e.losses / e.decisive) * 100 : null), dir: "lower", fmt: (v) => `${v.toFixed(0)}%`, tone: () => C_RED },
  { key: "stopsPerTake", label: "Stops por take", value: (e) => (e.wins > 0 ? e.losses / e.wins : null), dir: "lower", fmt: (v) => `${v.toFixed(2)}×`, tone: (v) => (v > 1 ? C_RED : v < 1 ? C_GREEN : null) },
  { key: "wins", label: "Operações TP (take)", value: (e) => e.wins, dir: "higher", fmt: (v) => String(v), tone: (v) => (v > 0 ? C_GREEN : null) },
  { key: "losses", label: "Operações SL (stop)", value: (e) => e.losses, dir: "lower", fmt: (v) => String(v), tone: (v) => (v > 0 ? C_RED : null) },
  { key: "open", label: "Abertos agora (qtd)", value: (e) => e.open, dir: "higher", fmt: (v) => String(v) },
  { key: "openUnrealizedR", label: "R não-realizado (abertos)", value: (e) => e.openUnrealizedR, dir: "higher", fmt: (v) => `${sgn(v, 1)}R`, tone: (v) => (v < 0 ? C_RED : v > 0 ? C_GREEN : null) },
  { key: "emittedTotal", label: "Sinais emitidos (total)", value: (e) => e.emittedTotal, dir: "higher", fmt: (v) => String(v) },
  { key: "decisive", label: "Decisivos (TP+SL)", value: (e) => e.decisive, dir: "higher", fmt: (v) => String(v) },
];

function RankingTable({ engines, byClass, visibleIds }: { engines: EngineStat[]; byClass: ClassEngines[]; visibleIds: string[] }) {
  const [metricKey, setMetricKey] = useState("totalR");
  const [classKey, setClassKey] = useState("todas");
  const m = RANK_METRICS.find((x) => x.key === metricKey) ?? RANK_METRICS[0]!;
  // "Todas" usa o agregado global (já filtrado pelos motores visíveis); uma classe
  // usa as stats daquela classe, também restritas aos motores visíveis.
  const source = classKey === "todas"
    ? engines
    : (byClass.find((c) => c.class === classKey)?.engines ?? []).filter((e) => visibleIds.includes(e.engine));
  const ranked = source.map((e) => ({ e, v: m.value(e) }))
    .sort((a, b) => {
      if (a.v == null && b.v == null) return 0;
      if (a.v == null) return 1;
      if (b.v == null) return -1;
      return m.dir === "higher" ? b.v - a.v : a.v - b.v;
    });
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Ranking dos motores</h3>
        <label style={{ fontSize: "0.8rem", color: "#aebccd", display: "flex", alignItems: "center", gap: 6 }}>
          Classe
          <select value={classKey} onChange={(e) => setClassKey(e.target.value)} style={FIELD}>
            <option value="todas">Todas as classes</option>
            {byClass.map((c) => <option key={c.class} value={c.class}>{c.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: "0.8rem", color: "#aebccd", display: "flex", alignItems: "center", gap: 6 }}>
          Ranquear por
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)} style={FIELD}>
            {RANK_METRICS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        </label>
        <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{m.dir === "higher" ? "maior = melhor" : "menor = melhor"}{classKey !== "todas" ? " · classe filtrada" : ""}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", minWidth: 560 }}>
          <thead>
            <tr style={ROW}>
              <th style={{ ...TH, textAlign: "left", width: 44 }}>#</th>
              <th style={{ ...TH, textAlign: "left" }}>Motor</th>
              <th style={{ ...TH, textAlign: "right" }}>{m.label}</th>
              <th style={{ ...TH, textAlign: "right" }}>Decisivos</th>
              <th style={{ ...TH, textAlign: "right" }}>Win%</th>
              <th style={{ ...TH, textAlign: "right" }}>R acum.</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ e, v }, i) => {
              const tone = v != null && m.tone ? m.tone(v) : null;
              const ranked0 = v != null;
              return (
                <tr key={e.engine} style={ROW}>
                  <td style={{ ...TD, fontWeight: 700 }}>{!ranked0 ? "—" : i === 0 ? "🥇 1º" : `${i + 1}º`}</td>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><EngineDot id={e.engine} />{ENGINE_TAG[e.engine] ?? e.engine}</span></td>
                  <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: tone ?? "#e8edf5" }}>{v == null ? "—" : m.fmt(v)}</td>
                  <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.decisive}</td>
                  <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.decisive > 0 ? `${e.winRatePct.toFixed(0)}%` : "—"}</td>
                  <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", color: e.totalR > 0 ? C_GREEN : e.totalR < 0 ? C_RED : "#e8edf5" }}>{e.resolved > 0 ? `${sgn(e.totalR, 1)}R` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * DUELO LLM — placar head-to-head GPT-4.1 (motor `llm`) × DeepSeek V4-Pro
 * (`llm_ds`), em destaque no topo da aba. Gate/geometria idênticos → compara
 * só a DECISÃO. Honesto: sem veredito até cada lado ter ≥5 resolvidos.
 */
function LlmDuel({ engines }: { engines: EngineStat[] }) {
  const gpt = engines.find((e) => e.engine === "llm");
  const ds = engines.find((e) => e.engine === "llm_ds");
  if (!gpt && !ds) return null;

  const GREEN = "var(--bull,#16a34a)";
  const MUTED = "#aebccd";
  const resolvedTotal = (gpt?.resolved ?? 0) + (ds?.resolved ?? 0);
  const dsLive = (ds?.emittedTotal ?? 0) > 0;

  type M = { key: string; label: string; val: (e?: EngineStat) => number | null; fmt: (v: number) => string };
  const METRICS: M[] = [
    { key: "wr", label: "Assertividade", val: (e) => (e && e.decisive > 0 ? e.winRatePct : null), fmt: (v) => `${v.toFixed(0)}%` },
    { key: "pf", label: "Profit factor", val: (e) => (e && e.decisive > 0 ? e.profitFactor : null), fmt: (v) => (isFinite(v) ? v.toFixed(2) : "∞") },
    { key: "r", label: "R acumulado", val: (e) => (e && e.resolved > 0 ? e.totalR : null), fmt: (v) => sgn(v, 1) },
    { key: "avg", label: "R médio / sinal", val: (e) => (e && e.resolved > 0 ? e.avgR : null), fmt: (v) => sgn(v, 2) },
  ];

  let gptWins = 0, dsWins = 0;
  for (const m of METRICS) {
    const a = m.val(gpt), b = m.val(ds);
    if (a != null && b != null && a !== b) { if (a > b) gptWins++; else dsWins++; }
  }
  const enoughSample = (gpt?.resolved ?? 0) >= 5 && (ds?.resolved ?? 0) >= 5;
  let verdict: React.ReactNode;
  if (!dsLive) verdict = <>DeepSeek <b>ligada</b> — emite no próximo cron (a cada 4h). O duelo começa quando os dois resolverem sinais.</>;
  else if (!enoughSample) verdict = <>Coletando amostra (<b>{resolvedTotal}</b> resolvidos). Sem veredito até cada motor ter <b>≥5</b> — <i>prova antes de prometer</i>.</>;
  else if (gptWins === dsWins) verdict = <>Empate técnico ({gptWins}×{dsWins} métricas) — seguem disputando. Amostra n={resolvedTotal}.</>;
  else {
    const lead = gptWins > dsWins;
    verdict = <>Liderando: <b style={{ color: lead ? ENGINE_COLOR.llm : ENGINE_COLOR.llm_ds }}>{lead ? "GPT-4.1" : "DeepSeek"}</b> ({Math.max(gptWins, dsWins)}×{Math.min(gptWins, dsWins)} métricas). Amostra n={resolvedTotal}.</>;
  }

  const side = (e: EngineStat | undefined, id: "llm" | "llm_ds") => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: ENGINE_COLOR[id], boxShadow: `0 0 8px ${ENGINE_COLOR[id]}` }} />
        <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#e8edf5" }}>{ENGINE_TAG[id]}</span>
      </div>
      {METRICS.map((m) => {
        const a = m.val(e), b = m.val(id === "llm" ? ds : gpt);
        const win = a != null && b != null && a > b;
        return (
          <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: "1px solid var(--line-2,#1a2230)" }}>
            <span style={{ color: MUTED, fontSize: "0.74rem" }}>{m.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: win ? 800 : 600, color: a == null ? "#535f74" : win ? GREEN : "#e8edf5", fontSize: "0.95rem" }}>
              {a == null ? "—" : m.fmt(a)}{win ? " ✓" : ""}
            </span>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: "0.68rem", color: MUTED, fontFamily: "var(--font-mono)" }}>
        {e?.emittedTotal ?? 0} emit · {e?.resolved ?? 0} resolv · {e?.open ?? 0} aberto
      </div>
    </div>
  );

  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: 14, padding: "15px 18px", marginBottom: 18, background: `linear-gradient(135deg, color-mix(in srgb, ${ENGINE_COLOR.llm} 8%, transparent), color-mix(in srgb, ${ENGINE_COLOR.llm_ds} 10%, transparent))` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#aebccd", fontWeight: 700 }}>🥊 Duelo LLM · decisão da IA</span>
        <span style={{ fontSize: "0.7rem", color: dsLive ? GREEN : "#eab308", fontWeight: 700 }}>{dsLive ? "● ambos ativos" : "● DeepSeek aguardando 1º cron"}</span>
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>
        {side(gpt, "llm")}
        <div style={{ display: "flex", alignItems: "center", fontWeight: 800, color: "#535f74", fontSize: "0.8rem" }}>VS</div>
        {side(ds, "llm_ds")}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: "0.78rem", color: "#cdd8e6", borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>{verdict}</p>
    </div>
  );
}

function EnginesTab({ engines, byClassEngine, open, byClass, byTimeframe, byAsset, bySymbolTf, equity, closed, daily, now }: { engines: EngineStat[]; byClassEngine: ClassEngines[]; open: OpenPosition[]; byClass: BreakdownRow[]; byTimeframe: BreakdownRow[]; byAsset: BreakdownRow[]; bySymbolTf: BreakdownRow[]; equity: EquityPoint[]; closed: ClosedOpRow[]; daily: DailyRow[]; now: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // Motores visíveis (colunas do comparativo + recortes).
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Filtros das listas.
  const [openEng, setOpenEng] = useState("all");
  const [openSide, setOpenSide] = useState("all");
  const [openStatus, setOpenStatus] = useState("all");
  const [closedEng, setClosedEng] = useState("all");
  const [closedSide, setClosedSide] = useState("all");
  const [closedOutcome, setClosedOutcome] = useState("all");
  const openCtl = useTableControls("unrealizedR");
  const closedCtl = useTableControls("resolvedAt");

  if (engines.every((e) => e.emittedTotal === 0)) return <p className="note">Sem sinais ainda. O comparativo aparece quando os motores começam a emitir/resolver.</p>;

  const SHORT = ENGINE_LABEL;
  const visibleIds = ENGINE_ORDER.filter((e) => !hidden.has(e));
  const cols = engines.filter((e) => !hidden.has(e.engine));
  const toggleEngine = (id: string) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(id)) n.delete(id); else if (ENGINE_ORDER.length - n.size > 1) n.add(id); // garante ≥1 visível
    return n;
  });

  // índice do melhor valor (verde) conforme a direção; -1 se empate/insuficiente.
  const bestIdx = (vals: (number | null | undefined)[], dir: "higher" | "lower" | "none"): number => {
    if (dir === "none") return -1;
    const nums = vals.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v != null);
    if (nums.length < 2) return -1;
    const sorted = [...nums].sort((a, b) => (dir === "higher" ? b.v - a.v : a.v - b.v));
    return sorted[0]!.v === sorted[1]!.v ? -1 : sorted[0]!.i;
  };

  type Dir = "higher" | "lower" | "none";
  const RED = "var(--bear,#dc2626)";
  const GREEN = "var(--bull,#16a34a)";
  const YELLOW = "var(--amber,#eab308)";
  // tone: cor por VALOR (sobrepõe o destaque do melhor). null = usa o padrão.
  type MetricRow = { label: string; get: (e: EngineStat) => string; raw: (e: EngineStat) => number | null; dir: Dir; tone?: (v: number | null) => string | null; node?: (e: EngineStat) => React.ReactNode };
  // Métricas agrupadas por tema — separadores tornam as 17 linhas escaneáveis.
  const ROW_GROUPS: { title: string; rows: MetricRow[] }[] = [
    {
      title: "Atividade",
      rows: [
        { label: "Sinais emitidos (total)", get: (e) => String(e.emittedTotal), raw: (e) => e.emittedTotal, dir: "none" },
        { label: "Frequência", get: (e) => `${e.perDay.toFixed(1)}/dia`, raw: (e) => e.perDay, dir: "none" },
        { label: "Abertos agora", get: (e) => String(e.open), raw: (e) => e.open, dir: "none", tone: (v) => (v && v > 0 ? YELLOW : null) },
        { label: "Resolvidos", get: (e) => String(e.resolved), raw: (e) => e.resolved, dir: "none" },
      ],
    },
    {
      title: "Desfechos",
      rows: [
        { label: "Operações TP (take)", get: (e) => String(e.wins), raw: (e) => e.wins, dir: "none", tone: (v) => (v && v > 0 ? GREEN : null) },
        { label: "Operações SL (stop)", get: (e) => String(e.losses), raw: (e) => e.losses, dir: "none", tone: (v) => (v && v > 0 ? RED : null) },
        { label: "Assertividade (win rate)", get: (e) => `${e.winRatePct.toFixed(1)}%`, raw: (e) => e.winRatePct, dir: "higher" },
        { label: "Stop loss (% dos decisivos)", get: (e) => (e.decisive > 0 ? `${((e.losses / e.decisive) * 100).toFixed(0)}%` : "—"), raw: (e) => (e.decisive > 0 ? (e.losses / e.decisive) * 100 : null), dir: "none", tone: (v) => (v == null ? null : RED) },
        { label: "Stops por take", get: (e) => (e.wins > 0 ? `${(e.losses / e.wins).toFixed(2)}×` : "—"), raw: (e) => (e.wins > 0 ? e.losses / e.wins : null), dir: "none", tone: (v) => (v == null ? null : v > 1 ? RED : v < 1 ? GREEN : null) },
      ],
    },
    {
      title: "Retorno (realizado)",
      rows: [
        { label: "Profit factor", get: (e) => e.profitFactor.toFixed(2), raw: (e) => e.profitFactor, dir: "higher" },
        { label: "R médio / sinal", get: (e) => sgn(e.avgR), raw: (e) => e.avgR, dir: "none", tone: (v) => (v == null ? null : v < 0 ? RED : v > 0 ? GREEN : null) },
        { label: "Ganho médio (R)", get: (e) => (e.wins > 0 ? sgn(e.avgWinR) : "—"), raw: (e) => (e.wins > 0 ? e.avgWinR : null), dir: "higher", tone: (v) => (v == null ? null : GREEN) },
        { label: "Perda média (R)", get: (e) => (e.losses > 0 ? sgn(e.avgLossR) : "—"), raw: (e) => (e.losses > 0 ? e.avgLossR : null), dir: "none", tone: (v) => (v == null ? null : RED) },
        { label: "Payoff (ganho / |perda|)", get: (e) => (e.wins > 0 && e.losses > 0 ? `${e.payoff.toFixed(2)}×` : "—"), raw: (e) => (e.wins > 0 && e.losses > 0 ? e.payoff : null), dir: "higher", tone: (v) => (v == null ? null : v >= 1 ? GREEN : RED) },
        { label: "R acumulado (realizado)", get: (e) => sgn(e.totalR, 1), raw: (e) => e.totalR, dir: "none", tone: (v) => (v == null ? null : v < 0 ? RED : v > 0 ? GREEN : null) },
      ],
    },
    {
      title: "Posições abertas (não-realizado)",
      rows: [
        { label: "Abertos em lucro / prejuízo / neutro", get: (e) => `${e.openInProfit} / ${e.openInLoss} / ${e.openNeutral}`, raw: () => null, dir: "none", node: (e) => (<><span style={{ color: GREEN, fontWeight: 700 }}>{e.openInProfit}</span> / <span style={{ color: RED, fontWeight: 700 }}>{e.openInLoss}</span> / <span style={{ color: "#94a3b8", fontWeight: 700 }}>{e.openNeutral}</span></>) },
        { label: "R não-realizado (abertos)", get: (e) => sgn(e.openUnrealizedR, 1), raw: (e) => e.openUnrealizedR, dir: "none", tone: (v) => (v == null ? null : v < 0 ? RED : v > 0 ? GREEN : null) },
      ],
    },
  ];

  // ---- listas: filtro + ordenação (client-side) ----
  const openAcc = (o: OpenPosition, k: string): string | number | null => {
    switch (k) {
      case "engine": return o.engine; case "symbol": return o.symbol; case "side": return o.side;
      case "entry": return o.entry; case "currentPrice": return o.currentPrice; case "unrealizedR": return o.unrealizedR;
      case "status": return o.status; case "emittedAt": return o.emittedAt ? new Date(o.emittedAt).getTime() : null;
      default: return null;
    }
  };
  const statusMatch = (s: OpenPosition["status"]) => openStatus === "all" || (openStatus === "lucro" ? s === "profit" : openStatus === "prejuizo" ? s === "loss" : s === "flat" || s === "unknown");
  const openRows = applySort(
    open.filter((o) => (openEng === "all" || o.engine === openEng) && (openSide === "all" || o.side === openSide) && statusMatch(o.status)),
    openCtl.sort, openAcc,
  );

  const closedAcc = (o: ClosedOpRow, k: string): string | number | null => {
    switch (k) {
      case "engine": return o.engine; case "symbol": return o.symbol; case "side": return o.side;
      case "outcome": return o.outcome; case "pnlR": return o.pnlR;
      case "resolvedAt": return o.resolvedAt ? new Date(o.resolvedAt).getTime() : null;
      default: return null;
    }
  };
  const outcomeMatch = (oc: string) => closedOutcome === "all" || (closedOutcome === "take" ? /^TP/.test(oc) : closedOutcome === "stop" ? oc === "SL" : oc === "EXPIRED");
  const closedRows = applySort(
    closed.filter((o) => (closedEng === "all" || o.engine === closedEng) && (closedSide === "all" || o.side === closedSide) && outcomeMatch(o.outcome)),
    closedCtl.sort, closedAcc,
  );

  return (
    <div className="motores-tab" style={{ color: "#e8edf5" }}>
      <LlmDuel engines={engines} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.78rem", color: "#aebccd" }}>Motores visíveis:</span>
          {ENGINE_ORDER.map((id) => {
            const on = !hidden.has(id);
            return (
              <button key={id} type="button" onClick={() => toggleEngine(id)}
                style={{ ...FIELD, cursor: "pointer", fontSize: "0.78rem", fontWeight: on ? 700 : 500, padding: "5px 11px", display: "inline-flex", alignItems: "center", gap: 6, background: on ? "color-mix(in srgb, var(--cyan, #54a8ff) 14%, transparent)" : "var(--panel-2, #0a0e15)", color: on ? "var(--ink, #e9effa)" : "var(--ink-faint, #535f74)", borderColor: on ? "color-mix(in srgb, var(--cyan, #54a8ff) 45%, transparent)" : "var(--line-2)", opacity: on ? 1 : 0.75 }}>
                <EngineDot id={id} />{ENGINE_LABEL[id]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          style={{ ...FIELD, cursor: refreshing ? "wait" : "pointer", fontWeight: 700, background: "var(--cyan, #54a8ff)", color: "#04121a", borderColor: "var(--cyan, #54a8ff)", opacity: refreshing ? 0.7 : 1 }}
        >
          {refreshing ? "Atualizando…" : "↻ Atualizar dados"}
        </button>
      </div>
      <p className="note" style={{ fontSize: "0.82rem", marginBottom: 14, maxWidth: "92ch" }}>
        Comparação <b>forward</b> entre os motores. <b>Padrão</b> e <b>Classe</b> = motores vivos. Experimentais (emitidos em paralelo):
        <b> Padrão-B</b> (ATR ×1,4), <b>Classe-B</b> (convicção ≥20 + ATR ×1,4), <b>GPT-4.1</b> e <b>DeepSeek</b> (decisão da IA — ver duelo acima),
        <b> Condicional</b> (lógica por regime), <b>Contrário</b> (controle — inverso do Padrão) e <b>Consenso</b> (Padrão ∩ Classe).
        <b> Realizado</b> = fechados pelo cron; <b>não-realizado</b> = abertos a mercado.
      </p>

      <div style={{ overflowX: "auto", border: "1px solid var(--line-2)", borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 220 + cols.length * 104 }}>
          <thead>
            <tr style={ROW}>
              <th style={{ ...TH, ...STICKY_COL, textAlign: "left" }}>Métrica</th>
              {cols.map((e) => (
                <th key={e.engine} style={{ ...TH, textAlign: "right", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><EngineDot id={e.engine} />{SHORT[e.engine] ?? e.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_GROUPS.map((g) => (
              <Fragment key={g.title}>
                <tr>
                  <td colSpan={cols.length + 1} style={{ ...STICKY_COL, padding: "10px 12px 5px", fontFamily: "var(--font-mono)", fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint, #535f74)", borderBottom: "1px solid var(--line-2)", background: "var(--panel-2, #0a0e15)", position: "static" }}>
                    {g.title}
                  </td>
                </tr>
                {g.rows.map((r, i) => {
                  const vals = cols.map((e) => r.raw(e));
                  const bi = bestIdx(vals, r.dir);
                  // tone (cor por valor) tem prioridade; senão, verde no melhor; senão, claro.
                  const hl = (best: boolean, tone: string | null): React.CSSProperties => ({ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: best || tone ? 700 : 500, color: tone ?? (best ? "var(--bull,#16a34a)" : "#e8edf5") });
                  return (
                    <tr key={i} style={ROW}>
                      <td style={{ ...TD, ...STICKY_COL, color: "#aebccd", whiteSpace: "nowrap" }}>{r.label}</td>
                      {cols.map((e, j) => {
                        const tone = r.tone ? r.tone(vals[j] ?? null) : null;
                        return <td key={e.engine} style={hl(j === bi, tone)}>{r.node ? r.node(e) : r.get(e)}</td>;
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <RankingTable engines={cols} byClass={byClassEngine} visibleIds={visibleIds} />
      </div>

      <h3 style={{ margin: "24px 0 8px", fontSize: "0.95rem" }}>Curva de R acumulado (realizado, forward)</h3>
      <EquityChart equity={equity} engineIds={visibleIds} />

      <div style={{ marginTop: 24 }}>
        <DailyBoard daily={daily} engines={cols} engineIds={visibleIds} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 24 }}>
        <BreakdownTable title="Por classe de ativo" rows={byClass} engineIds={visibleIds} />
        <BreakdownTable title="Por timeframe" rows={byTimeframe} engineIds={visibleIds} />
        <BreakdownTable title="Por ativo" rows={byAsset} engineIds={visibleIds} />
        <BreakdownTable title="Por timeframe e ativo" rows={bySymbolTf} engineIds={visibleIds} />
      </div>

      <h3 style={{ margin: "24px 0 8px", fontSize: "0.95rem" }}>Posições abertas · marcadas a mercado agora</h3>
      {open.length === 0 ? (
        <p className="note">Nenhuma posição aberta no momento.</p>
      ) : (
        <>
          <div style={FILTER_BAR}>
            <FilterSelect value={openEng} onChange={setOpenEng} options={ENGINE_FILTER_OPTS} />
            <FilterSelect value={openSide} onChange={setOpenSide} options={SIDE_OPTS} />
            <FilterSelect value={openStatus} onChange={setOpenStatus} options={OPEN_STATUS_OPTS} />
          </div>
          {openRows.length === 0 ? <p className="note">Nenhuma posição aberta com esses filtros.</p> : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", minWidth: 620 }}>
            <thead>
              <tr style={ROW}>
                <SortHeader label="Motor" k="engine" sort={openCtl.sort} onSort={openCtl.onSort} />
                <SortHeader label="Ativo" k="symbol" sort={openCtl.sort} onSort={openCtl.onSort} />
                <SortHeader label="Lado" k="side" sort={openCtl.sort} onSort={openCtl.onSort} />
                <SortHeader label="Entrada" k="entry" sort={openCtl.sort} onSort={openCtl.onSort} align="right" />
                <SortHeader label="Preço atual" k="currentPrice" sort={openCtl.sort} onSort={openCtl.onSort} align="right" />
                <SortHeader label="R atual" k="unrealizedR" sort={openCtl.sort} onSort={openCtl.onSort} align="right" />
                <SortHeader label="Situação" k="status" sort={openCtl.sort} onSort={openCtl.onSort} />
                <SortHeader label="Aberto há" k="emittedAt" sort={openCtl.sort} onSort={openCtl.onSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {openRows.map((o, i) => {
                const st = STATUS_PT[o.status];
                return (
                  <tr key={i} style={ROW}>
                    <td style={TD}>{ENGINE_TAG[o.engine] ?? o.engine}</td>
                    <td style={TD}><b>{o.symbol}</b> · {o.timeframe.toUpperCase()}</td>
                    <td style={{ ...TD, color: o.side === "sell" ? "var(--bear,#dc2626)" : "var(--bull,#16a34a)" }}>{o.side === "sell" ? "Venda" : "Compra"}</td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.entry.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{o.currentPrice != null ? o.currentPrice.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—"}</td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: st.color }}>{o.unrealizedR != null ? sgn(o.unrealizedR) : "—"}</td>
                    <td style={{ ...TD, color: st.color, fontWeight: 600 }}>{st.label}</td>
                    <td style={{ ...TD, textAlign: "right" }}>{ago(o.emittedAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
        </>
      )}
      <p className="note" style={{ fontSize: "0.76rem", marginTop: 12, maxWidth: "78ch" }}>
        "R atual" = quanto a operação renderia (em múltiplos de risco) se fechasse agora, marcando o preço de mercado contra a
        entrada e o stop. Atualiza a cada carregamento do painel. As estatísticas realizadas só consolidam quando o cron
        <b> resolve-signals</b> fecha o desfecho contra os candles seguintes.
      </p>

      <h3 style={{ margin: "24px 0 8px", fontSize: "0.95rem" }}>Operações fechadas · recentes</h3>
      {closed.length === 0 ? (
        <p className="note">Nenhuma operação fechada ainda. Aparecem aqui quando o cron resolve TP/SL/expiração.</p>
      ) : (
        <>
          <div style={FILTER_BAR}>
            <FilterSelect value={closedEng} onChange={setClosedEng} options={ENGINE_FILTER_OPTS} />
            <FilterSelect value={closedSide} onChange={setClosedSide} options={SIDE_OPTS} />
            <FilterSelect value={closedOutcome} onChange={setClosedOutcome} options={CLOSED_OUTCOME_OPTS} />
          </div>
          {closedRows.length === 0 ? <p className="note">Nenhuma operação fechada com esses filtros.</p> : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", minWidth: 620 }}>
            <thead>
              <tr style={ROW}>
                <SortHeader label="Motor" k="engine" sort={closedCtl.sort} onSort={closedCtl.onSort} />
                <SortHeader label="Ativo" k="symbol" sort={closedCtl.sort} onSort={closedCtl.onSort} />
                <SortHeader label="Lado" k="side" sort={closedCtl.sort} onSort={closedCtl.onSort} />
                <SortHeader label="Desfecho" k="outcome" sort={closedCtl.sort} onSort={closedCtl.onSort} />
                <SortHeader label="R" k="pnlR" sort={closedCtl.sort} onSort={closedCtl.onSort} align="right" />
                <SortHeader label="Fechado" k="resolvedAt" sort={closedCtl.sort} onSort={closedCtl.onSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {closedRows.map((o, i) => {
                const win = /^TP/.test(o.outcome);
                const oc = win
                  ? { label: `Take (${o.outcome})`, color: GREEN }
                  : o.outcome === "SL" ? { label: "Stop", color: RED } : { label: "Expirou", color: "#94a3b8" };
                return (
                  <tr key={i} style={ROW}>
                    <td style={TD}>{ENGINE_TAG[o.engine] ?? o.engine}</td>
                    <td style={TD}><b>{o.symbol}</b> · {o.timeframe.toUpperCase()}</td>
                    <td style={{ ...TD, color: o.side === "sell" ? RED : GREEN }}>{o.side === "sell" ? "Venda" : "Compra"}</td>
                    <td style={{ ...TD, color: oc.color, fontWeight: 600 }}>{oc.label}</td>
                    <td style={{ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: o.pnlR >= 0 ? GREEN : RED }}>{sgn(o.pnlR)}</td>
                    <td style={{ ...TD, textAlign: "right" }}>{ago(o.resolvedAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          )}
        </>
      )}
    </div>
  );
}
