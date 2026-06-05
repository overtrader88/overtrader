/**
 * Mapeamento de símbolos e intervalos por provedor de dados. Puro e testável.
 *
 * - Binance: cripto, sem chave. Intervalos batem com os nossos quase 1:1.
 * - TwelveData: forex/ações/índices/commodities (precisa de chave).
 * - Yahoo: fallback gratuito (sem 4h nativo — aproximamos por 1h).
 */
import type { AssetType, Timeframe } from "@tradeai/shared";

export const BINANCE_INTERVAL: Record<Timeframe, string> = {
  "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w", "1M": "1M",
};

export const TWELVEDATA_INTERVAL: Record<Timeframe, string> = {
  "15m": "15min", "1h": "1h", "4h": "4h", "1d": "1day", "1w": "1week", "1M": "1month",
};

/** Yahoo não tem 4h; aproximamos por 60m (documentado). */
export const YAHOO_INTERVAL: Record<Timeframe, string> = {
  "15m": "15m", "1h": "60m", "4h": "60m", "1d": "1d", "1w": "1wk", "1M": "1mo",
};

/** Símbolo interno → símbolo do provedor. */
export function binanceSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

export function twelveDataSymbol(symbol: string, assetType: AssetType): string {
  const s = symbol.toUpperCase();
  if (assetType === "forex") return `${s.slice(0, 3)}/${s.slice(3, 6)}`; // EURUSD → EUR/USD
  if (assetType === "commodities") {
    // XAUUSD → XAU/USD, WTI/Brent passam direto
    if (s.length === 6) return `${s.slice(0, 3)}/${s.slice(3, 6)}`;
    return s;
  }
  return s; // ações/índices: ticker direto
}

/** Símbolo para o Yahoo Finance (fallback). */
export function yahooSymbol(symbol: string, assetType: AssetType): string {
  const s = symbol.toUpperCase();
  switch (assetType) {
    case "crypto":
      if (s.endsWith("USDT")) return `${s.slice(0, -4)}-USD`;
      if (s.endsWith("USD")) return `${s.slice(0, -3)}-USD`;
      return s;
    case "forex":
      return `${s}=X`; // EURUSD=X
    case "commodities":
      return COMMODITY_YAHOO[s] ?? `${s}=X`;
    case "indices":
      return INDEX_YAHOO[s] ?? s;
    case "stocks":
      return s;
  }
}

const COMMODITY_YAHOO: Record<string, string> = {
  XAUUSD: "GC=F", XAGUSD: "SI=F", WTIUSD: "CL=F", BRENTUSD: "BZ=F", NATGAS: "NG=F",
  COPPER: "HG=F", XPTUSD: "PL=F", XPDUSD: "PA=F",
  CORN: "ZC=F", WHEAT: "ZW=F", SOYBEAN: "ZS=F", COFFEE: "KC=F",
};

const INDEX_YAHOO: Record<string, string> = {
  SPX: "^GSPC", NDX: "^NDX", DJI: "^DJI", IXIC: "^IXIC", VIX: "^VIX", RUT: "^RUT",
  FTSE: "^FTSE", NIKKEI: "^N225", HSI: "^HSI",
  STOXX50: "^STOXX50E", IBOV: "^BVSP", SPTSX: "^GSPTSE", ASX200: "^AXJO",
};

/** Provedor primário por classe de ativo. */
export function primaryProvider(assetType: AssetType): "binance" | "twelvedata" {
  return assetType === "crypto" ? "binance" : "twelvedata";
}
