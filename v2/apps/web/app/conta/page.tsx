import { AppBar, Panel, PanelLabel } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua conta — Overtrader" };

export default async function ContaPage() {
  const user = await getCurrentUser();
  return (
    <div className="conta-page">
      <AppBar
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="wrap conta">
        <div className="ctx">
          <div>
            <h1 className="page-title">Sua conta</h1>
            <div className="sub">
              {user?.email ?? "—"} · plano <b style={{ color: "var(--cyan)" }}>{user ? planLabel(user.plan) : "—"}</b>
            </div>
          </div>
        </div>

        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Panel>
            <PanelLabel>Alterar senha</PanelLabel>
            <ChangePasswordForm />
          </Panel>

          <Panel>
            <PanelLabel>Dados da conta</PanelLabel>
            <div className="conta-info">
              <div className="ci-row"><span className="k">E-mail</span><span className="v">{user?.email ?? "—"}</span></div>
              <div className="ci-row"><span className="k">Plano</span><span className="v">{user ? planLabel(user.plan) : "—"}</span></div>
              <div className="ci-row"><span className="k">Créditos</span><span className="v">{user?.credits ?? 0}</span></div>
            </div>
            <p className="cpw-hint" style={{ marginTop: 14 }}>
              Para gerenciar assinatura e créditos, vá em <a href="/planos" style={{ color: "var(--cyan)" }}>Planos &amp; créditos</a>.
            </p>
          </Panel>
        </div>

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
