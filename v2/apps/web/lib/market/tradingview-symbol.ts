/**
 * Mapeia (símbolo do catálogo, classe) → símbolo do TradingView, e timeframe →
 * intervalo do TradingView. Best-effort; o widget permite trocar o símbolo se
 * algum não resolver. Cripto via BINANCE (sólido); demais com prefixos comuns.
 */
import type { AssetType, Timeframe } from "@tradeai/shared";

const INDEX_TV: Record<string, string> = {
  SPX: "SP:SPX", NDX: "NASDAQ:NDX", DJI: "DJ:DJI", IXIC: "NASDAQ:IXIC", VIX: "CBOE:VIX", RUT: "TVC:RUT",
  FTSE: "TVC:UKX", NIKKEI: "TVC:NI225", HSI: "TVC:HSI", STOXX50: "TVC:SX5E",
  IBOV: "BMFBOVESPA:IBOV", SPTSX: "TSX:TSX", ASX200: "ASX:XJO",
};
const COMMODITY_TV: Record<string, string> = {
  XAUUSD: "TVC:GOLD", XAGUSD: "TVC:SILVER", WTIUSD: "TVC:USOIL", BRENTUSD: "TVC:UKOIL", NATGAS: "TVC:NATURALGAS",
  COPPER: "COMEX:HG1!", XPTUSD: "TVC:PLATINUM", XPDUSD: "TVC:PALLADIUM",
  CORN: "CBOT:ZC1!", WHEAT: "CBOT:ZW1!", SOYBEAN: "CBOT:ZS1!", COFFEE: "ICEUS:KC1!",
};

export function toTradingViewSymbol(symbol: string, assetType: AssetType): string {
  const s = symbol.toUpperCase();
  switch (assetType) {
    case "crypto": return `BINANCE:${s}`;          // BTCUSDT → BINANCE:BTCUSDT
    case "forex": return `FX:${s}`;                // EURUSD → FX:EURUSD
    case "indices": return INDEX_TV[s] ?? s;
    case "commodities": return COMMODITY_TV[s] ?? s;
    case "stocks": return s;                        // AAPL → o TV resolve a bolsa
    default: return s;
  }
}

export function tvInterval(tf: Timeframe): string {
  switch (tf) {
    case "15m": return "15";
    case "1h": return "60";
    case "4h": return "240";
    case "1d": return "D";
    case "1w": return "W";
    case "1M": return "M";
    default: return "240";
  }
}
