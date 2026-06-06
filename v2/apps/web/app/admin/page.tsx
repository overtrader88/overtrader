import { redirect } from "next/navigation";
import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";
import { type AdminUser } from "@/components/admin-user-row";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) redirect("/dashboard");

  const sb = supabaseService();
  let users: AdminUser[] = [];
  if (sb) {
    const [{ data: profs }, { data: creds }, { data: subs }] = await Promise.all([
      sb.from("profiles").select("id, email, full_name, plan, created_at").order("created_at", { ascending: false }).limit(1000),
      sb.from("user_credits").select("user_id, balance"),
      sb.from("subscriptions").select("user_id, hubla_event_id, current_period_end, status, created_at").order("created_at", { ascending: false }),
    ]);
    const balByUser = new Map<string, number>();
    for (const c of (creds ?? []) as { user_id: string; balance: number }[]) balByUser.set(c.user_id, c.balance);
    // Subscription mais recente por usuário (subs vem ordenado desc) → código Hubla + vencimento.
    const subByUser = new Map<string, { hubla: string | null; periodEnd: string | null }>();
    for (const s of (subs ?? []) as { user_id: string; hubla_event_id: string | null; current_period_end: string | null; status: string }[]) {
      if (!subByUser.has(s.user_id)) subByUser.set(s.user_id, { hubla: s.hubla_event_id, periodEnd: s.status === "active" ? s.current_period_end : null });
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
    }));
  }

  const total = users.length;
  const byPlan = { free: 0, pro: 0, pro_plus: 0 } as Record<string, number>;
  for (const u of users) byPlan[u.plan] = (byPlan[u.plan] ?? 0) + 1;
  const paid = (byPlan.pro ?? 0) + (byPlan.pro_plus ?? 0);
  const mrr = (byPlan.pro ?? 0) * 97 + (byPlan.pro_plus ?? 0) * 197;

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
          <div style={cardStyle}><div className="note" style={{ fontSize: "0.75rem" }}>MRR estimado</div><div style={{ fontSize: "1.6rem", fontWeight: 700 }}>R${mrr.toLocaleString("pt-BR")}</div></div>
        </div>

        <AdminPanel users={users} now={Date.now()} />

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
