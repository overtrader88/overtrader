"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminUserRow, type AdminUser } from "./admin-user-row";
import { NotifyButton } from "./admin-notify-button";
import { type AdminExtra, type EngineStat, type OpenPosition, type BreakdownRow, type EquityPoint, MRR_PRICE } from "./admin-shared";

const ANALYSIS_COST = 0.013; // R$ por análise (LLM + dados)

type Tab = "users" | "risk" | "expiring" | "growth" | "revenue" | "funnel" | "consumption" | "cohort" | "hubla" | "audit" | "ops" | "motores";
type Bucket = "day" | "week" | "month";

const FIELD: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border,#cbd5e1)",
  background: "#fff", color: "#0f172a", fontSize: "0.85rem",
};
const CARD: React.CSSProperties = { border: "1px solid var(--border-faint,#e4e8ef)", borderRadius: 10, padding: "14px 18px" };
const TH: React.CSSProperties = { padding: "8px 10px" };
const TD: React.CSSProperties = { padding: "8px 10px" };
const ROW: React.CSSProperties = { borderBottom: "1px solid var(--border-faint,#e4e8ef)" };
const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 86_400_000;

function tabBtn(active: boolean): React.CSSProperties {
  return { ...FIELD, cursor: "pointer", fontWeight: active ? 700 : 500, background: active ? "var(--accent,#2563eb)" : "#fff", color: active ? "#fff" : "#0f172a", borderColor: active ? "var(--accent,#2563eb)" : "var(--border,#cbd5e1)" };
}
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
          <div style={{ flex: 1, background: "var(--border-faint,#eef2f7)", borderRadius: 6, height: 22 }}>
            <div style={{ width: `${(s.count / max) * 100}%`, minWidth: 2, height: "100%", background: "var(--accent,#2563eb)", borderRadius: 6 }} />
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
    ["hubla", "Hubla"],
    ["audit", "Auditoria"],
    ["ops", "Saúde"],
    ["motores", "Motores"],
  ];
  const hasFilter = q || planF || monthF;
  const stageStyle: React.CSSProperties = { ...CARD, flex: "1 1 140px", textAlign: "center" };

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} style={tabBtn(tab === k)}>{label}</button>)}
      </div>

      {/* ---- USUÁRIOS ---- */}
      {tab === "users" ? (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
            <input type="text" placeholder="Buscar nome ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...FIELD, minWidth: 220, flex: "1 1 220px" }} />
            <select value={planF} onChange={(e) => setPlanF(e.target.value)} style={FIELD}>
              <option value="">Todos os planos</option><option value="free">FREE</option><option value="pro">PRO</option><option value="pro_plus">PRO+</option>
            </select>
            <select value={monthF} onChange={(e) => setMonthF(e.target.value)} style={FIELD}>
              <option value="">Qualquer mês</option>
              {monthOptions.map((m) => <option key={m} value={m}>{monthLbl(m)}</option>)}
            </select>
            {hasFilter ? <button type="button" onClick={() => { setQ(""); setPlanF(""); setMonthF(""); }} style={{ ...FIELD, cursor: "pointer" }}>Limpar</button> : null}
            <span className="note" style={{ fontSize: "0.8rem" }}>{filtered.length} de {users.length}</span>
          </div>
          <div className="tbl" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead><tr style={{ textAlign: "left", borderBottom: "2px solid var(--border,#cbd5e1)" }}>
                <th style={TH}>Usuário</th><th style={TH}>Cód. compra (Hubla)</th><th style={TH}>Créditos</th><th style={TH}>Cadastro</th><th style={TH}>Plano</th>
              </tr></thead>
              <tbody>{filtered.map((u) => <AdminUserRow key={u.id} user={u} />)}</tbody>
            </table>
            {filtered.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>{users.length === 0 ? "Nenhum usuário ainda." : "Nenhum usuário com esses filtros."}</p> : null}
          </div>
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
                <tr key={u.id} style={ROW}><td style={TD}>{u.email}</td><td style={TD}>{planLbl(u.plan)}</td><td style={{ ...TD, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{u.analysisCount}</td></tr>
              ))}</tbody>
            </table>
            {consumption.top.length === 0 ? <p className="note" style={{ padding: 20, textAlign: "center" }}>Nenhuma análise ainda.</p> : null}
          </div>
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
          open={extra.engines?.open ?? []}
          byClass={extra.engines?.byClass ?? []}
          byTimeframe={extra.engines?.byTimeframe ?? []}
          equity={extra.engines?.equity ?? []}
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

/** Curva de R acumulado por motor (SVG, duas linhas). */
function EquityChart({ equity }: { equity: EquityPoint[] }) {
  if (equity.length < 2) return <p className="note">A curva aparece quando houver ≥2 desfechos resolvidos.</p>;
  const W = 100, H = 40, PAD = 2;
  const vals = [...equity.map((e) => e.padrao), ...equity.map((e) => e.classe), 0];
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const x = (i: number) => (equity.length === 1 ? 0 : (i / (equity.length - 1)) * (W - PAD * 2) + PAD);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const line = (key: "padrao" | "classe") => equity.map((e, i) => `${x(i).toFixed(2)},${y(e[key]).toFixed(2)}`).join(" ");
  const y0 = y(0);
  const lastP = equity[equity.length - 1]!.padrao;
  const lastC = equity[equity.length - 1]!.classe;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 160, border: "1px solid var(--border-faint,#e4e8ef)", borderRadius: 10, background: "#fff" }}>
        <line x1={0} y1={y0} x2={W} y2={y0} stroke="#cbd5e1" strokeWidth={0.3} strokeDasharray="1,1" />
        <polyline points={line("padrao")} fill="none" stroke="#2563eb" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <polyline points={line("classe")} fill="none" stroke="#9333ea" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, fontSize: "0.8rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#2563eb", display: "inline-block" }} /> Motor padrão <b style={{ color: lastP >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{sgn(lastP, 1)} R</b></span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: "#9333ea", display: "inline-block" }} /> Motor por classe <b style={{ color: lastC >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{sgn(lastC, 1)} R</b></span>
      </div>
    </div>
  );
}

