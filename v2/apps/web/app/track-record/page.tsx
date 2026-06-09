import { AppBar, Panel, PanelLabel, ConfidenceBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { getTrackRecord, type EngineFilter } from "@/lib/signals/track-record";
import type { TrackRecordStats } from "@tradeai/engine";

export const dynamic = "force-dynamic";

const ENGINE_TABS: { key: string; label: string; filter?: EngineFilter; experimental?: boolean }[] = [
  { key: "todos", label: "Todos" },
  { key: "padrao", label: "Motor padrão", filter: "padrao" },
  { key: "classe", label: "Motor por classe", filter: "classe" },
  { key: "padrao_b", label: "Padrão-B", filter: "padrao_b", experimental: true },
  { key: "classe_b", label: "Classe-B", filter: "classe_b", experimental: true },
  { key: "llm", label: "Motor LLM", filter: "llm", experimental: true },
];

/** Rótulo curto do motor — usado na tag por linha na visão consolidada. */
const ENGINE_SHORT: Record<string, string> = {
  padrao: "Padrão", padrao_b: "Padrão-B", classe: "Classe", classe_b: "Classe-B", llm: "LLM",
};

const pct = (x: number) => `${x.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const signed = (x: number) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
const fnum = (x: number, d = 2) => x.toLocaleString("pt-BR", { maximumFractionDigits: d });

/** Mínimo de trades decisivos p/ um veredito confiável (mesma filosofia do selo). */
const MIN_DECISIVE = 20;

const REGIME_PT: Record<string, string> = {
  trending: "Tendência", ranging: "Lateral", transitional: "Transição", explosive: "Explosivo", "—": "—",
};
const OUTCOME: Record<string, { label: string; cls: string }> = {
  TP1: { label: "TP1", cls: "up" }, TP2: { label: "TP2", cls: "up" }, TP3: { label: "TP3", cls: "up" },
  SL: { label: "Stop", cls: "dn" }, EXPIRED: { label: "Expirou", cls: "neu" },
};
const STOP_STAGE_PT: Record<string, string> = {
  initial: "stop inicial",
  breakeven: "stop no breakeven · risco zerado",
  tp1: "stop no TP1 · lucro travado",
};

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
}

function StatRow({ s }: { s: TrackRecordStats }) {
  // Teto do medidor de PF entre 3,5 e 6 — com amostra minúscula o IC superior
  // dispara (ex.: 0–99) e esmagaria a leitura. O texto do IC mostra o valor real.
  const pfMax = Math.min(6, Math.max(3.5, s.profitFactor.ci95[1]));
  return (
    <div className="ci-grid">
      <ConfidenceBadge label="Win rate" value={s.winRate.value * 100} ci={[s.winRate.ci95[0] * 100, s.winRate.ci95[1] * 100]} n={s.winRate.n} method="Wilson" min={0} max={100} format={pct} />
      <ConfidenceBadge label="Profit factor" value={s.profitFactor.value} ci={s.profitFactor.ci95} n={s.profitFactor.n} method="bootstrap" min={0} max={pfMax} />
      <ConfidenceBadge label="R médio / sinal" value={s.avgR.value} ci={s.avgR.ci95} n={s.avgR.n} method="t-Student" min={-1} max={1.5} format={signed} tone={s.avgR.value >= 0 ? "pos" : "neg"} />
    </div>
  );
}

export default async function TrackRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ engine?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = ENGINE_TABS.find((t) => t.key === sp.engine) ?? ENGINE_TABS[0]!;
  const [user, tr] = await Promise.all([getCurrentUser(), getTrackRecord(activeTab.filter)]);
  const { overall, byRegime, recent, live, openCount, configured } = tr;
  const sufficient = overall.decisive >= MIN_DECISIVE;
  const o = overall.outcomes;
  const wins = o.TP1 + o.TP2 + o.TP3;

  return (
    <>
      <AppBar active="track-record" plan={user ? planLabel(user.plan) : undefined} initials={user ? initialsOf(user) : undefined} email={user?.email} credits={user?.credits} />
      <div className="analysis-page">
        <div className="wrap">
          <Panel>
            <PanelLabel>Track record · performance auditada forward</PanelLabel>
            <p className="note" style={{ maxWidth: "70ch", marginBottom: 12 }}>
              Cada sinal de qualidade é <b>carimbado na emissão</b> com seu plano fixo (entrada/stop/alvos). O desfecho é medido
              contra os candles que vieram <b>depois</b> — sem reotimizar nada. É o oposto de um número cravado: win rate, profit
              factor e R médio vêm com <b>intervalo de confiança e amostra (n)</b>, e o veredito fica cinza enquanto a amostra é fraca.
            </p>

            <div className="tr-tabs">
              {ENGINE_TABS.map((t) => (
                <a key={t.key} href={t.key === "todos" ? "/track-record" : `/track-record?engine=${t.key}`}
                  className={`tr-tab${t.key === activeTab.key ? " on" : ""}`}>
                  {t.label}{t.experimental ? <sup style={{ fontSize: "0.6em", opacity: 0.7, marginLeft: 2 }}>exp</sup> : null}
                </a>
              ))}
            </div>
            {activeTab.key === "todos" ? (
              <p className="note" style={{ maxWidth: "70ch", margin: "0 0 14px" }}>
                Visão <b>consolidada dos 5 motores</b> — 2 de produção (padrão e por classe) + 3 experimentais (Padrão-B, Classe-B,
                LLM) em teste forward. A coluna de cada linha mostra de qual motor é o sinal. Selecione um motor acima para vê-lo isolado.
              </p>
            ) : null}
            {activeTab.key === "classe" ? (
              <p className="note" style={{ maxWidth: "70ch", margin: "0 0 14px" }}>
                <b>Motor por classe (Motor 2):</b> segunda leitura, com a metodologia de cada família de ativo. Ainda <b>sem selo de
                backtest próprio</b> — é justamente o forward que mede sua calibração. Compare com o Motor padrão acima.
              </p>
            ) : null}
            {activeTab.experimental ? (
              <p className="note" style={{ maxWidth: "70ch", margin: "0 0 14px", padding: "8px 12px", border: "1px solid var(--amber)", borderRadius: 8, color: "var(--amber)" }}>
                <b>Motor experimental · amostra pequena.</b> Variante em teste <b>forward (A/B)</b>, rodando há poucos dias — os números
                ainda <b>não têm significância estatística</b> e não representam o produto. Estão aqui por transparência. Os motores de
                produção são o <b>padrão</b> e o <b>por classe</b>.
              </p>
            ) : null}

            {!configured ? (
              <p className="note">Track record indisponível (banco não configurado neste ambiente).</p>
            ) : overall.n === 0 ? (
              <div className="chk"><span className="i">▸</span> Track record <b>em construção</b>: nenhum sinal resolvido ainda. {openCount} aberto(s) sendo acompanhado(s).</div>
            ) : (
              <>
                {!sufficient ? (
                  <div className="seal-head" style={{ marginBottom: 12 }}>
                    <span className="seal-led" style={{ background: "var(--ink-faint)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--ink-faint) 18%, transparent)" }} />
                    <span className="st" style={{ color: "var(--ink-faint)" }}>EM CONSTRUÇÃO<small>amostra insuficiente · {overall.decisive}/{MIN_DECISIVE} decisivos · sem veredito ainda</small></span>
                  </div>
                ) : null}
                <StatRow s={overall} />
                <div className="telem" style={{ marginTop: 16 }}>
                  <div><div className="k">Sinais resolvidos</div><div className="v">{overall.n}</div></div>
                  <div><div className="k">Decisivos (win+stop)</div><div className="v">{overall.decisive}</div></div>
                  <div><div className="k">Desfechos</div><div className="v" style={{ fontSize: 14 }}><span className="b">{wins} TP</span> · <span className="s">{o.SL} SL</span> · <span className="n">{o.EXPIRED} exp</span></div></div>
                  <div><div className="k">R acumulado</div><div className="v" style={{ color: overall.totalR >= 0 ? "var(--bull)" : "var(--bear)" }}>{signed(overall.totalR)} R</div></div>
                  <div><div className="k">Abertos agora</div><div className="v">{openCount}</div></div>
                </div>
              </>
            )}
          </Panel>

          {live.length > 0 ? (
            <Panel>
              <PanelLabel>Em andamento · ciclo de vida ao vivo</PanelLabel>
              <p className="note" style={{ marginBottom: 12 }}>Gestão escalonada: realiza 1/3 em cada alvo e o stop sobe sozinho (breakeven após o TP1).</p>
              <div className="tr-table live">
                <div className="tr-head"><span>Ativo</span><span>Direção</span><span>Progresso</span><span>Stop</span><span>Emitido</span></div>
                {live.map((l, i) => (
                  <div className="tr-row" key={i}>
                    <span><b>{l.symbol}</b> · {l.timeframe.toUpperCase()}{activeTab.key === "todos" ? <small style={{ opacity: 0.6, marginLeft: 6 }}>{ENGINE_SHORT[l.engine] ?? l.engine}</small> : null}</span>
                    <span className={`v ${l.direction.includes("BUY") ? "up" : "dn"}`}>{l.direction.includes("BUY") ? "Compra" : "Venda"}</span>
                    <span className="lc">
                      <span className={`lc-chip ${l.tp1Hit ? "on" : ""}`}>TP1</span>
                      <span className={`lc-chip ${l.tp2Hit ? "on" : ""}`}>TP2</span>
                      <span className={`lc-chip ${l.tp3Hit ? "on" : ""}`}>TP3</span>
                    </span>
                    <span className={`note ${l.stopStage !== "initial" ? "lc-stop-on" : ""}`}>{STOP_STAGE_PT[l.stopStage] ?? l.stopStage}</span>
                    <span className="note">{fmtDate(l.emittedAt)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {byRegime.length > 0 ? (
            <Panel>
              <PanelLabel>Por regime de mercado</PanelLabel>
              <div className="tr-table">
                <div className="tr-head"><span>Regime</span><span>n</span><span>Win rate</span><span>Profit factor</span><span>R acum.</span></div>
                {byRegime.map((r) => (
                  <div className="tr-row" key={r.regime}>
                    <span>{REGIME_PT[r.regime] ?? r.regime}</span>
                    <span>{r.stats.n}</span>
                    <span>{pct(r.stats.winRate.value * 100)} <small>[{pct(r.stats.winRate.ci95[0] * 100)}–{pct(r.stats.winRate.ci95[1] * 100)}]</small></span>
                    <span>{fnum(r.stats.profitFactor.value)}</span>
                    <span style={{ color: r.stats.totalR >= 0 ? "var(--bull)" : "var(--bear)" }}>{signed(r.stats.totalR)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {recent.length > 0 ? (
            <Panel>
              <PanelLabel>Sinais resolvidos · mais recentes</PanelLabel>
              <div className="tr-table sig">
                <div className="tr-head"><span>Ativo</span><span>Direção</span><span>Desfecho</span><span>R</span><span>Emitido</span><span>Resolvido</span></div>
                {recent.map((r, i) => {
                  const oc = OUTCOME[r.outcome] ?? { label: r.outcome, cls: "neu" };
                  return (
                    <div className="tr-row" key={i}>
                      <span><b>{r.symbol}</b> · {r.timeframe.toUpperCase()}{activeTab.key === "todos" ? <small style={{ opacity: 0.6, marginLeft: 6 }}>{ENGINE_SHORT[r.engine] ?? r.engine}</small> : null}</span>
                      <span className={`v ${r.direction.includes("BUY") ? "up" : r.direction.includes("SELL") ? "dn" : "neu"}`}>{r.direction.includes("BUY") ? "Compra" : r.direction.includes("SELL") ? "Venda" : "—"}</span>
                      <span className={`v ${oc.cls}`}>{oc.label}</span>
                      <span style={{ color: r.pnlR >= 0 ? "var(--bull)" : "var(--bear)" }}>{signed(r.pnlR)} R</span>
                      <span className="note">{fmtDate(r.emittedAt)}</span>
                      <span className="note">{fmtDate(r.resolvedAt)}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          <p className="note" style={{ margin: "8px 0 60px", maxWidth: "70ch" }}>
            Conteúdo educativo e analítico — não é recomendação de investimento. Resultados passados não garantem resultados
            futuros. O track record reflete os mercados curados que a plataforma acompanha de forma forward.
          </p>
        </div>
      </div>
    </>
  );
}
