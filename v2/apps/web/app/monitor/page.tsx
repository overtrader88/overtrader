import { AppBar, SignalBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { signalToDir, signalLabelPt, relativeTime } from "@/lib/analysis/display";
import { MonitorLive } from "@/components/monitor-live";
import { MonitorActivate } from "@/components/monitor-activate";
import { EngineSelector } from "@/components/engine-selector";
import { isEngine, type EngineId } from "@/lib/analysis/engines";
import { getMonitorStatus } from "@/lib/monitor";
import type { SignalDirection } from "@tradeai/shared";

export const dynamic = "force-dynamic";

interface WatchRow { symbol: string; timeframe: string }
interface AlertRow { id: string; symbol: string; timeframe: string; signal: SignalDirection; created_at: string }

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ engine?: string }>;
}) {
  const sp = await searchParams;
  const engine: EngineId = isEngine(sp.engine) ? sp.engine : "padrao";
  const engQs = engine === "classe" ? "&engine=classe" : "";
  const user = await getCurrentUser();

  // Gate: exclusivo PRO/PRO+ e requer ativação (20 créditos / 5 dias).
  const isPro = user?.plan === "pro" || user?.plan === "pro_plus";
  const status = user ? await getMonitorStatus(user.id) : { active: false, expiresAt: null };
  const showMonitor = !!user && isPro && status.active;

  let watch = "";
  let alerts: AlertRow[] = [];
  if (user && showMonitor) {
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
            <div className="meta">
              Preço · regime · sinal dos mercados acompanhados — e o sinal surge quando forma um setup de qualidade
              {showMonitor && status.expiresAt ? <> · <b style={{ color: "var(--bull)" }}>ativo até {new Date(status.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b></> : null}
            </div>
          </div>
        </div>

        {!showMonitor ? (
          <MonitorActivate canActivate={isPro} credits={user?.credits ?? 0} />
        ) : (
        <>
        <div className="engine-bar" style={{ marginBottom: 12 }}>
          <span className="eb-k">Motor de análise</span>
          <EngineSelector active={engine} />
          {engine === "classe" ? <span className="note" style={{ fontSize: 11 }}>Abrir um ativo usa a leitura por classe (metodologia + dados da família).</span> : null}
        </div>
        {alerts.length > 0 ? (
          <>
            <div className="mon-sec-h" style={{ marginTop: 0 }}>Seus alertas recentes · watchlist</div>
            <div className="mon-grid" style={{ marginBottom: 8 }}>
              {alerts.map((a) => (
                <a className="mon-row" key={a.id} href={`/analise?symbol=${a.symbol}&tf=${a.timeframe}&type=crypto${engQs}`}>
                  <span className="mr-sym"><span className="mr-star">★</span><b>{a.symbol}</b> · {a.timeframe.toUpperCase()}</span>
                  <SignalBadge direction={signalToDir(a.signal)}>{signalLabelPt(a.signal)}</SignalBadge>
                  <span className="mr-reg" />
                  <span className="mr-px" style={{ fontSize: 11 }}>{relativeTime(a.created_at, now)}</span>
                </a>
              ))}
            </div>
          </>
        ) : null}

        <MonitorLive watch={watch || undefined} engineQs={engQs} />

        <p className="note" style={{ margin: "16px 0 60px", maxWidth: "70ch" }}>
          Sem teatro: o monitor não simula "IA conversando". Mostra o estado real dos mercados (★ = da sua watchlist) e só
          destaca um sinal quando o backtest valida (selo verde/amarelo). Conteúdo educativo — não é recomendação de investimento.
        </p>
        </>
        )}
      </div>
    </div>
  );
}
