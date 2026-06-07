"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { ENGINE_VERSION } from "@tradeai/engine";
import { AnalyzeForm } from "./analyze-form";
import { WatchlistButton } from "./watchlist-button";

type Mode = "simples" | "avancado";
const STORAGE_KEY = "tradeai:analysis-mode";

const REGIME_PT: Record<string, string> = {
  trending: "TENDÊNCIA",
  ranging: "LATERAL",
  transitional: "TRANSIÇÃO",
  explosive: "EXPLOSIVO",
};

/**
 * Casca da tela de análise: seletor de ativo + status bar de contexto REAL
 * (símbolo, TF, regime, ADX do motor) + toggle Simples × Avançado.
 * O modo é persistido em localStorage e aplicado como classe no container —
 * `.mode-simples` esconde os blocos `.adv-only` (decisão #6 do blueprint).
 */
export function AnalysisShell({
  symbol,
  timeframe,
  assetType,
  regime,
  adx,
  showForm = false,
  children,
}: {
  symbol: string;
  timeframe: Timeframe;
  assetType: AssetType;
  regime?: string;
  adx?: number;
  showForm?: boolean;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("avancado");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "simples" || saved === "avancado") setMode(saved);
    } catch {
      /* localStorage indisponível — mantém o default */
    }
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  if (showForm) {
    // Modo formulário: só o configurador (sem statusbar de uma análise inexistente).
    return (
      <div className={`analysis-page${mode === "simples" ? " mode-simples" : ""}`}>
        <div className="wrap">
          <AnalyzeForm symbol={symbol} assetType={assetType} timeframe={timeframe} />
        </div>
      </div>
    );
  }

  // Modo relatório: ativo/TF no topo + botão "Nova análise" (filtros somem).
  return (
    <div className={`analysis-page${mode === "simples" ? " mode-simples" : ""}`}>
      <div className="wrap">
        <div className="statusbar">
          <span className="seg live"><span className="dot" />LIVE</span>
          <span className="seg"><b>{symbol}</b></span>
          <span className="seg">TF <b>{timeframe.toUpperCase()}</b></span>
          {regime ? (
            <span className="seg">REGIME <b style={{ color: "var(--cyan)" }}>{REGIME_PT[regime] ?? regime.toUpperCase()}</b></span>
          ) : null}
          {typeof adx === "number" ? <span className="seg">ADX <b>{adx.toFixed(1)}</b></span> : null}
          <span className="spacer" />
          <a href="/analise?new=1" className="statusbar-new">+ Nova análise</a>
          <span className="seg last">ENGINE <b>{ENGINE_VERSION}</b></span>
          <WatchlistButton symbol={symbol} timeframe={timeframe} />
          <div className="mode-switch" role="group" aria-label="Modo de exibição">
            <button type="button" className={mode === "simples" ? "on" : undefined} onClick={() => choose("simples")} aria-pressed={mode === "simples"}>
              Simples
            </button>
            <button type="button" className={mode === "avancado" ? "on" : undefined} onClick={() => choose("avancado")} aria-pressed={mode === "avancado"}>
              Avançado
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
