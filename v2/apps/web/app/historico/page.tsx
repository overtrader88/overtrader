import { AppBar, SignalBadge, QualityDot } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { listAnalyses } from "@/lib/history";
import { signalToDir, signalLabelPt, sealFromStatus, sealText, FORCE_COLOR, shortDateTime } from "@/lib/analysis/display";
import { AssetGlyph } from "@/components/asset-glyph";

export const dynamic = "force-dynamic";

const CLS_PT: Record<string, string> = {
  crypto: "Cripto",
  forex: "Forex",
  commodities: "Commodities",
  indices: "Índices",
  stocks: "Ações",
};
const CLS_OPTIONS: { key: string; label: string }[] = [
  { key: "", label: "Todas as classes" },
  { key: "crypto", label: "Cripto" },
  { key: "forex", label: "Forex" },
  { key: "commodities", label: "Commodities" },
  { key: "indices", label: "Índices" },
  { key: "stocks", label: "Ações" },
];

const LIMIT = 12;

/** Ícone de gráfico de barras (header). */
const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21h18" /><rect x="5" y="11" width="3.4" height="7" rx="1" /><rect x="10.3" y="6" width="3.4" height="12" rx="1" /><rect x="15.6" y="13" width="3.4" height="5" rx="1" />
  </svg>
);
const FunnelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
  </svg>
);

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; cls?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();
  const cls = (sp.cls ?? "").trim();

  const [user, { items, total }] = await Promise.all([
    getCurrentUser(),
    listAnalyses({ page, q: q || undefined, cls: cls || undefined, limit: LIMIT }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(total, page * LIMIT);
  const hasFilter = Boolean(q || cls);

  // monta querystrings preservando filtros
  const pageQs = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (q) params.set("q", q);
    if (cls) params.set("cls", cls);
    return `?${params.toString()}`;
  };
  const clsHref = (target: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (target) params.set("cls", target);
    const s = params.toString();
    return `/historico${s ? `?${s}` : ""}`;
  };

  return (
    <div className="hist-page">
      <AppBar
        active="historico"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />

      <div className="wrap">
        <div className="hist-head">
          <span className="hist-ico"><ChartIcon /></span>
          <div>
            <h1 className="page-title">Histórico de análises</h1>
            <div className="hist-sub">
              <b>{total}</b> {total === 1 ? "análise salva" : "análises salvas"}
              {q ? <> · busca <b>{q.toUpperCase()}</b></> : null}
              {cls ? <> · {CLS_PT[cls] ?? cls}</> : null}
            </div>
          </div>
        </div>

        <form className="toolbar" action="/historico" method="get">
          <div className="search">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5" stroke="#93A0B6" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="#93A0B6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input name="q" defaultValue={q} placeholder="Buscar ativo (ex.: BTCUSDT)…" />
          </div>
          {cls ? <input type="hidden" name="cls" value={cls} /> : null}
          <details className={`hist-filter${cls ? " on" : ""}`}>
            <summary aria-label="Filtrar por classe de ativo">
              <FunnelIcon />
              {cls ? <span className="filt-dot" aria-hidden /> : null}
            </summary>
            <div className="filt-menu">
              <span className="filt-h">Classe de ativo</span>
              {CLS_OPTIONS.map((o) => (
                <a key={o.key || "all"} className={`filt-opt${(cls || "") === o.key ? " on" : ""}`} href={clsHref(o.key)}>{o.label}</a>
              ))}
            </div>
          </details>
          <button type="submit" className="filt-go">Buscar</button>
          {hasFilter ? <a className="sel" href="/historico">Limpar</a> : null}
        </form>

        {items.length === 0 ? (
          <div className="tbl" style={{ padding: "44px 24px", textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>
              {hasFilter ? <>Nenhuma análise encontrada{q ? <> para <b>{q.toUpperCase()}</b></> : null}{cls ? <> em <b>{CLS_PT[cls] ?? cls}</b></> : null}.</> : <>Nenhuma análise ainda. Faça a primeira em <a href="/analise" style={{ color: "var(--cyan)" }}>Análise</a> — ela aparece aqui automaticamente.</>}
            </p>
          </div>
        ) : (
          <div className="tbl">
            <div className="thead">
              <span>Data</span>
              <span>Ativo</span>
              <span className="col-tf">TF</span>
              <span>Sinal</span>
              <span title="Força = convicção na direção do sinal, não probabilidade de lucro. Veja Selo e PF para a qualidade do trade.">Força ⓘ</span>
              <span>Selo</span>
              <span className="col-rr">R:R</span>
              <span className="col-pf">PF backtest</span>
              <span className="col-act" />
            </div>
            {items.map((r) => {
              const dir = signalToDir(r.signal);
              const seal = sealFromStatus(r.seal);
              return (
                <a className="trow" key={r.id} href={`/analise?id=${encodeURIComponent(r.id)}`}>
                  <span className="dt">{shortDateTime(r.createdAt)}</span>
                  <span className="asset">
                    <AssetGlyph symbol={r.symbol} size={30} />
                    <span className="s">{r.symbol}</span>
                    <span className="cls">{CLS_PT[r.assetType] ?? r.assetType}</span>
                  </span>
                  <span className="tfc col-tf">{r.timeframe.toUpperCase()}</span>
                  <span><SignalBadge direction={dir}>{signalLabelPt(r.signal)}</SignalBadge></span>
                  <span className="force" style={{ color: FORCE_COLOR[dir] }}>{r.strength}</span>
                  <span className="seal-cell"><QualityDot seal={seal} />{sealText(seal)}</span>
                  <span className="num col-rr"><b>{r.rr != null ? r.rr.toFixed(1) : "—"}</b></span>
                  <span className="num col-pf">{r.pf != null ? r.pf.toFixed(2) : "—"}</span>
                  <span className="see col-act">ver →</span>
                </a>
              );
            })}
          </div>
        )}

        {items.length > 0 ? (
          <p className="note hist-foot" style={{ margin: "14px 2px 0", fontSize: "11.5px" }}>
            <b>Força</b> = convicção na direção do sinal — <b>não</b> é probabilidade de lucro. A qualidade do trade está no <b>Selo</b> e no <b>PF backtest</b>.
          </p>
        ) : null}

        {total > LIMIT ? (
          <div className="pager">
            <div className="info">Mostrando {from}–{to} de {total}</div>
            <div className="pages">
              {page > 1 ? <a className="pg" href={pageQs(page - 1)}>‹</a> : <span className="pg" style={{ opacity: 0.4 }}>‹</span>}
              <span className="pg on">{page}</span>
              <span className="pg" style={{ pointerEvents: "none", opacity: 0.6 }}>de {totalPages}</span>
              {page < totalPages ? <a className="pg" href={pageQs(page + 1)}>›</a> : <span className="pg" style={{ opacity: 0.4 }}>›</span>}
            </div>
          </div>
        ) : null}

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
