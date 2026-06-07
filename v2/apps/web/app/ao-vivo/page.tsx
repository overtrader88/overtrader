import { AppBar } from "@/components/ui";
import { redirect } from "next/navigation";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { LiveTrading } from "@/components/live-trading";
import { LiveGrid, type LiveAsset } from "@/components/live-grid";
import { listActiveLive } from "@/lib/live/session";
import { findAsset } from "@/lib/market/catalog";
import { marketState } from "@/lib/market/hours";
import type { AssetType } from "@tradeai/shared";

export const dynamic = "force-dynamic";

// Ativos disponíveis na grade de Live Trading (majores por classe).
const LIVE_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT",
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "XAUUSD", "DJI", "NDX", "SPX",
];

export default async function AoVivoPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const sp = await searchParams;
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
            <LiveTrading initialSymbol={liveView} />
          </>
        ) : (
          <>
            <div className="head2">
              <div>
                <h1>Live Trading IA 24/7</h1>
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
