import { SignalBadge, QualityDot } from "@/components/ui";
import { AppBar } from "@/components/ui";
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

// ---- ícones KPI (stroke, currentColor) ----
const IcoCoins = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="9" cy="6" rx="6" ry="3" /><path d="M3 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6" /><path d="M15 12.5c2.8-.2 6-1.4 6-3.5M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-6" />
  </svg>
);
const IcoShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
  </svg>
);
const IcoGauge = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /><path d="m12 12 4-3" /><path d="M4.5 18a9 9 0 1 1 15 0" />
  </svg>
);

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const rawName = ((user?.fullName ?? user?.email ?? "trader").split(/[\s@.]+/)[0]) || "trader";
  const greetName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const recents = await recentAnalyses(6);
  const fng = await fetchFearGreed();
  const now = Date.now();
  const credits = user?.credits ?? 0;

  return (
    <div className="dash-page">
      <AppBar
        active="dashboard"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />

      <div className="wrap dash">
        {/* HERO / comando */}
        <section className="dh-hero">
          <span className="dh-aurora" aria-hidden />
          <div className="dh-hero-copy">
            <span className="dh-eyebrow"><span className="d" /> Seu painel · plano {user ? planLabel(user.plan) : "—"}</span>
            <h1 className="dh-greet">Olá, <span className="grad">{greetName}</span>.</h1>
            <p className="dh-sub">Mercados em tempo real, suas análises e a watchlist — num só lugar. Veja a conta antes de operar.</p>
          </div>
          <div className="dh-hero-cta">
            <a className="dh-cta" href="/analise"><span className="plus">+</span> Nova análise</a>
            <a className="dh-cta-ghost" href="/historico">Ver histórico →</a>
          </div>
        </section>

        {/* KPIs — números grandes em gradiente */}
        <div className="dh-kpis">
          <article className="dh-kpi">
            <div className="dk-top"><span className="dk-ico">{IcoCoins}</span><span className="dk-k">Seus créditos</span></div>
            <div className="dk-num grad">{credits}</div>
            <div className="dk-bar"><i style={{ width: `${Math.min(100, credits * 5)}%` }} /></div>
            <div className="dk-foot">Plano <b>{user ? planLabel(user.plan) : "—"}</b> · cada análise consome 1</div>
          </article>

          <article className="dh-kpi">
            <div className="dk-top"><span className="dk-ico bull">{IcoShield}</span><span className="dk-k">Selo verde · mês</span></div>
            <div className="dk-num" style={{ color: "var(--bull)" }}>68<small>%</small></div>
            <div className="dk-bar"><i style={{ width: "68%", background: "var(--bull)", boxShadow: "0 0 12px var(--bull-soft)" }} /></div>
            <div className="dk-foot"><b>37</b> análises · <b>25</b> com selo verde</div>
          </article>

          <article className="dh-kpi">
            <div className="dk-top"><span className="dk-ico">{IcoGauge}</span><span className="dk-k">Fear &amp; Greed · Cripto</span></div>
            {fng ? (
              <>
                <div className="dk-num" style={{ color: fngColor(fng.value) }}>{fng.value}<small className="dk-tag">{FNG_PT[fng.classification] ?? fng.classification}</small></div>
                <div className="dk-fg"><span className="mk" style={{ left: `${fng.value}%` }} /></div>
                <div className="dk-foot">Mercado cripto · fonte alternative.me</div>
              </>
            ) : (
              <>
                <div className="dk-num" style={{ color: "var(--ink-faint)" }}>—</div>
                <div className="dk-fg" />
                <div className="dk-foot">Índice indisponível no momento</div>
              </>
            )}
          </article>
        </div>

        {/* Mercado ao vivo */}
        <section className="dh-block">
          <header className="dh-head">
            <span className="dh-eyebrow"><span className="d" /> Mercados ao vivo · 5 classes</span>
            <a href="/analise" className="dh-more">ver catálogo →</a>
          </header>
          <TickerRail />
        </section>

        {/* recentes + watchlist */}
        <div className="dh-grid">
          <section className="dh-card">
            <header className="dh-head">
              <span className="dh-eyebrow"><span className="d" /> Análises recentes</span>
              <a href="/historico" className="dh-more">histórico completo →</a>
            </header>
            <div className="alist">
              {recents.length === 0 ? (
                <p className="dh-empty">
                  Nenhuma análise ainda. <a href="/analise">Faça a primeira →</a>
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
          </section>

          <section className="dh-card">
            <header className="dh-head">
              <span className="dh-eyebrow"><span className="d" /> Watchlist</span>
              <a href="/watchlist" className="dh-more">gerenciar →</a>
            </header>
            <WatchlistPanel />
          </section>
        </div>

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
