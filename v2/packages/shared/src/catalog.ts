/**
 * Catálogo de ativos.
 *
 * M0 (scaffold): contém apenas a ESTRUTURA + uma semente representativa por
 * mercado, para destravar tipos e UI. O catálogo completo dos 143 ativos
 * (59 cripto + 11 forex + 8 commodities + 59 ações + 6 índices) será portado
 * do v1 (`lib/market/catalog.ts`) no marco de dados (M4). Marcado com TODO.
 */
import type { AssetMeta, AssetType } from "./market";

// TODO(M4): portar os 143 ativos completos de lib/market/catalog.ts (v1).
export const CATALOG_SEED: AssetMeta[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", type: "crypto", sourceSymbol: "BTCUSDT", precision: 2, emoji: "🪙" },
  { symbol: "ETHUSDT", name: "Ethereum", type: "crypto", sourceSymbol: "ETHUSDT", precision: 2, emoji: "🪙" },
  { symbol: "EURUSD", name: "Euro / Dólar", type: "forex", sourceSymbol: "EUR/USD", precision: 5, emoji: "💱" },
  { symbol: "XAUUSD", name: "Ouro", type: "commodities", sourceSymbol: "XAU/USD", precision: 2, emoji: "🥇" },
  { symbol: "AAPL", name: "Apple", type: "stocks", sourceSymbol: "AAPL", precision: 2, emoji: "📈" },
  { symbol: "SPX", name: "S&P 500", type: "indices", sourceSymbol: "SPX", precision: 2, emoji: "🏛️" },
];

const BY_SYMBOL = new Map(CATALOG_SEED.map((a) => [a.symbol, a]));

export function findAsset(symbol: string): AssetMeta | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function assetsByType(type: AssetType): AssetMeta[] {
  return CATALOG_SEED.filter((a) => a.type === type);
}
