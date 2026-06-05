/**
 * Catálogo completo de ativos suportados.
 *
 * 5 categorias:
 *   - crypto      59 pares USDT na Binance (sem auth)
 *   - forex       11 pares via Twelve Data (free tier 800 req/dia)
 *   - commodities  8 ativos via Twelve Data
 *   - stocks      59 ações (US + BR) via Twelve Data
 *                 BR usam suffix :SAO (B3). Free tier pode ter coverage limitado.
 *   - indices      6 índices globais via Twelve Data
 */
import type { AssetMeta, AssetType, Timeframe } from "./types";

export const SUPPORTED_TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "15m", label: "15 minutos" },
  { value: "1h", label: "1 hora" },
  { value: "4h", label: "4 horas" },
  { value: "1d", label: "Diário" },
  { value: "1w", label: "Semanal" },
  { value: "1M", label: "Mensal" },
];

const C = (symbol: string, name: string, sourceSymbol: string, precision: number, emoji: string): AssetMeta =>
  ({ symbol, name, type: "crypto", sourceSymbol, precision, emoji });

const F = (symbol: string, name: string, sourceSymbol: string, precision: number, emoji: string): AssetMeta =>
  ({ symbol, name, type: "forex", sourceSymbol, precision, emoji });

const M = (symbol: string, name: string, sourceSymbol: string, precision: number, emoji: string): AssetMeta =>
  ({ symbol, name, type: "commodities", sourceSymbol, precision, emoji });

const S = (symbol: string, name: string, sourceSymbol: string, precision: number, emoji: string): AssetMeta =>
  ({ symbol, name, type: "stocks", sourceSymbol, precision, emoji });

const I = (symbol: string, name: string, sourceSymbol: string, precision: number, emoji: string): AssetMeta =>
  ({ symbol, name, type: "indices", sourceSymbol, precision, emoji });

