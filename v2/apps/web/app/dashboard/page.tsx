import { ENGINE_VERSION } from "@tradeai/engine";
import { AppBar, RadialGauge, SignalBadge, QualityDot } from "@/components/ui";
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
  const recents = await recentAnalyses(8);
  const fng = await fetchFearGreed();
  const now = Date.now();
  const credits = user?.credits ?? 0;
  const plan = user ? planLabel(user.plan) : "—";

  return (
    <div className="dash-page mesa-page">
      <AppBar
        active="dashboard"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />

      <div className="wrap dash mesa">
        {/* HUD — linha de status do terminal */}
        <div className="mesa-hud">
          <span className="hud-live"><span className="d" /> AO VIVO</span>
          <span className="hud-seg b">MESA DE OPERAÇÕES</span>
          <span className="hud-sep">·</span>
          <span className="hud-seg">5 MERCADOS · 143 ATIVOS</span>
          <span className="hud-spacer" />
          <span className="hud-seg">ENGINE <b>{ENGINE_VERSION}</b></span>
        </div>

        {/* COMANDO — leitura + instrumento */}
        <div className="mesa-top">
          <div className="mesa-read">
            <span className="mesa-over">Bem-vindo de volta</span>
            <h1 className="mesa-greet">Olá, <span className="grad">{greetName}</span>.</h1>
            <p className="mesa-sub">Sua mesa: o termômetro do mercado, suas análises e a watchlist — com a conta sempre à mostra.</p>
            <div className="mesa-actions">
              <a className="dh-cta" href="/analise"><span className="plus">+</span> Nova análise</a>
              <a className="dh-cta-ghost" href="/historico">Ver histórico →</a>
            </div>
            <div className="mesa-readouts">
              <div className="ro">
                <span className="ro-k">Créditos</span>
                <span className="ro-v">{credits}</span>
                <span className="ro-bar"><i style={{ width: `${Math.min(100, credits * 5)}%` }} /></span>
              </div>
              <div className="ro">
                <span className="ro-k">Selo verde · mês</span>
                <span className="ro-v" style={{ color: "var(--bull)" }}>68%</span>
                <span className="ro-bar"><i style={{ width: "68%", background: "var(--bull)" }} /></span>
              </div>
              <div className="ro">
                <span className="ro-k">Plano atual</span>
                <span className="ro-v sm">{plan}</span>
                <span className="ro-note">sem fidelidade</span>
              </div>
            </div>
          </div>

          <aside className="mesa-inst">
            <span className="cn tl" /><span className="cn tr" /><span className="cn bl" /><span className="cn br" />
            <div className="inst-k">Termômetro do mercado · Cripto</div>
            <div className="inst-gauge">
              <RadialGauge value={fng?.value ?? 0} size={168} stroke={12} caption="Fear & Greed" showOutOf />
            </div>
            <div className="inst-class" style={{ color: fng ? fngColor(fng.value) : "var(--ink-faint)" }}>
              {fng ? (FNG_PT[fng.classification] ?? fng.classification) : "indisponível"}
            </div>
            <div className="inst-scale" aria-hidden>
              <span>Medo</span><span className="bar" /><span>Ganância</span>
            </div>
            <div className="inst-foot">fonte alternative.me · atualiza ao abrir</div>
          </aside>
        </div>

        {/* FITA — análises recentes em formato terminal */}
        <section className="mesa-tape">
          <header className="dh-head">
            <span className="dh-eyebrow"><span className="d" /> Fita · suas análises recentes</span>
            <a href="/historico" className="dh-more">histórico completo →</a>
          </header>
          {recents.length === 0 ? (
            <p className="dh-empty">Nenhuma análise ainda. <a href="/analise">Rode a primeira →</a></p>
          ) : (
            <div className="tape">
              {recents.map((r) => {
                const dir = signalToDir(r.signal);
                return (
                  <a className={`tape-row ${dir}`} key={r.id} href={`/analise?id=${encodeURIComponent(r.id)}`}>
                    <span className="t-rail" aria-hidden />
                    <span className="t-sym">{r.symbol}</span>
                    <span className="t-tf">{r.timeframe.toUpperCase()}</span>
                    <SignalBadge direction={dir}>{signalLabelPt(r.signal)}</SignalBadge>
                    <span className="t-fr">força <b style={{ color: FORCE_COLOR[dir] }}>{r.strength}</b></span>
                    <QualityDot seal={sealFromStatus(r.seal)} />
                    <span className="t-tm">{relativeTime(r.createdAt, now)}</span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* RADAR — mercado ao vivo + watchlist */}
        <div className="dh-grid">
          <section className="dh-card">
            <header className="dh-head">
              <span className="dh-eyebrow"><span className="d" /> Mercados ao vivo · 5 classes</span>
              <a href="/analise" className="dh-more">ver catálogo →</a>
            </header>
            <TickerRail />
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
