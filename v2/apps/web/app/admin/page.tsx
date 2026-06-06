import { redirect } from "next/navigation";
import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";
import { type AdminUser } from "@/components/admin-user-row";
import { AdminPanel } from "@/components/admin-panel";
import { type AdminExtra, mrrFromSubs } from "@/components/admin-shared";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) redirect("/dashboard");

  const sb = supabaseService();
  let users: AdminUser[] = [];
  let extra: AdminExtra = { audit: [], analysisSeries: [], activeSubs: [], ops: { lastSignalAt: null, lastCheckedAt: null, lastResolvedAt: null, openSignals: 0, lastHublaAt: null, lastAnalysisAt: null } };
  if (sb) {
    const [{ data: profs }, { data: creds }, { data: subs }, { data: analyses }, { data: audit }, { data: signals }] = await Promise.all([
      sb.from("profiles").select("id, email, full_name, plan, created_at").order("created_at", { ascending: false }).limit(1000),
      sb.from("user_credits").select("user_id, balance"),
      sb.from("subscriptions").select("user_id, hubla_event_id, current_period_end, status, plan, period, created_at").order("created_at", { ascending: false }),
      sb.from("analyses").select("user_id, created_at").order("created_at", { ascending: false }).limit(5000),
      sb.from("audit_log").select("id, actor, action, target, metadata, created_at").order("created_at", { ascending: false }).limit(300),
      sb.from("signals").select("emitted_at, checked_at, resolved_at, outcome").order("emitted_at", { ascending: false }).limit(500),
    ]);

    const balByUser = new Map<string, number>();
    for (const c of (creds ?? []) as { user_id: string; balance: number }[]) balByUser.set(c.user_id, c.balance);

    // Subscription mais recente por usuário (subs vem ordenado desc) → código Hubla + vencimento.
    const subByUser = new Map<string, { hubla: string | null; periodEnd: string | null }>();
    // Assinatura ATIVA mais recente por usuário → MRR real.
    const activeByUser = new Map<string, { plan: string; period: string }>();
    for (const s of (subs ?? []) as { user_id: string; hubla_event_id: string | null; current_period_end: string | null; status: string; plan: string; period: string }[]) {
      if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, { hubla: s.hubla_event_id, periodEnd: s.status === "active" ? s.current_period_end : null });
      if (s.status === "active" && !activeByUser.has(s.user_id)) activeByUser.set(s.user_id, { plan: s.plan, period: s.period });
    }

    // Agregados de análises por usuário (rows ordenados desc → 1º = mais recente).
    const aCount = new Map<string, number>();
    const aLast = new Map<string, string>();
    const dayCount = new Map<string, number>();
    for (const a of (analyses ?? []) as { user_id: string; created_at: string }[]) {
      aCount.set(a.user_id, (aCount.get(a.user_id) ?? 0) + 1);
      if (!aLast.has(a.user_id)) aLast.set(a.user_id, a.created_at);
      const d = a.created_at.slice(0, 10);
      dayCount.set(d, (dayCount.get(d) ?? 0) + 1);
    }

    users = ((profs ?? []) as { id: string; email: string; full_name: string | null; plan: string; created_at: string }[]).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      plan: p.plan,
      credits: balByUser.get(p.id) ?? 0,
      createdAt: p.created_at,
      hublaCode: subByUser.get(p.id)?.hubla ?? null,
      periodEnd: subByUser.get(p.id)?.periodEnd ?? null,
      analysisCount: aCount.get(p.id) ?? 0,
      lastAnalysisAt: aLast.get(p.id) ?? null,
    }));

    // Ops: proxies de saúde do sistema.
    const sigRows = (signals ?? []) as { emitted_at: string; checked_at: string | null; resolved_at: string | null; outcome: string | null }[];
    const maxOf = (vals: (string | null)[]) => { const v = vals.filter(Boolean) as string[]; return v.length ? v.sort().at(-1)! : null; };
    const auditRows = (audit ?? []) as AdminExtra["audit"];
    const lastHubla = auditRows.find((a) => a.action === "activate_sub" || a.action === "deactivate_sub");

    extra = {
      audit: auditRows,
      analysisSeries: [...dayCount.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      activeSubs: [...activeByUser.values()],
      ops: {
        lastSignalAt: sigRows[0]?.emitted_at ?? null,
        lastCheckedAt: maxOf(sigRows.map((s) => s.checked_at)),
        lastResolvedAt: maxOf(sigRows.map((s) => s.resolved_at)),
        openSignals: sigRows.filter((s) => !s.outcome).length,
        lastHublaAt: lastHubla?.created_at ?? null,
        lastAnalysisAt: ((analyses ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null,
      },
    };
  }

  const total = users.length;
  const byPlan = { free: 0, pro: 0, pro_plus: 0 } as Record<string, number>;
  for (const u of users) byPlan[u.plan] = (byPlan[u.plan] ?? 0) + 1;
  const paid = (byPlan.pro ?? 0) + (byPlan.pro_plus ?? 0);
  const mrr = mrrFromSubs(extra.activeSubs); // MRR REAL (assinaturas ativas), não estimado

  const cardStyle: React.CSSProperties = { border: "1px solid var(--border-faint,#e4e8ef)", borderRadius: 10, padding: "14px 18px" };

  return (
    <div className="hist-page">
      <AppBar credits={user.credits} plan={planLabel(user.plan)} initials={initialsOf(user)} email={user.email} />
      <div className="wrap">
        <div className="head2"><div><h1>Admin</h1><div className="meta">Painel de gestão · {user.email}</div></div></div>

        {/* Métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, margin: "12px 0 24px" }}>
          <div style={cardStyle}><div className="note" style={{ fontSize: "0.75rem" }}>Usuários</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{total}</div></div>
          <div style={cardStyle}><div className="note" style={{ fontSize: "0.75rem" }}>Pagantes</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{paid}</div></div>
          <div style={cardStyle}><div className="note" style={{ fontSize: "0.75rem" }}>PRO · PRO+</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{byPlan.pro ?? 0} · {byPlan.pro_plus ?? 0}</div></div>
          <div style={cardStyle}><div className="note" style={{ fontSize: "0.75rem" }}>MRR real</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>R${mrr.toLocaleString("pt-BR")}</div></div>
        </div>

        <AdminPanel users={users} now={Date.now()} extra={extra} />

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
