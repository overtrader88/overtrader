import { AppBar, SignalBadge, QualityDot } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { listAnalyses } from "@/lib/history";
import { signalToDir, signalLabelPt, sealFromStatus, sealText, FORCE_COLOR, shortDateTime } from "@/lib/analysis/display";

export const dynamic = "force-dynamic";

const CLS_PT: Record<string, string> = {
  crypto: "Cripto",
  forex: "Forex",
  commodities: "Commodities",
  indices: "Índices",
  stocks: "Ações",
};

const LIMIT = 12;

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const q = (sp.q ?? "").trim();

  const [user, { items, total }] = await Promise.all([
    getCurrentUser(),
    listAnalyses({ page, q: q || undefined, limit: LIMIT }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(total, page * LIMIT);
  const qs = (p: number) => `?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

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
        <div className="head2">
          <div>
            <h1>Histórico de análises</h1>
            <div className="meta">
              <b>{total}</b> {total === 1 ? "análise salva" : "análises salvas"}
              {q ? <> · filtro <b>{q.toUpperCase()}</b></> : null}
            </div>
          </div>
        </div>

        <form className="toolbar" action="/historico" method="get">
          <div className="search">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="5" stroke="#93A0B6" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="#93A0B6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input name="q" defaultValue={q} placeholder="Buscar ativo (ex.: BTCUSDT)…" />
          </div>
          <button type="submit" className="sel act" style={{ cursor: "pointer" }}>Buscar</button>
          {q ? <a className="sel" href="/historico">Limpar</a> : null}
        </form>

        {items.length === 0 ? (
          <div className="tbl" style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>
              {q ? <>Nenhuma análise encontrada para <b>{q.toUpperCase()}</b>.</> : <>Nenhuma análise ainda. Faça a primeira em <a href="/analise" style={{ color: "var(--cyan)" }}>Análise</a> — ela aparece aqui automaticamente.</>}
            </p>
          </div>
        ) : (
          <div className="tbl">
            <div className="thead">
              <span>Data</span>
              <span>Ativo</span>
              <span className="col-tf">TF</span>
              <span>Sinal</span>
              <span>Força</span>
              <span>Selo</span>
              <span className="col-rr">R:R</span>
              <span className="col-pf">PF backtest</span>
              <span className="col-act" />
            </div>
            {items.map((r) => {
              const dir = signalToDir(r.signal);
              const seal = sealFromStatus(r.seal);
              return (
                <div className="trow" key={r.id}>
                  <span className="dt">{shortDateTime(r.createdAt)}</span>
                  <span className="asset">
                    <span className="s">{r.symbol}</span>
                    <span className="cls">{CLS_PT[r.assetType] ?? r.assetType}</span>
                  </span>
                  <span className="tfc col-tf">{r.timeframe.toUpperCase()}</span>
                  <span><SignalBadge direction={dir}>{signalLabelPt(r.signal)}</SignalBadge></span>
                  <span className="force" style={{ color: FORCE_COLOR[dir] }}>{r.strength}</span>
                  <span className="seal-cell"><QualityDot seal={seal} />{sealText(seal)}</span>
                  <span className="num col-rr"><b>{r.rr != null ? r.rr.toFixed(1) : "—"}</b></span>
                  <span className="num col-pf">{r.pf != null ? r.pf.toFixed(2) : "—"}</span>
                  <a className="see col-act" href={`/analise?id=${encodeURIComponent(r.id)}`}>ver →</a>
                </div>
              );
            })}
          </div>
        )}

        {total > LIMIT ? (
          <div className="pager">
            <div className="info">Mostrando {from}–{to} de {total}</div>
            <div className="pages">
              {page > 1 ? <a className="pg" href={qs(page - 1)}>‹</a> : <span className="pg" style={{ opacity: 0.4 }}>‹</span>}
              <span className="pg on">{page}</span>
              <span className="pg" style={{ pointerEvents: "none", opacity: 0.6 }}>de {totalPages}</span>
              {page < totalPages ? <a className="pg" href={qs(page + 1)}>›</a> : <span className="pg" style={{ opacity: 0.4 }}>›</span>}
            </div>
          </div>
        ) : null}

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
