import { AppBar, SignalBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { signalToDir, signalLabelPt, relativeTime } from "@/lib/analysis/display";
import { MonitorLive } from "@/components/monitor-live";
import type { SignalDirection } from "@tradeai/shared";

export const dynamic = "force-dynamic";

interface WatchRow { symbol: string; timeframe: string }
interface AlertRow { id: string; symbol: string; timeframe: string; signal: SignalDirection; created_at: string }

export default async function MonitorPage() {
  const user = await getCurrentUser();

  let watch = "";
  let alerts: AlertRow[] = [];
  if (user) {
    const sb = await supabaseServerSSR();
    const [{ data: wl }, { data: al }] = await Promise.all([
      sb.from("watchlist").select("symbol,timeframe").eq("user_id", user.id).limit(10),
      sb.from("alerts").select("id,symbol,timeframe,signal,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
    ]);
    watch = ((wl ?? []) as WatchRow[]).map((w) => `${w.symbol}:${w.timeframe}`).join(",");
    alerts = (al ?? []) as AlertRow[];
  }
  const now = Date.now();

  return (
    <div className="hist-page">
      <AppBar active="monitor" credits={user?.credits} plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} />
      <div className="wrap">
        <div className="head2">
          <div>
            <h1>Monitor ao vivo</h1>
            <div className="meta">Preço · regime · sinal dos mercados acompanhados — e o sinal surge quando forma um setup de qualidade</div>
          </div>
        </div>

        {alerts.length > 0 ? (
          <>
            <div className="mon-sec-h" style={{ marginTop: 0 }}>Seus alertas recentes · watchlist</div>
            <div className="mon-grid" style={{ marginBottom: 8 }}>
              {alerts.map((a) => (
                <a className="mon-row" key={a.id} href={`/analise?symbol=${a.symbol}&tf=${a.timeframe}&type=crypto`}>
                  <span className="mr-sym"><span className="mr-star">★</span><b>{a.symbol}</b> · {a.timeframe.toUpperCase()}</span>
                  <SignalBadge direction={signalToDir(a.signal)}>{signalLabelPt(a.signal)}</SignalBadge>
                  <span className="mr-reg" />
                  <span className="mr-px" style={{ fontSize: 11 }}>{relativeTime(a.created_at, now)}</span>
                </a>
              ))}
            </div>
          </>
        ) : null}

        <MonitorLive watch={watch || undefined} />

        <p className="note" style={{ margin: "16px 0 60px", maxWidth: "70ch" }}>
          Sem teatro: o monitor não simula "IA conversando". Mostra o estado real dos mercados (★ = da sua watchlist) e só
          destaca um sinal quando o backtest valida (selo verde/amarelo). Conteúdo educativo — não é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
