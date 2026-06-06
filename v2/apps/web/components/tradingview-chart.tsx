"use client";

import { useEffect, useRef } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";
import { toTradingViewSymbol, tvInterval } from "@/lib/market/tradingview-symbol";

/**
 * Widget oficial do TradingView (Advanced Real-Time Chart) — gráfico profissional
 * em tempo real, com indicadores e ferramentas de desenho. Gratuito p/ embutir.
 * Recria ao trocar ativo/TF. Estudos pré-carregados (médias, RSI, MACD) p/ já
 * vir "rico". A camada de análise auditável do Overtrader fica nos painéis ao lado.
 */
export function TradingViewChart({
  symbol,
  assetType,
  timeframe,
  height = 540,
}: {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = `<div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>`;
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTradingViewSymbol(symbol, assetType),
      interval: tvInterval(timeframe),
      timezone: "America/Sao_Paulo",
      theme: "dark",
      style: "1",
      locale: "br",
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      details: true,
      studies: ["STD;EMA", "STD;RSI", "STD;MACD"],
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => { el.innerHTML = ""; };
  }, [symbol, assetType, timeframe]);

  return <div className="tradingview-widget-container" ref={ref} style={{ height, width: "100%" }} />;
}
