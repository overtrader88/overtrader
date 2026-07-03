import { AppBar, Panel, PanelLabel } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { getTrackRecord, type EngineFilter } from "@/lib/signals/track-record";
import type { TrackRecordStats } from "@tradeai/engine";
import { AssetGlyph } from "@/components/asset-glyph";
import { TrackLiveTable } from "@/components/track-live-table";

export const dynamic = "force-dynamic";

const ENGINE_TABS: { key: string; label: string; filter?: EngineFilter; tm?: boolean; beta?: boolean; experimental?: boolean; group: string }[] = [
  { key: "todos", label: "Todos", group: "geral" },
  { key: "padrao", label: "Motor padrão", filter: "padrao", group: "producao" },
  { key: "classe", label: "Motor por classe", filter: "classe", group: "producao" },
  { key: "padrao_b", label: "Padrão-B", filter: "padrao_b", tm: true, experimental: true, group: "ab" },
  { key: "classe_b", label: "Classe-B", filter: "classe_b", tm: true, experimental: true, group: "ab" },
  { key: "llm", label: "LLM · GPT-4.1", filter: "llm", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_ds", label: "LLM · DeepSeek", filter: "llm_ds", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_surv", label: "Sobrev. · GPT", filter: "llm_surv", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_ds_surv", label: "Sobrev. · DeepSeek", filter: "llm_ds_surv", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_vsf", label: "Vol/S-R/Fib · GPT", filter: "llm_vsf", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_ds_vsf", label: "Vol/S-R/Fib · DeepSeek", filter: "llm_ds_vsf", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_vsf_surv", label: "VSF+Sobrev · GPT", filter: "llm_vsf_surv", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "llm_ds_vsf_surv", label: "VSF+Sobrev · DeepSeek", filter: "llm_ds_vsf_surv", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "evo_gpt", label: "Evolutivo · GPT", filter: "evo_gpt", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "evo_ds", label: "Evolutivo · DeepSeek", filter: "evo_ds", tm: true, beta: true, experimental: true, group: "ia" },
  { key: "condicional", label: "Condicional", filter: "condicional", tm: true, experimental: true, group: "det" },
  { key: "contrario", label: "Contrário", filter: "contrario", tm: true, experimental: true, group: "det" },
  { key: "consenso", label: "Consenso", filter: "consenso", tm: true, experimental: true, group: "det" },
];
/** Rótulo curto de cada grupo de motores (mostrado no separador entre famílias). */
const GROUP_LABEL: Record<string, string> = { producao: "Produção", ab: "Variantes A/B", ia: "Inteligência (LLM)", det: "Determinísticos" };

/** Rótulo curto do motor — usado na tag por linha na visão consolidada. */
const ENGINE_SHORT: Record<string, string> = {
  padrao: "Padrão", padrao_b: "Padrão-B", classe: "Classe", classe_b: "Classe-B", llm: "GPT", llm_ds: "DeepSeek",
  llm_surv: "Sobrev·GPT", llm_ds_surv: "Sobrev·DS", llm_vsf: "VSF·GPT", llm_ds_vsf: "VSF·DS",
  llm_vsf_surv: "VSF+S·GPT", llm_ds_vsf_surv: "VSF+S·DS", evo_gpt: "Evo·GPT", evo_ds: "Evo·DS",
  condicional: "Cond", contrario: "Contra", consenso: "Cons",
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

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
}

