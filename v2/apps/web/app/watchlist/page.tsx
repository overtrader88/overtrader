import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { WatchlistManager } from "@/components/watchlist-manager";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const user = await getCurrentUser();
  return (
    <div className="hist-page">
      <AppBar active={undefined} credits={user?.credits} plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} />
      <div className="wrap">
        <div className="head2">
          <div>
            <h1 className="page-title">Watchlist</h1>
            <div className="meta">Acompanhe ativos e receba alerta quando formarem o sinal que você escolher. Adicione, remova e ajuste o limiar aqui.</div>
          </div>
        </div>
        <WatchlistManager />
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