/** Tabela de recorte (classe ou TF) × motor. */
function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const cell = (g: BreakdownRow["padrao"]) =>
    g.n === 0 ? <span className="note">—</span> : (
      <>
        n={g.n} · {g.winRatePct.toFixed(0)}% · <b style={{ color: g.totalR >= 0 ? "var(--bull,#16a34a)" : "var(--bear,#dc2626)" }}>{sgn(g.totalR, 1)}R</b>
      </>
    );
  return (
    <div style={{ flex: "1 1 320px" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "0.9rem" }}>{title}</h3>
      {rows.length === 0 ? <p className="note">Sem desfechos resolvidos ainda.</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead><tr style={ROW}><th style={{ ...TH, textAlign: "left" }}>Grupo</th><th style={{ ...TH, textAlign: "left" }}>Padrão</th><th style={{ ...TH, textAlign: "left" }}>Por classe</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={ROW}>
                <td style={TD}><b>{r.label}</b></td>
                <td style={TD}>{cell(r.padrao)}</td>
                <td style={TD}>{cell(r.classe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EnginesTab({ engines, open, byClass, byTimeframe, equity, now }: { engines: EngineStat[]; open: OpenPosition[]; byClass: BreakdownRow[]; byTimeframe: BreakdownRow[]; equity: EquityPoint[]; now: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const p = engines.find((e) => e.engine === "padrao");
  const c = engines.find((e) => e.engine === "classe");
  if (!p && !c) return <p className="note">Sem sinais ainda. O comparativo aparece quando os motores começam a emitir/resolver.</p>;

  // destaca o melhor valor (verde) conforme a direção da métrica.
  const pick = (a: number | null | undefined, b: number | null | undefined, dir: "higher" | "lower" | "none"): [boolean, boolean] => {
    if (dir === "none" || a == null || b == null || a === b) return [false, false];
    const pWins = dir === "higher" ? a > b : a < b;
    return pWins ? [true, false] : [false, true];
  };

  type Dir = "higher" | "lower" | "none";
  const ROWS: { label: string; get: (e: EngineStat) => string; raw: (e: EngineStat) => number | null; dir: Dir }[] = [
    { label: "Sinais emitidos (total)", get: (e) => String(e.emittedTotal), raw: (e) => e.emittedTotal, dir: "none" },
    { label: "Frequência", get: (e) => `${e.perDay.toFixed(1)}/dia`, raw: (e) => e.perDay, dir: "none" },
    { label: "Abertos agora", get: (e) => String(e.open), raw: (e) => e.open, dir: "none" },
    { label: "Resolvidos", get: (e) => String(e.resolved), raw: (e) => e.resolved, dir: "none" },
    { label: "Decisivos (TP+SL)", get: (e) => String(e.decisive), raw: (e) => e.decisive, dir: "none" },
    { label: "Assertividade (win rate)", get: (e) => `${e.winRatePct.toFixed(1)}%`, raw: (e) => e.winRatePct, dir: "higher" },
    { label: "Stop loss (% dos decisivos)", get: (e) => (e.decisive > 0 ? `${((e.losses / e.decisive) * 100).toFixed(0)}%` : "—"), raw: (e) => (e.decisive > 0 ? (e.losses / e.decisive) * 100 : null), dir: "lower" },
    { label: "Stops por take", get: (e) => (e.wins > 0 ? `${(e.losses / e.wins).toFixed(2)}×` : "—"), raw: (e) => (e.wins > 0 ? e.losses / e.wins : null), dir: "lower" },
    { label: "Profit factor", get: (e) => e.profitFactor.toFixed(2), raw: (e) => e.profitFactor, dir: "higher" },
    { label: "R médio / sinal", get: (e) => sgn(e.avgR), raw: (e) => e.avgR, dir: "higher" },
    { label: "R acumulado (realizado)", get: (e) => sgn(e.totalR, 1), raw: (e) => e.totalR, dir: "higher" },
    { label: "Abertos em lucro / prejuízo", get: (e) => `${e.openInProfit} / ${e.openInLoss}`, raw: () => null, dir: "none" },
    { label: "R não-realizado (abertos)", get: (e) => sgn(e.openUnrealizedR, 1), raw: (e) => e.openUnrealizedR, dir: "higher" },
  ];

  return (
    <div className="motores-tab" style={{ color: "#e8edf5" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          style={{ ...FIELD, cursor: refreshing ? "wait" : "pointer", fontWeight: 600, background: "var(--accent,#2563eb)", color: "#fff", borderColor: "var(--accent,#2563eb)", opacity: refreshing ? 0.7 : 1 }}
        >
          {refreshing ? "Atualizando…" : "↻ Atualizar dados"}
        </button>
      </div>
      <p className="note" style={{ fontSize: "0.82rem", marginBottom: 14, maxWidth: "78ch" }}>
        Comparação <b>forward</b> entre os dois motores nos mercados curados. <b>Realizado</b> = desfechos fechados pelo cron
        (TP/SL). <b>Não-realizado</b> = posições abertas marcadas a mercado AGORA (fecharia em lucro ou prejuízo). Win rate / PF / R
        seguem a mesma matemática do track record público (forward, sem reotimização).
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", minWidth: 460 }}>
          <thead>
            <tr style={ROW}>
              <th style={{ ...TH, textAlign: "left" }}>Métrica</th>
              <th style={{ ...TH, textAlign: "right" }}>Motor padrão</th>
              <th style={{ ...TH, textAlign: "right" }}>Motor por classe</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => {
              const pv = p ? r.raw(p) : undefined;
              const cv = c ? r.raw(c) : undefined;
              const [pBest, cBest] = pick(pv, cv, r.dir);
              const hl = (best: boolean): React.CSSProperties => ({ ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: best ? 700 : 500, color: best ? "var(--bull,#16a34a)" : "#e8edf5" });
              return (
                <tr key={i} style={ROW}>
                  <td style={{ ...TD, color: "#aebccd" }}>{r.label}</td>
                  <td style={hl(pBest)}>{p ? r.get(p) : "—"}</td>
                  <td style={hl(cBest)}>{c ? r.get(c) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ margin: "24px 0 8px", fontSize: "0.95rem" }}>Curva de R acumulado (realizado, forward)</h3>
      <EquityChart equity={equity} />

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 24 }}>
        <BreakdownTable title="Por classe de ativo" rows={byClass} />
        <BreakdownTable title="Por timeframe" rows={byTimeframe} />
      </div>

      <h3 style={{ margin: "24px 0 8px", fontSize: "0.95rem" }}>Posições abertas · marcadas a mercado agora</h3>
      {open.length === 0 ? (
        <p className="note">Nenhuma posição aberta no momento.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem", minWidth: 620 }}>
            <thead>
              <tr style={ROW}>
                <th style={{ ...TH, textAlign: "left" }}>Motor</th>
                <th style={{ ...TH, textAlign: "left" }}>Ativo</th>
                <th style={{ ...TH, textAlign: "left" }}>Lado</th>
                <th style={{ ...TH, textAlign: "right" }}>Entrada</th>
                <th style={{ ...TH, textAlign: "right" }}>Preço atual</th>
                <th style={{ ...TH, textAlign: "right" }}>R atual</th>
                <th style={{ ...TH, textAlign: "left" }}>Situação</th>
                <th style={{ ...TH, textAlign: "right" }}>Aberto há</th>
              </tr>
            </thead>
            <tbody>
              {open.map((o, i) => {
                const st = STATUS_PT[o.status];
                return (
                  <tr key={i} style={ROW}>
                    <td style={TD}>{o.engine === "classe" ? "⚙ Classe" : "Padrão"}</td>
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
      <p className="note" style={{ fontSize: "0.76rem", marginTop: 12, maxWidth: "78ch" }}>
        "R atual" = quanto a operação renderia (em múltiplos de risco) se fechasse agora, marcando o preço de mercado contra a
        entrada e o stop. Atualiza a cada carregamento do painel. As estatísticas realizadas só consolidam quando o cron
        <b> resolve-signals</b> fecha o desfecho contra os candles seguintes.
      </p>
    </div>
  );
}
