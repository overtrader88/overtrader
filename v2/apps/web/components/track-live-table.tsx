"use client";

import { useMemo, useState } from "react";
import { AssetGlyph } from "@/components/asset-glyph";

export interface LiveItem {
  symbol: string;
  timeframe: string;
  engine: string;
  direction: string;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  stopStage: string;
  emittedAt: string | null;
}

const ENGINE_SHORT: Record<string, string> = { padrao: "Padrão", padrao_b: "Padrão-B", classe: "Classe", classe_b: "Classe-B", llm: "GPT", llm_ds: "DeepSeek", llm_surv: "Sobrev·GPT", llm_ds_surv: "Sobrev·DS", llm_vsf: "VSF·GPT", llm_ds_vsf: "VSF·DS", llm_vsf_surv: "VSF+S·GPT", llm_ds_vsf_surv: "VSF+S·DS", condicional: "Cond", contrario: "Contra", consenso: "Cons" };
const STOP_PT: Record<string, { label: string; tone: "init" | "be" | "tp1" }> = {
  initial: { label: "stop inicial", tone: "init" },
  breakeven: { label: "stop no breakeven · risco zerado", tone: "be" },
  tp1: { label: "stop no TP1 · lucro travado", tone: "tp1" },
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—");

const ShieldIco = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" />
    {on ? <path d="m9 12 2 2 4-4" /> : null}
  </svg>
);
const CalIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);
const SortIco = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m8 9 4-4 4 4M8 15l4 4 4-4" /></svg>
);

type Key = "symbol" | "direction" | "progress" | "stop" | "emitted";
const PROG = (l: LiveItem) => (l.tp1Hit ? 1 : 0) + (l.tp2Hit ? 1 : 0) + (l.tp3Hit ? 1 : 0);
const STOPRANK: Record<string, number> = { initial: 0, breakeven: 1, tp1: 2 };

export function TrackLiveTable({ rows, showEngine }: { rows: LiveItem[]; showEngine: boolean }) {
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "emitted", dir: -1 });
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const cmp: Record<Key, (l: LiveItem) => number | string> = {
      symbol: (l) => l.symbol,
      direction: (l) => (l.direction.includes("BUY") ? "Compra" : "Venda"),
      progress: (l) => PROG(l),
      stop: (l) => STOPRANK[l.stopStage] ?? 0,
      emitted: (l) => (l.emittedAt ? new Date(l.emittedAt).getTime() : 0),
    };
    const f = cmp[sort.k];
    return [...rows].sort((a, b) => {
      const va = f(a), vb = f(b);
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return 0;
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const pg = Math.min(page, totalPages);
  const pageRows = sorted.slice((pg - 1) * perPage, pg * perPage);

  const setKey = (k: Key) => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: 1 }));
  const Th = ({ k, children, className }: { k?: Key; children: React.ReactNode; className?: string }) => (
    <span className={className}>
      {children}
      {k ? <button type="button" className={`tr-sort${sort.k === k ? " on" : ""}`} aria-label="Ordenar" onClick={() => setKey(k)}><SortIco /></button> : null}
    </span>
  );

  // janela de paginação compacta
  const pagesToShow: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p <= 3 || p === totalPages || Math.abs(p - pg) <= 1) pagesToShow.push(p);
    else if (pagesToShow[pagesToShow.length - 1] !== "…") pagesToShow.push("…");
  }

  return (
    <div className="trk">
      <div className="trk-head trk-live">
        <Th k="symbol">Ativo</Th>
        <Th k="direction">Direção</Th>
        <Th k="progress">Progresso</Th>
        <Th k="stop">Stop</Th>
        <Th k="emitted">Emitido</Th>
        <span />
      </div>
      {pageRows.map((l, i) => {
        const buy = l.direction.includes("BUY");
        const st = STOP_PT[l.stopStage] ?? { label: l.stopStage, tone: "init" as const };
        return (
          <div className="trk-row trk-live" key={`${l.symbol}-${l.emittedAt}-${i}`}>
            <span className="trk-asset">
              <AssetGlyph symbol={l.symbol} size={30} />
              <span className="trk-sym"><b>{l.symbol}</b> · {l.timeframe.toUpperCase()}</span>
              {showEngine ? <span className="trk-eng">{ENGINE_SHORT[l.engine] ?? l.engine}</span> : null}
            </span>
            <span className={`trk-dir ${buy ? "up" : "dn"}`}>{buy ? "↗ Compra" : "↘ Venda"}</span>
            <span className="trk-prog">
              <i className={l.tp1Hit ? "on" : ""}>TP1</i>
              <i className={l.tp2Hit ? "on" : ""}>TP2</i>
              <i className={l.tp3Hit ? "on" : ""}>TP3</i>
            </span>
            <span className={`trk-stop ${st.tone}`}><ShieldIco on={st.tone !== "init"} /> {st.label}</span>
            <span className="trk-date"><CalIco /> {fmtDate(l.emittedAt)}</span>
            <span className="trk-chev" aria-hidden>›</span>
          </div>
        );
      })}

      {totalPages > 1 || rows.length > 20 ? (
        <div className="trk-pager">
          <div className="trk-pages">
            <button type="button" className="trk-pg" disabled={pg <= 1} onClick={() => setPage(pg - 1)} aria-label="Anterior">‹</button>
            {pagesToShow.map((p, i) =>
              p === "…" ? <span className="trk-dots" key={`d${i}`}>…</span> : (
                <button type="button" key={p} className={`trk-pg${p === pg ? " on" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ),
            )}
            <button type="button" className="trk-pg" disabled={pg >= totalPages} onClick={() => setPage(pg + 1)} aria-label="Próxima">›</button>
          </div>
          <label className="trk-perpage">
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label="Itens por página">
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