export const ASSETS: AssetMeta[] = [
  // ===== CRYPTO (59) - Binance =====
  C("BTCUSDT", "Bitcoin", "BTCUSDT", 2, "BTC"),
  C("ETHUSDT", "Ethereum", "ETHUSDT", 2, "ETH"),
  C("SOLUSDT", "Solana", "SOLUSDT", 2, "SOL"),
  C("BNBUSDT", "Binance Coin", "BNBUSDT", 2, "BNB"),
  C("XRPUSDT", "XRP", "XRPUSDT", 4, "XRP"),
  C("ADAUSDT", "Cardano", "ADAUSDT", 4, "ADA"),
  C("DOGEUSDT", "Dogecoin", "DOGEUSDT", 5, "DOGE"),
  C("DOTUSDT", "Polkadot", "DOTUSDT", 3, "DOT"),
  C("AVAXUSDT", "Avalanche", "AVAXUSDT", 3, "AVAX"),
  C("MATICUSDT", "Polygon (POL)", "POLUSDT", 4, "POL"),
  C("LINKUSDT", "Chainlink", "LINKUSDT", 3, "LINK"),
  C("LTCUSDT", "Litecoin", "LTCUSDT", 2, "LTC"),
  C("UNIUSDT", "Uniswap", "UNIUSDT", 3, "UNI"),
  C("SHIBUSDT", "Shiba Inu", "SHIBUSDT", 8, "SHIB"),
  C("ATOMUSDT", "Cosmos", "ATOMUSDT", 3, "ATOM"),
  C("NEARUSDT", "NEAR Protocol", "NEARUSDT", 3, "NEAR"),
  C("FTMUSDT", "Fantom", "FTMUSDT", 4, "FTM"),
  C("ALGOUSDT", "Algorand", "ALGOUSDT", 4, "ALGO"),
  C("ICPUSDT", "Internet Computer", "ICPUSDT", 2, "ICP"),
  C("FILUSDT", "Filecoin", "FILUSDT", 3, "FIL"),
  C("APEUSDT", "ApeCoin", "APEUSDT", 4, "APE"),
  C("SANDUSDT", "The Sandbox", "SANDUSDT", 4, "SAND"),
  C("MANAUSDT", "Decentraland", "MANAUSDT", 4, "MANA"),
  C("AXSUSDT", "Axie Infinity", "AXSUSDT", 3, "AXS"),
  C("AAVEUSDT", "Aave", "AAVEUSDT", 2, "AAVE"),
  C("CRVUSDT", "Curve DAO", "CRVUSDT", 4, "CRV"),
  C("MKRUSDT", "Maker", "MKRUSDT", 2, "MKR"),
  C("COMPUSDT", "Compound", "COMPUSDT", 2, "COMP"),
  C("ENJUSDT", "Enjin Coin", "ENJUSDT", 4, "ENJ"),
  C("SUSHIUSDT", "SushiSwap", "SUSHIUSDT", 3, "SUSHI"),
  C("YFIUSDT", "yearn.finance", "YFIUSDT", 1, "YFI"),
  C("SNXUSDT", "Synthetix", "SNXUSDT", 3, "SNX"),
  C("GRTUSDT", "The Graph", "GRTUSDT", 4, "GRT"),
  C("1INCHUSDT", "1inch", "1INCHUSDT", 4, "1IN"),
  C("BATUSDT", "Basic Attention", "BATUSDT", 4, "BAT"),
  C("ZECUSDT", "Zcash", "ZECUSDT", 2, "ZEC"),
  C("EOSUSDT", "EOS", "EOSUSDT", 3, "EOS"),
  C("XLMUSDT", "Stellar", "XLMUSDT", 5, "XLM"),
  C("VETUSDT", "VeChain", "VETUSDT", 5, "VET"),
  C("THETAUSDT", "Theta Network", "THETAUSDT", 3, "THETA"),
  C("HBARUSDT", "Hedera", "HBARUSDT", 4, "HBAR"),
  C("ETCUSDT", "Ethereum Classic", "ETCUSDT", 2, "ETC"),
  C("XTZUSDT", "Tezos", "XTZUSDT", 3, "XTZ"),
  C("EGLDUSDT", "MultiversX", "EGLDUSDT", 2, "EGLD"),
  C("RUNEUSDT", "THORChain", "RUNEUSDT", 3, "RUNE"),
  C("INJUSDT", "Injective", "INJUSDT", 2, "INJ"),
  C("OPUSDT", "Optimism", "OPUSDT", 3, "OP"),
  C("ARBUSDT", "Arbitrum", "ARBUSDT", 3, "ARB"),
  C("SUIUSDT", "Sui", "SUIUSDT", 3, "SUI"),
  C("SEIUSDT", "Sei", "SEIUSDT", 4, "SEI"),
  C("TIAUSDT", "Celestia", "TIAUSDT", 3, "TIA"),
  C("PEPEUSDT", "Pepe", "PEPEUSDT", 8, "PEPE"),
  C("WIFUSDT", "dogwifhat", "WIFUSDT", 4, "WIF"),
  C("RENDERUSDT", "Render", "RENDERUSDT", 3, "RNDR"),
  C("FETUSDT", "Fetch.ai", "FETUSDT", 4, "FET"),
  C("TAOUSDT", "Bittensor", "TAOUSDT", 2, "TAO"),
  C("TRXUSDT", "TRON", "TRXUSDT", 5, "TRX"),
  C("TONUSDT", "Toncoin", "TONUSDT", 3, "TON"),
  C("API3USDT", "API3", "API3USDT", 4, "API3"),

  // ===== FOREX (11) - Twelve Data =====
  F("EURUSD", "Euro / Dolar", "EUR/USD", 5, "EUR"),
  F("GBPUSD", "Libra / Dolar", "GBP/USD", 5, "GBP"),
  F("USDJPY", "Dolar / Iene", "USD/JPY", 3, "JPY"),
  F("USDCHF", "Dolar / Franco Suico", "USD/CHF", 5, "CHF"),
  F("AUDUSD", "Aussie / Dolar", "AUD/USD", 5, "AUD"),
  F("USDCAD", "Dolar / Canadense", "USD/CAD", 5, "CAD"),
  F("NZDUSD", "Neozelandes / Dolar", "NZD/USD", 5, "NZD"),
  F("EURGBP", "Euro / Libra", "EUR/GBP", 5, "EUR"),
  F("EURJPY", "Euro / Iene", "EUR/JPY", 3, "EUR"),
  F("GBPJPY", "Libra / Iene", "GBP/JPY", 3, "GBP"),
  F("USDBRL", "Dolar / Real", "USD/BRL", 4, "BRL"),

  // ===== COMMODITIES (8) - Twelve Data =====
  M("XAUUSD", "Ouro", "XAU/USD", 2, "AU"),
  M("XAGUSD", "Prata", "XAG/USD", 3, "AG"),
  M("WTIUSD", "Petroleo WTI", "WTI/USD", 2, "WTI"),
  M("BRNUSD", "Petroleo Brent", "BRENT/USD", 2, "BRN"),
  M("NGUSD", "Gas Natural", "NG/USD", 4, "NG"),
  M("ZSUSD", "Soja", "ZS=F", 2, "SOJ"),
  M("ZCUSD", "Milho", "ZC=F", 2, "MIL"),
  M("KCUSD", "Cafe", "KC=F", 2, "COF"),

  // ===== STOCKS US (33) - Twelve Data =====
  S("AAPL", "Apple", "AAPL", 2, "AAPL"),
  S("MSFT", "Microsoft", "MSFT", 2, "MSFT"),
  S("GOOGL", "Google", "GOOGL", 2, "GOOG"),
  S("AMZN", "Amazon", "AMZN", 2, "AMZN"),
  S("TSLA", "Tesla", "TSLA", 2, "TSLA"),
  S("NVDA", "NVIDIA", "NVDA", 2, "NVDA"),
  S("META", "Meta", "META", 2, "META"),
  S("NFLX", "Netflix", "NFLX", 2, "NFLX"),
  S("AMD", "AMD", "AMD", 2, "AMD"),
  S("INTC", "Intel", "INTC", 2, "INTC"),
  S("DIS", "Disney", "DIS", 2, "DIS"),
  S("PYPL", "PayPal", "PYPL", 2, "PYPL"),
  S("UBER", "Uber", "UBER", 2, "UBER"),
  S("CRM", "Salesforce", "CRM", 2, "CRM"),
  S("ORCL", "Oracle", "ORCL", 2, "ORCL"),
  S("COIN", "Coinbase", "COIN", 2, "COIN"),
  S("SQ", "Block", "SQ", 2, "SQ"),
  S("PLTR", "Palantir", "PLTR", 2, "PLTR"),
  S("SNAP", "Snap Inc.", "SNAP", 2, "SNAP"),
  S("SHOP", "Shopify", "SHOP", 2, "SHOP"),
  S("SPOT", "Spotify", "SPOT", 2, "SPOT"),
  S("BA", "Boeing", "BA", 2, "BA"),
  S("JPM", "JPMorgan Chase", "JPM", 2, "JPM"),
  S("V", "Visa", "V", 2, "V"),
  S("MA", "Mastercard", "MA", 2, "MA"),
  S("WMT", "Walmart", "WMT", 2, "WMT"),
  S("KO", "Coca-Cola", "KO", 2, "KO"),
  S("PEP", "PepsiCo", "PEP", 2, "PEP"),
  S("JNJ", "Johnson & Johnson", "JNJ", 2, "JNJ"),
  S("PFE", "Pfizer", "PFE", 2, "PFE"),
  S("XOM", "ExxonMobil", "XOM", 2, "XOM"),
  S("ABNB", "Airbnb", "ABNB", 2, "ABNB"),
  S("RBLX", "Roblox", "RBLX", 2, "RBLX"),

  // ===== STOCKS BR (26) - Twelve Data (:SAO) =====
  S("PETR4", "Petrobras PN", "PETR4:SAO", 2, "BR"),
  S("VALE3", "Vale ON", "VALE3:SAO", 2, "BR"),
  S("ITUB4", "Itau Unibanco PN", "ITUB4:SAO", 2, "BR"),
  S("BBDC4", "Bradesco PN", "BBDC4:SAO", 2, "BR"),
  S("BBAS3", "Banco do Brasil ON", "BBAS3:SAO", 2, "BR"),
  S("ABEV3", "Ambev ON", "ABEV3:SAO", 2, "BR"),
  S("B3SA3", "B3 ON", "B3SA3:SAO", 2, "BR"),
  S("WEGE3", "WEG ON", "WEGE3:SAO", 2, "BR"),
  S("MGLU3", "Magazine Luiza ON", "MGLU3:SAO", 2, "BR"),
  S("RENT3", "Localiza ON", "RENT3:SAO", 2, "BR"),
  S("SUZB3", "Suzano ON", "SUZB3:SAO", 2, "BR"),
  S("RAIL3", "Rumo ON", "RAIL3:SAO", 2, "BR"),
  S("EMBR3", "Embraer ON", "EMBR3:SAO", 2, "BR"),
  S("VIVT3", "Telefonica Brasil", "VIVT3:SAO", 2, "BR"),
  S("ELET3", "Eletrobras ON", "ELET3:SAO", 2, "BR"),
  S("CORS3", "Corsan ON", "CORS3:SAO", 2, "BR"),
  S("PRIO3", "PRIO ON", "PRIO3:SAO", 2, "BR"),
  S("HAPV3", "Hapvida ON", "HAPV3:SAO", 2, "BR"),
  S("UNIP6", "Unipar ON", "UNIP6:SAO", 2, "BR"),
  S("RADL3", "Raia Drogasil ON", "RADL3:SAO", 2, "BR"),
  S("JBSS3", "JBS ON", "JBSS3:SAO", 2, "BR"),
  S("TOTS3", "TOTVS ON", "TOTS3:SAO", 2, "BR"),
  S("LREN3", "Lojas Renner ON", "LREN3:SAO", 2, "BR"),
  S("ENEV3", "Eneva ON", "ENEV3:SAO", 2, "BR"),
  S("KLBN11", "Klabin UNT", "KLBN11:SAO", 2, "BR"),
  S("SBSP3", "Sabesp ON", "SBSP3:SAO", 2, "BR"),

  // ===== INDICES (6) - Twelve Data =====
  I("SPX", "S&P 500", "SPX", 2, "SPX"),
  I("IBOV", "Ibovespa", "IBOV", 0, "BVSP"),
  I("NDX", "Nasdaq 100", "NDX", 2, "NDX"),
  I("DJI", "Dow Jones", "DJI", 2, "DJI"),
  I("DAX", "DAX (Alemanha)", "DAX", 2, "DAX"),
  I("N225", "Nikkei 225", "N225", 2, "N225"),
];