/* ---------- ícones (stroke, alinhados ao set Lucide do app) ---------- */
const ChartIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18" /><path d="m7 14 3-4 3 3 4-6" /></svg>
);
const TargetIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>
);
const ScaleIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v18M5 7h14M5 7 3 13h4L5 7Zm14 0-2 6h4l-2-6Z" /></svg>
);
const SigmaIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 5H7l5 7-5 7h11" /></svg>
);
const FlagIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4M5 4h11l-1.5 4L16 12H5" /></svg>
);
const GavelIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m13 9-6 6M3 21h8M14.5 4.5l5 5M10 8l6 6M16.5 2.5l5 5" /></svg>
);
const PieIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3a9 9 0 1 0 9 9h-9V3Z" /><path d="M14 3.5A9 9 0 0 1 20.5 10H14V3.5Z" /></svg>
);
const LiveIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7" /></svg>
);
function RegimeIco({ regime }: { regime: string }) {
  const c = { fill: "none" as const, stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (regime === "trending") return <svg viewBox="0 0 24 24" {...c}><path d="m4 16 5-5 4 3 7-8" /><path d="M16 6h4v4" /></svg>;
  if (regime === "ranging") return <svg viewBox="0 0 24 24" {...c}><path d="M3 8h18M3 16h18" /><path d="m7 12 2-2-2-2M17 12l-2 2 2 2" /></svg>;
  if (regime === "explosive") return <svg viewBox="0 0 24 24" {...c}><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" /></svg>;
  return <svg viewBox="0 0 24 24" {...c}><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" /></svg>; // transitional / —
}

/* KPI com whisker de IC (estimativa = ponto; banda = intervalo 95%). */
function Kpi({ icon, label, value, lo, hi, n, min, max, fmt, tone }: {
  icon: React.ReactNode; label: string; value: number; lo: number; hi: number; n: number;
  min: number; max: number; fmt: (x: number) => string; tone: "tech" | "pos" | "neg";
}) {
  const clamp = (x: number) => Math.max(min, Math.min(max, x));
  const pos = (x: number) => ((clamp(x) - min) / (max - min)) * 100;
  const vars = { ["--lo"]: pos(lo), ["--hi"]: pos(hi), ["--v"]: pos(value) } as React.CSSProperties;
  return (
    <div className={`tr-kpi ${tone}`}>
      <div className="tr-kpi-h">
        <span className="tr-kpi-ic">{icon}</span>
        <span className="tr-kpi-lab">{label}</span>
        <span className="tr-kpi-val">{fmt(value)}</span>
      </div>
      <div className="tr-wh" style={vars}>
        <span className="tr-wh-ax" />
        <span className="tr-wh-band" />
        <span className="tr-wh-dot" />
      </div>
      <div className="tr-wh-ft"><span>{fmt(lo)}</span><b>IC 95% · n {n}</b><span>{fmt(hi)}</span></div>
    </div>
  );
}

function Kpis({ s }: { s: TrackRecordStats }) {
  // Teto do medidor de PF entre 3,5 e 6 — com amostra minúscula o IC superior dispara.
  const pfMax = Math.min(6, Math.max(3.5, s.profitFactor.ci95[1]));
  return (
    <div className="tr-kpis">
      <Kpi icon={<TargetIco />} label="Win rate" tone="tech"
        value={s.winRate.value * 100} lo={s.winRate.ci95[0] * 100} hi={s.winRate.ci95[1] * 100}
        n={s.winRate.n} min={0} max={100} fmt={pct} />
      <Kpi icon={<ScaleIco />} label="Profit factor" tone={s.profitFactor.value >= 1 ? "pos" : "neg"}
        value={s.profitFactor.value} lo={s.profitFactor.ci95[0]} hi={s.profitFactor.ci95[1]}
        n={s.profitFactor.n} min={0} max={pfMax} fmt={(x) => fnum(x)} />
      <Kpi icon={<SigmaIco />} label="R médio / sinal" tone={s.avgR.value >= 0 ? "pos" : "neg"}
        value={s.avgR.value} lo={s.avgR.ci95[0]} hi={s.avgR.ci95[1]}
        n={s.avgR.n} min={-1} max={1.5} fmt={(x) => `${signed(x)} R`} />
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
            <div className="tr-hd">
              <div>
                <PanelLabel>Track record · performance auditada (forward)</PanelLabel>
                <p className="note" style={{ maxWidth: "70ch", margin: "10px 0 0" }}>
                  Cada sinal de qualidade é <b>carimbado na emissão</b> com seu plano fixo (entrada/stop/alvos). O desfecho é medido
                  contra os candles que vieram <b>depois</b> — sem reotimizar nada. É o oposto de um número cravado: win rate, profit
                  factor e R médio vêm com <b>intervalo de confiança e amostra (n)</b>, e o veredito fica cinza enquanto a amostra é fraca.
                </p>
              </div>
              <span className="tr-hd-ic" aria-hidden><ChartIco /></span>
            </div>

            <div className="tr-tabs">
              {ENGINE_TABS.flatMap((t, i) => {
                const prev = ENGINE_TABS[i - 1];
                const node = (
                  <a key={t.key} href={t.key === "todos" ? "/track-record" : `/track-record?engine=${t.key}`}
                    className={`tr-tab${t.key === activeTab.key ? " on" : ""}`}>
                    {t.label}{t.tm ? <span className="tr-tm">™</span> : null}
                    {t.beta ? <span className="tr-beta">BETA</span> : null}
                  </a>
                );
                if (i > 0 && prev && prev.group !== t.group) {
                  return [
                    <span key={`sep-${t.group}`} className="tr-sep" aria-hidden>{GROUP_LABEL[t.group] ?? ""}</span>,
                    node,
                  ];
                }
                return [node];
              })}
            </div>
            {activeTab.key === "todos" ? (
              <p className="note" style={{ maxWidth: "70ch", margin: "0 0 14px" }}>
                Visão <b>consolidada de todos os motores</b> — os de produção (padrão e por classe) mais as variantes
                experimentais (incluindo as famílias de IA: GPT/DeepSeek, sobrevivência e volume/S-R/Fibonacci) em teste forward.
                A coluna de cada linha mostra de qual motor é o sinal. Selecione um motor acima para vê-lo isolado.
              </p>
            ) : null}
            {activeTab.key === "classe" ? (
              <p className="note" style={{ maxWidth: "70ch", margin: "0 0 14px" }}>
                <b>Motor por classe (Motor 2):</b> segunda leitura, com a metodologia de cada família de ativo. Ainda <b>sem selo de
                backtest próprio</b> — é justamente o forward que mede sua calibração. Compare com o Motor padrão acima.
              </p>
            ) : null}
            {activeTab.experimental ? (
              <p className="tr-exp-note">
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
                  <div className="seal-head" style={{ marginBottom: 14 }}>
                    <span className="seal-led" style={{ background: "var(--ink-faint)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--ink-faint) 18%, transparent)" }} />
                    <span className="st" style={{ color: "var(--ink-faint)" }}>EM CONSTRUÇÃO<small>amostra insuficiente · {overall.decisive}/{MIN_DECISIVE} decisivos · sem veredito ainda</small></span>
                  </div>
                ) : null}
                <Kpis s={overall} />
                <div className="tr-stats">
                  <div className="tr-stat"><span className="tr-stat-ic"><FlagIco /></span><div><div className="k">Sinais resolvidos</div><div className="v">{overall.n}</div></div></div>
                  <div className="tr-stat"><span className="tr-stat-ic"><GavelIco /></span><div><div className="k">Decisivos (win+stop)</div><div className="v">{overall.decisive}</div></div></div>
                  <div className="tr-stat"><span className="tr-stat-ic"><PieIco /></span><div><div className="k">Desfechos</div><div className="v sm"><span className="b">{wins} TP</span> · <span className="s">{o.SL} SL</span> · <span className="n">{o.EXPIRED} exp</span></div></div></div>
                  <div className="tr-stat"><span className="tr-stat-ic"><SigmaIco /></span><div><div className="k">R acumulado</div><div className="v" style={{ color: overall.totalR >= 0 ? "var(--bull)" : "var(--bear)" }}>{signed(overall.totalR)} R</div></div></div>
                  <div className="tr-stat"><span className="tr-stat-ic"><LiveIco /></span><div><div className="k">Abertos agora</div><div className="v">{openCount}</div></div></div>
                </div>
              </>
            )}
          </Panel>

          {live.length > 0 ? (
            <Panel>
              <div className="tr-hd">
                <PanelLabel>Em andamento · ciclo de vida ao vivo</PanelLabel>
                <span className="tr-count">{live.length} {live.length === 1 ? "ativo" : "ativos"} em andamento</span>
              </div>
              <p className="note" style={{ margin: "10px 0 14px" }}>Gestão escalonada: realiza 1/3 em cada alvo e o stop sobe sozinho (breakeven após o TP1).</p>
              <TrackLiveTable rows={live} showEngine={activeTab.key === "todos"} />
            </Panel>
          ) : null}

          {byRegime.length > 0 ? (
            <Panel>
              <PanelLabel>Por regime de mercado</PanelLabel>
              <div className="trk" style={{ marginTop: 12 }}>
                <div className="trk-head trk-reg"><span>Regime</span><span className="ctr">n</span><span>Win rate</span><span className="ctr">Profit factor</span><span className="rgt">R acum.</span></div>
                {byRegime.map((r) => {
                  const wr = r.stats.winRate;
                  return (
                    <div className="trk-row trk-reg" key={r.regime}>
                      <span className="trk-reg-nm"><span className="trk-reg-ic"><RegimeIco regime={r.regime} /></span>{REGIME_PT[r.regime] ?? r.regime}</span>
                      <span className="ctr trk-n">{r.stats.n}</span>
                      <span className="trk-wr">
                        <span className="trk-wr-top"><b>{pct(wr.value * 100)}</b><small>{pct(wr.ci95[0] * 100)}–{pct(wr.ci95[1] * 100)}</small></span>
                        <span className="trk-wbar"><i style={{ width: `${Math.max(2, Math.min(100, wr.value * 100))}%` }} /></span>
                      </span>
                      <span className="ctr trk-pf">{fnum(r.stats.profitFactor.value)}</span>
                      <span className="rgt" style={{ color: r.stats.totalR >= 0 ? "var(--bull)" : "var(--bear)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{signed(r.stats.totalR)} R</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          {recent.length > 0 ? (
            <Panel>
              <PanelLabel>Sinais resolvidos · mais recentes</PanelLabel>
              <div className="trk" style={{ marginTop: 12 }}>
                <div className="trk-head trk-sig"><span>Ativo</span><span>Direção</span><span>Desfecho</span><span className="ctr">R</span><span>Emitido</span><span>Resolvido</span><span /></div>
                {recent.map((r, i) => {
                  const oc = OUTCOME[r.outcome] ?? { label: r.outcome, cls: "neu" };
                  const buy = r.direction.includes("BUY");
                  const sell = r.direction.includes("SELL");
                  return (
                    <div className="trk-row trk-sig" key={i}>
                      <span className="trk-asset">
                        <AssetGlyph symbol={r.symbol} size={30} />
                        <span className="trk-sym"><b>{r.symbol}</b> · {r.timeframe.toUpperCase()}</span>
                        {activeTab.key === "todos" ? <span className="trk-eng">{ENGINE_SHORT[r.engine] ?? r.engine}</span> : null}
                      </span>
                      <span className={`trk-dir ${buy ? "up" : sell ? "dn" : "neu"}`}>{buy ? "↗ Compra" : sell ? "↘ Venda" : "—"}</span>
                      <span className={`trk-oc ${oc.cls}`}>{oc.label}</span>
                      <span className="ctr trk-r" style={{ color: r.pnlR >= 0 ? "var(--bull)" : "var(--bear)" }}>{signed(r.pnlR)} R</span>
                      <span className="trk-date">{fmtDate(r.emittedAt)}</span>
                      <span className="trk-date">{fmtDate(r.resolvedAt)}</span>
                      <span className="trk-chev" aria-hidden>›</span>
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
