/**
 * Universo curado do track record OFICIAL. São os mercados que a plataforma
 * acompanha de forma forward (independe de usuário navegar) — base do moat.
 * Mantido pequeno p/ caber no orçamento de tempo do cron; expandir aos poucos.
 */
import type { AssetType, Timeframe } from "@tradeai/shared";

export interface TrackedMarket {
  symbol: string;
  assetType: AssetType;
  timeframe: Timeframe;
}

export const TRACKED_MARKETS: TrackedMarket[] = [
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "4h" },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "4h" },
  { symbol: "SOLUSDT", assetType: "crypto", timeframe: "4h" },
  { symbol: "BTCUSDT", assetType: "crypto", timeframe: "1d" },
  { symbol: "ETHUSDT", assetType: "crypto", timeframe: "1d" },
  { symbol: "SOLUSDT", assetType: "crypto", timeframe: "1d" },
  { symbol: "XAUUSD", assetType: "commodities", timeframe: "4h" },
  { symbol: "XAUUSD", assetType: "commodities", timeframe: "1d" },
  // Expansão 02/07: +forex e +índice p/ acelerar a amostra do comparativo de
  // motores (mais desfechos/dia) e testar as famílias fora de cripto/metal.
  { symbol: "EURUSD", assetType: "forex", timeframe: "4h" },
  { symbol: "EURUSD", assetType: "forex", timeframe: "1d" },
  { symbol: "SPX", assetType: "indices", timeframe: "4h" },
  { symbol: "SPX", assetType: "indices", timeframe: "1d" },
];
