import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { LiveTrading } from "@/components/live-trading";

export const dynamic = "force-dynamic";

export default async function AoVivoPage() {
  const user = await getCurrentUser();
  return (
    <div className="hist-page">
      <AppBar
        active="ao-vivo"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="wrap">
        <div className="head2">
          <div>
            <h1>Trading ao vivo</h1>
            <div className="meta">A IA lê o gráfico, desenha o plano e narra — com prova (n · IC · selo). Análise, não recomendação.</div>
          </div>
        </div>
        <LiveTrading />
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
