"use client";

import { useState, type ReactNode } from "react";

/**
 * Quando a página de Análise abre sem pedido explícito, mostramos a ÚLTIMA
 * análise salva — MINIMIZADA, com data/hora e ação de expandir. Deixa claro que
 * é histórico (não uma análise nova) e não polui a tela. Se `enabled` for false,
 * renderiza o conteúdo normalmente (caso de análise nova ou snapshot por id).
 */
export function LastAnalysisBanner({ enabled, generatedAt, symbol, timeframe, children }: { enabled: boolean; generatedAt?: number; symbol?: string; timeframe?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!enabled) return <>{children}</>;

  const dt = generatedAt
    ? new Date(generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  const asset = symbol ? `${symbol}${timeframe ? ` · ${timeframe.toUpperCase()}` : ""}` : null;

  return (
    <>
      <button type="button" className={`last-an${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="last-an-l">
          <span className="last-an-tag">Última análise gerada</span>
          {asset ? <span className="last-an-asset">{asset}</span> : null}
          {dt ? <span className="last-an-dt">{dt}</span> : null}
        </span>
        <span className="last-an-btn">{open ? "Recolher ▲" : "Expandir ▼"}</span>
      </button>
      {open ? (
        <div className="last-an-body">{children}</div>
      ) : (
        <p className="note" style={{ padding: "8px 2px 14px" }}>
          Sua análise mais recente está recolhida — clique em <b>Expandir</b> para ver. Para uma análise <b>nova</b>, escolha o ativo e o timeframe no seletor acima (1 crédito).
        </p>
      )}
    </>
  );
}
