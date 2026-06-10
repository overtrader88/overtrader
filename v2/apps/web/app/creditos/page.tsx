import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { listActiveLive } from "@/lib/live/session";
import { getMonitorStatus } from "@/lib/monitor";
import { findAsset } from "@/lib/market/catalog";
import { LiveActiveList, type ActiveLiveItem } from "@/components/live-active-list";

export const dynamic = "force-dynamic";

const SOURCE_PT: Record<string, string> = {
  signup_trial: "Bônus de boas-vindas",
  analysis: "Análise completa",
  live_trading: "Live Trading",
  monitor_activation: "Ativação do Monitor",
  subscription: "Créditos da assinatura",
  admin_adjust: "Ajuste administrativo",
  hubla: "Assinatura (Hubla)",
};

interface Tx { id: number; amount: number; source: string; metadata: Record<string, unknown>; created_at: string; }

export default async function CreditosPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="hist-page">
        <AppBar active={undefined} />
        <div className="wrap"><p className="note" style={{ padding: 40 }}>Faça login para ver seus créditos.</p></div>
      </div>
    );
  }

  const sb = await supabaseServerSSR();
  const [sessions, monitor, txRes] = await Promise.all([
    listActiveLive(user.id),
    getMonitorStatus(user.id),
    sb.from("credit_transactions").select("id,amount,source,metadata,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40),
  ]);

  const lives: ActiveLiveItem[] = sessions.map((s) => ({ symbol: s.symbol, name: findAsset(s.symbol)?.name ?? s.symbol, activatedAt: s.activatedAt }));
  const txs = (txRes.data ?? []) as Tx[];

  const fmtDt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const descOf = (t: Tx) => {
    const base = SOURCE_PT[t.source] ?? t.source;
    const sym = (t.metadata?.symbol as string | undefined) ?? null;
    return sym ? `${base} · ${sym}` : base;
  };

  return (
    <div className="hist-page">
      <AppBar active={undefined} credits={user.credits} plan={planLabel(user.plan)} initials={initialsOf(user)} email={user.email} />
      <div className="wrap">
        <div className="head2">
          <div>
            <h1 className="page-title">Meus créditos</h1>
            <div className="meta">Saldo, lives ativas, monitor e o histórico de consumo de créditos.</div>
          </div>
        </div>

        <div className="cr-cards">
          <div className="cr-stat"><span>Saldo atual</span><b>{user.credits}</b><small>créditos</small></div>
          <div className="cr-stat"><span>Plano</span><b>{planLabel(user.plan)}</b><small>{user.plan === "free" ? "3 análises vitalícias" : "créditos recorrentes"}</small></div>
          <div className="cr-stat"><span>Monitor</span><b className={monitor.active ? "bull" : ""}>{monitor.active ? "Ativo" : "Inativo"}</b><small>{monitor.active && monitor.expiresAt ? `até ${fmtDt(monitor.expiresAt)}` : "ative em Monitor"}</small></div>
        </div>

        <div className="cr-sec-h">Lives ativas</div>
        <LiveActiveList items={lives} />

        <div className="cr-sec-h" style={{ marginTop: 22 }}>Histórico de consumo</div>
        {txs.length === 0 ? (
          <p className="note" style={{ padding: "6px 2px" }}>Sem movimentações ainda.</p>
        ) : (
          <div className="cr-tbl">
            <div className="cr-thead"><span>Data</span><span>Descrição</span><span className="cr-amt">Créditos</span></div>
            {txs.map((t) => (
              <div className="cr-trow" key={t.id}>
                <span className="cr-dt">{fmtDt(t.created_at)}</span>
                <span>{descOf(t)}</span>
                <span className={`cr-amt ${t.amount >= 0 ? "bull" : "bear"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
