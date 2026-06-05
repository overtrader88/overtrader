"use client";

import { useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import type { FullAnalysis } from "@/lib/analysis/full";

/**
 * Botão de export do Relatório Executivo. POSTa o DTO já calculado para
 * `/api/report`, que renderiza um PDF DESENHADO (não a tela impressa) via
 * @react-pdf/renderer, e dispara o download do arquivo real. Mostra estado de
 * "gerando" e degrada com mensagem se a rota falhar.
 */
export function ReportActions({
  dto,
  symbol,
  assetType,
  timeframe,
}: {
  dto: FullAnalysis;
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    setState("loading");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dto, symbol, assetType, timeframe }),
      });
      if (!res.ok) throw new Error("falha");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Overtrader-${symbol}-${timeframe.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <div className="report-actions">
      <button type="button" className="report-print" onClick={download} disabled={state === "loading"}>
        {state === "loading" ? "Gerando PDF…" : state === "error" ? "Falhou — tentar de novo" : "↓ Baixar relatório (PDF)"}
      </button>
    </div>
  );
}