export function getAsset(symbol: string): AssetMeta | undefined {
  return ASSETS.find((a) => a.symbol === symbol);
}

export function getAssetsByType(type: AssetType): AssetMeta[] {
  return ASSETS.filter((a) => a.type === type);
}

/** Lista dos tipos de ativo realmente presentes no catálogo (ordem que aparecem) */
export function listAssetTypes(): AssetType[] {
  const seen = new Set<AssetType>();
  for (const a of ASSETS) {
    if (!seen.has(a.type)) seen.add(a.type);
  }
  return Array.from(seen);
}

/** Label PT-BR para o tipo de ativo */
export function assetTypeLabel(type: AssetType): string {
  const map: Record<AssetType, string> = {
    crypto: "Criptomoedas",
    forex: "Forex",
    commodities: "Commodities",
    stocks: "Acoes",
    indices: "Indices",
  };
  return map[type];
}

/** Emoji do tipo de ativo (mostrado no segmented control) */
export function assetTypeEmoji(type: AssetType): string {
  const map: Record<AssetType, string> = {
    crypto: "C",
    forex: "F",
    commodities: "M",
    stocks: "S",
    indices: "I",
  };
  return map[type];
}

export function tradingViewSymbol(asset: AssetMeta): string {
  if (asset.type === "crypto") return `BINANCE:${asset.symbol}`;
  if (asset.type === "forex") return `FX:${asset.symbol}`;
  return asset.symbol;
}

export function timeframeMinutes(tf: Timeframe): number {
  switch (tf) {
    case "15m": return 15;
    case "1h":  return 60;
    case "4h":  return 240;
    case "1d":  return 1440;
    case "1w":  return 10080;
    case "1M":  return 43200;
  }
}
