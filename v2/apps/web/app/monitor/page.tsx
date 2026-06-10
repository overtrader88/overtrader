import { AppBar, SignalBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { signalToDir, signalLabelPt, relativeTime } from "@/lib/analysis/display";
import { MonitorLive } from "@/components/monitor-live";
import { MonitorActivate } from "@/components/monitor-activate";
import { MonitorTimer } from "@/components/monitor-timer";
import { AssetGlyph } from "@/components/asset-glyph";
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
            <h1 className="page-title"><span className="mon-dot" /> Monitor ao vivo</h1>
            <div className="meta">Preço · regime · sinal dos mercados acompanhados — e o sinal surge quando forma um setup de qualidade.</div>
          </div>
          {showMonitor && status.expiresAt ? (
            <span className="mon-active-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>
              ATIVO ATÉ {new Date(status.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>

        {!showMonitor ? (
          <MonitorActivate canActivate={isPro} credits={user?.credits ?? 0} />
        ) : (
        <>
        <div className="mon-controls">
          <div className="engine-bar" style={{ margin: 0 }}>
            <span className="eb-k">Motor de análise</span>
            <EngineSelector active={engine} />
          </div>
          <MonitorTimer expiresAt={status.expiresAt} />
        </div>
        {engine === "classe" ? <span className="note" style={{ fontSize: 11, display: "block", marginBottom: 12 }}>Abrir um ativo usa a leitura por classe (metodologia + dados da família).</span> : null}
        {alerts.length > 0 ? (
          <>
            <div className="mon-sec-h">Seus alertas recentes · watchlist</div>
            <div className="mon-alerts">
              {alerts.map((a) => (
                <a className="mon-alert" key={a.id} href={`/analise?symbol=${a.symbol}&tf=${a.timeframe}&type=crypto${engQs}`}>
                  <span className="ma-star">★</span>
                  <AssetGlyph symbol={a.symbol} size={28} />
                  <span className="ma-sym"><b>{a.symbol}</b> · {a.timeframe.toUpperCase()}</span>
                  <SignalBadge direction={signalToDir(a.signal)}>{signalLabelPt(a.signal)}</SignalBadge>
                  <span className="ma-spacer" />
                  <span className="ma-time">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {relativeTime(a.created_at, now)}
                  </span>
                  <span className="ma-chev" aria-hidden>›</span>
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
