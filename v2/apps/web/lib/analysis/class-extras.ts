/**
 * Carrega os dados externos REAIS do Motor 2 que rodam SERVER-SIDE (macro/Yahoo,
 * COT/CFTC, fundamentos/earnings FMP, on-chain DefiLlama, breadth, estoques EIA).
 *
 * Derivativos da Binance e o heatmap de liquidação NÃO entram aqui — a Binance
 * bloqueia IP de cloud, então eles são buscados no navegador (componentes client)
 * e nunca no servidor (nem no cron). Compartilhado entre o painel e o cron de
 * emissão para que a leitura por classe seja consistente.
 */
import type { AssetType } from "@tradeai/shared";
import type { ClassExtras } from "./engines";
import { getMacroContext } from "@/lib/market/macro-yahoo";
import { getCotPositioning } from "@/lib/market/cot-cftc";
import { fetchFmpFundamental, fetchNextEarnings } from "@/lib/market/fmp";
import { fetchFundamental } from "@/lib/market/defillama";
import { getBreadthProxy } from "@/lib/market/breadth-yahoo";
import { getOilInventory } from "@/lib/market/eia";

export async function loadServerExtras(asset: string, assetType: AssetType): Promise<ClassExtras> {
  const fmpKey = process.env.FMP_API_KEY;
  const [macro, cot, fundamental, onchain, breadth, earnings, oil] = await Promise.all([
    assetType === "forex" || assetType === "commodities" || assetType === "indices"
      ? getMacroContext({ dxy: assetType !== "indices", vix: assetType === "indices", us10y: assetType === "indices" })
      : Promise.resolve(null),
    assetType === "forex" || assetType === "commodities" ? getCotPositioning(asset) : Promise.resolve(null),
    assetType === "stocks" && fmpKey ? fetchFmpFundamental(asset, fmpKey) : Promise.resolve(null),
    assetType === "crypto" ? fetchFundamental(asset) : Promise.resolve(null),
    assetType === "indices" ? getBreadthProxy() : Promise.resolve(null),
    assetType === "stocks" && fmpKey ? fetchNextEarnings(asset, fmpKey) : Promise.resolve(null),
    assetType === "commodities" ? getOilInventory(asset) : Promise.resolve(null),
  ]);
  return { macro, cot, fundamental, onchain, breadth, earnings, oil };
}
