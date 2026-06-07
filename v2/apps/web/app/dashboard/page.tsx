import { AppBar, Panel, PanelLabel, SignalBadge, QualityDot } from "@/components/ui";
import { TickerRail } from "@/components/ticker-rail";
import { WatchlistPanel } from "@/components/watchlist-panel";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { recentAnalyses } from "@/lib/history";
import { signalToDir, signalLabelPt, sealFromStatus, FORCE_COLOR, relativeTime } from "@/lib/analysis/display";
import { fetchFearGreed } from "@/lib/market/fear-greed";

const FNG_PT: Record<string, string> = {
  "Extreme Fear": "Medo extremo",
  Fear: "Medo",
  Neutral: "Neutro",
  Greed: "Ganância",
  "Extreme Greed": "Ganância extrema",
};
function fngColor(value: number): string {
  return value < 45 ? "var(--bear)" : value > 55 ? "var(--bull)" : "var(--amber)";
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const rawName = ((user?.fullName ?? user?.email ?? "trader").split(/[\s@.]+/)[0]) || "trader";
  const greetName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const recents = await recentAnalyses(6);
  const fng = await fetchFearGreed();
  const now = Date.now();
  return (
    <>
      <AppBar
        active="dashboard"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />

      <div className="wrap">
        <div className="ctx">
          <div>
            <h1>Olá, {greetName}.</h1>
            <div className="sub">
              Seu painel · mercados em tempo real · plano <b style={{ color: "var(--cyan)" }}>{user ? planLabel(user.plan) : "—"}</b>
            </div>
          </div>
          <a className="btn primary lg" href="/analise">
            + Nova análise
          </a>
        </div>

        <PanelLabel more="ver catálogo →" moreHref="/analise">Mercados ao vivo · 5 classes</PanelLabel>
        <TickerRail />

        {/* KPIs — créditos, selo verde, fear&greed (sobem pra uma linha tidy) */}
        <div className="kpis">
          <Panel className="kpi">
            <div className="label"><span>Seus créditos</span></div>
            <div className="kval">{user?.credits ?? 0} <small>créditos</small></div>
            <div className="kbar"><i style={{ width: `${Math.min(100, (user?.credits ?? 0) * 5)}%` }} /></div>
            <div className="ksub">Plano <b style={{ color: "var(--cyan)" }}>{user ? planLabel(user.plan) : "—"}</b> · cada análise nova consome 1</div>
          </Panel>
          <Panel className="kpi">
            <div className="label"><span>Taxa de selo verde · mês</span></div>
            <div className="kval" style={{ color: "var(--bull)" }}>68%</div>
            <div className="kbar"><i style={{ width: "68%", background: "var(--bull)", boxShadow: "0 0 10px var(--bull-soft)" }} /></div>
            <div className="ksub"><b>37</b> análises · <b>25</b> com selo verde</div>
          </Panel>
          <Panel className="kpi">
            <div className="label"><span>Fear &amp; Greed · Cripto</span></div>
            {fng ? (
              <>
                <div className="kval">{fng.value} <span className="tag" style={{ color: fngColor(fng.value) }}>{FNG_PT[fng.classification] ?? fng.classification}</span></div>
                <div className="fgmini"><span className="mk" style={{ left: `${fng.value}%` }} /></div>
                <div className="ksub">Mercado cripto · fonte alternative.me</div>
              </>
            ) : (
              <>
                <div className="kval" style={{ color: "var(--ink-faint)" }}>—</div>
                <div className="fgmini" />
                <div className="ksub">Índice indisponível no momento</div>
              </>
            )}
          </Panel>
        </div>

        {/* DUAS LISTAS equilibradas — recentes + watchlist (mata o vão) */}
        <div className="grid2" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <Panel>
            <PanelLabel more="histórico completo →" moreHref="/historico">Análises recentes</PanelLabel>
            <div className="alist">
              {recents.length === 0 ? (
                <p className="note" style={{ padding: "8px 6px", margin: 0 }}>
                  Nenhuma análise ainda. <a href="/analise" style={{ color: "var(--cyan)" }}>Faça a primeira →</a>
                </p>
              ) : (
                recents.map((r) => {
                  const dir = signalToDir(r.signal);
                  return (
                    <a className="arow" key={r.id} href={`/analise?id=${encodeURIComponent(r.id)}`}>
                      <div className="a-sym">
                        <span className="s">{r.symbol}</span>
                        <span className="tf">{r.timeframe.toUpperCase()}</span>
                      </div>
                      <SignalBadge direction={dir}>{signalLabelPt(r.signal)}</SignalBadge>
                      <span className="fr">força <b style={{ color: FORCE_COLOR[dir] }}>{r.strength}</b></span>
                      <QualityDot seal={sealFromStatus(r.seal)} />
                      <span className="tm">{relativeTime(r.createdAt, now)}</span>
                    </a>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel>
            <PanelLabel more="gerenciar →" moreHref="/analise">Watchlist</PanelLabel>
            <WatchlistPanel />
          </Panel>
        </div>

        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
