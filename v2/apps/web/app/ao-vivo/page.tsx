import { AppBar, Panel, PanelLabel } from "@/components/ui";
import { redirect } from "next/navigation";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { LiveTrading } from "@/components/live-trading";
import { LiveGrid, type LiveAsset } from "@/components/live-grid";
import { EngineSelector } from "@/components/engine-selector";
import { ClassReadingPanel } from "@/components/class-reading-panel";
import { PriceChart } from "@/components/price-chart";
import { AiNarrative } from "@/components/ai-narrative";
import { isEngine, computeClassReading, buildClassPlan, type EngineId } from "@/lib/analysis/engines";
import { loadServerExtras } from "@/lib/analysis/class-extras";
import { buildClassPlanLines } from "@/lib/analysis/chart-overlays";
import { analyzeSymbol } from "@/lib/analysis/service";
import { listActiveLive } from "@/lib/live/session";
import { findAsset } from "@/lib/market/catalog";
import { marketState } from "@/lib/market/hours";
import type { AssetType, Timeframe } from "@tradeai/shared";

export const dynamic = "force-dynamic";

// Ativos disponíveis na grade de Live Trading (majores por classe).
const LIVE_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT",
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "XAUUSD", "DJI", "NDX", "SPX",
];

/**
 * Motor 2 na live (4h): veredito por classe + plano no gráfico + narração do
 * Motor 2 — SEM os painéis do Motor 1. Server-side; recalcula ao recarregar.
 * Falha → cai no Motor padrão (retorna null e a página renderiza o LiveTrading).
 */
async function renderLiveClass(symbol: string) {
  try {
    const a = findAsset(symbol);
    const at = (a?.assetType ?? "crypto") as AssetType;
    const tf: Timeframe = "4h";
    const dto = await analyzeSymbol(symbol, at, tf, "complete");
    const extras = await loadServerExtras(dto.analysis.meta.asset, at);
    const reading = computeClassReading(dto, at, extras);
    const lines = buildClassPlanLines(buildClassPlan(dto, reading.side));
    return (
      <>
        <ClassReadingPanel dto={dto} assetType={at} reading={reading} extras={extras} />
        <Panel>
          <PanelLabel>Gráfico · {symbol} · {tf.toUpperCase()} · plano do Motor 2</PanelLabel>
          <PriceChart symbol={symbol} assetType={at} timeframe={tf} lines={lines} />
        </Panel>
        <Panel>
          <PanelLabel>Leitura do analista · IA · Motor 2 (por classe)</PanelLabel>
          <AiNarrative symbol={symbol} assetType={at} timeframe={tf} engine="classe" />
        </Panel>
        <p className="note" style={{ marginTop: 8 }}>
          Motor 2 ao vivo: a leitura por classe (4h) é recalculada a cada atualização da página. Para fluxo contínuo em tempo
          real, use o <b>Motor padrão</b>. A cobrança da live segue por ativo, independente do motor.
        </p>
      </>
    );
  } catch {
    return null;
  }
}

export default async function AoVivoPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; engine?: string }>;
}) {
  const sp = await searchParams;
  const engine: EngineId = isEngine(sp.engine) ? sp.engine : "padrao";
  const user = await getCurrentUser();
  const sessions = user ? await listActiveLive(user.id) : [];
  const activeSymbols = sessions.map((s) => s.symbol);

  const wantSymbol = typeof sp.symbol === "string" ? sp.symbol.toUpperCase() : null;
  // Só acessa a VIEW ao vivo de um ativo cuja live está ATIVA (metering rodando).
  const liveView = wantSymbol && activeSymbols.includes(wantSymbol) ? wantSymbol : null;
  if (wantSymbol && !liveView) redirect("/ao-vivo"); // tentou acessar sem ativar

  const now = new Date();
  const assets: LiveAsset[] = LIVE_SYMBOLS.map((sym) => {
    const a = findAsset(sym);
    const at = (a?.assetType ?? "crypto") as AssetType;
    const ms = marketState(at, now);
    return { symbol: sym, name: a?.name ?? sym, assetType: at, open: ms.open, reopenHint: ms.reopenHint };
  });

  return (
    <div className="hist-page">
      <AppBar
        active="ao-vivo"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="wrap">
        {liveView ? (
          <>
            <div className="head2">
              <div>
                <a href="/ao-vivo" className="link-btn" style={{ fontSize: "0.85rem" }}>← Voltar para as lives</a>
                <h1>Trading ao vivo · {liveView}</h1>
                <div className="meta">A IA lê o gráfico, desenha o plano e narra — com prova (n · IC · selo). Live ativa · −2 créditos/h.</div>
              </div>
            </div>
            <div className="engine-bar">
              <span className="eb-k">Motor de análise</span>
              <EngineSelector active={engine} />
            </div>
            {(engine === "classe" ? await renderLiveClass(liveView) : null) ?? <LiveTrading initialSymbol={liveView} />}
          </>
        ) : (
          <>
            <div className="head2">
              <div>
                <h1>Live Trading <span className="lg-title-ia">IA 24/7</span> <span className="lg-aovivo"><span className="d" /> AO VIVO</span></h1>
                <div className="meta">Ative uma live por ativo — a IA analisa, desenha e narra em tempo real. Cripto 24/7; demais mercados em horário de pregão.</div>
              </div>
            </div>
            <LiveGrid assets={assets} activeSymbols={activeSymbols} plan={user?.plan ?? "free"} credits={user?.credits ?? 0} />
          </>
        )}
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}
