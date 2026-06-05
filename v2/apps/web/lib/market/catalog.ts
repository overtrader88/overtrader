/**
 * Catálogo multi-mercado — fonte dos seletores, tickers do dashboard e /api/quotes.
 * Só ativos FETCHÁVEIS com a infra atual: cripto via Binance (pares USDT, sem
 * chave), forex via Yahoo (`=X`), commodities/índices mapeados no Yahoo
 * (symbols.ts), ações US diretas no Yahoo. (TwelveData, se houver chave, amplia.)
 */
import type { AssetType } from "@tradeai/shared";

export interface CatalogAsset {
  symbol: string;
  name: string;
  assetType: AssetType;
}

const CRYPTO: [string, string][] = [
  ["BTCUSDT", "Bitcoin"], ["ETHUSDT", "Ethereum"], ["BNBUSDT", "BNB"], ["XRPUSDT", "XRP"],
  ["ADAUSDT", "Cardano"], ["DOGEUSDT", "Dogecoin"], ["SOLUSDT", "Solana"], ["LINKUSDT", "Chainlink"],
  ["LTCUSDT", "Litecoin"], ["BCHUSDT", "Bitcoin Cash"], ["ETCUSDT", "Ethereum Classic"], ["XLMUSDT", "Stellar"],
  ["TRXUSDT", "TRON"], ["EOSUSDT", "EOS"], ["XMRUSDT", "Monero"], ["ATOMUSDT", "Cosmos"],
  ["VETUSDT", "VeChain"], ["ALGOUSDT", "Algorand"], ["MATICUSDT", "Polygon"], ["AVAXUSDT", "Avalanche"],
  ["FILUSDT", "Filecoin"], ["AAVEUSDT", "Aave"], ["UNIUSDT", "Uniswap"], ["NEOUSDT", "Neo"],
  ["DASHUSDT", "Dash"], ["DOTUSDT", "Polkadot"], ["NEARUSDT", "NEAR"], ["APTUSDT", "Aptos"],
  ["ARBUSDT", "Arbitrum"], ["OPUSDT", "Optimism"], ["INJUSDT", "Injective"], ["SUIUSDT", "Sui"],
  ["SHIBUSDT", "Shiba Inu"], ["LDOUSDT", "Lido DAO"],
  ["ICPUSDT", "Internet Computer"], ["GALAUSDT", "Gala"], ["SANDUSDT", "The Sandbox"], ["MANAUSDT", "Decentraland"],
  ["AXSUSDT", "Axie Infinity"], ["GRTUSDT", "The Graph"], ["RUNEUSDT", "THORChain"], ["THETAUSDT", "Theta"],
  ["CHZUSDT", "Chiliz"], ["ENJUSDT", "Enjin"], ["CRVUSDT", "Curve DAO"], ["MKRUSDT", "Maker"],
  ["SNXUSDT", "Synthetix"], ["COMPUSDT", "Compound"], ["KSMUSDT", "Kusama"], ["ZECUSDT", "Zcash"],
  ["XTZUSDT", "Tezos"], ["IOTAUSDT", "IOTA"],
];

const FOREX: [string, string][] = [
  ["EURUSD", "Euro / Dólar"], ["GBPUSD", "Libra / Dólar"], ["USDJPY", "Dólar / Iene"],
  ["USDCHF", "Dólar / Franco"], ["AUDUSD", "Dólar Australiano"], ["USDCAD", "Dólar Canadense"],
  ["NZDUSD", "Dólar Neozelandês"], ["EURGBP", "Euro / Libra"], ["EURJPY", "Euro / Iene"],
  ["GBPJPY", "Libra / Iene"], ["USDBRL", "Dólar / Real"], ["EURBRL", "Euro / Real"],
  ["EURCHF", "Euro / Franco"], ["EURAUD", "Euro / Dólar Australiano"], ["EURCAD", "Euro / Dólar Canadense"],
  ["GBPCHF", "Libra / Franco"], ["GBPAUD", "Libra / Dólar Australiano"], ["AUDJPY", "Dólar Australiano / Iene"],
  ["AUDNZD", "Dólar Australiano / Neozelandês"], ["CADJPY", "Dólar Canadense / Iene"], ["CHFJPY", "Franco / Iene"],
  ["NZDJPY", "Dólar Neozelandês / Iene"], ["USDMXN", "Dólar / Peso Mexicano"], ["USDZAR", "Dólar / Rand"],
  ["USDSEK", "Dólar / Coroa Sueca"],
];

const COMMODITIES: [string, string][] = [
  ["XAUUSD", "Ouro"], ["XAGUSD", "Prata"], ["WTIUSD", "Petróleo WTI"], ["BRENTUSD", "Petróleo Brent"], ["NATGAS", "Gás Natural"],
  ["COPPER", "Cobre"], ["XPTUSD", "Platina"], ["XPDUSD", "Paládio"], ["CORN", "Milho"],
  ["WHEAT", "Trigo"], ["SOYBEAN", "Soja"], ["COFFEE", "Café"],
];

const INDICES: [string, string][] = [
  ["SPX", "S&P 500"], ["NDX", "Nasdaq 100"], ["DJI", "Dow Jones"], ["IXIC", "Nasdaq Composite"], ["VIX", "VIX"], ["RUT", "Russell 2000"],
  ["FTSE", "FTSE 100 (Reino Unido)"], ["NIKKEI", "Nikkei 225 (Japão)"],
  ["HSI", "Hang Seng (Hong Kong)"], ["STOXX50", "Euro Stoxx 50"], ["IBOV", "Ibovespa (Brasil)"], ["SPTSX", "S&P/TSX (Canadá)"],
  ["ASX200", "ASX 200 (Austrália)"],
];

const STOCKS: [string, string][] = [
  ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["NVDA", "NVIDIA"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"],
  ["META", "Meta"], ["TSLA", "Tesla"], ["NFLX", "Netflix"], ["AMD", "AMD"], ["INTC", "Intel"],
  ["JPM", "JPMorgan"], ["V", "Visa"], ["MA", "Mastercard"], ["DIS", "Disney"], ["KO", "Coca-Cola"],
  ["PEP", "PepsiCo"], ["NKE", "Nike"], ["BA", "Boeing"], ["XOM", "ExxonMobil"], ["CVX", "Chevron"],
  ["WMT", "Walmart"], ["PYPL", "PayPal"], ["BABA", "Alibaba"], ["ORCL", "Oracle"], ["CRM", "Salesforce"], ["ADBE", "Adobe"],
  ["AVGO", "Broadcom"], ["COST", "Costco"], ["MCD", "McDonald's"], ["CSCO", "Cisco"], ["QCOM", "Qualcomm"],
  ["TXN", "Texas Instruments"], ["IBM", "IBM"], ["GE", "General Electric"], ["GS", "Goldman Sachs"], ["BAC", "Bank of America"],
  ["PFE", "Pfizer"], ["JNJ", "Johnson & Johnson"], ["UNH", "UnitedHealth"], ["HD", "Home Depot"], ["SBUX", "Starbucks"],
];

function build(pairs: [string, string][], assetType: AssetType): CatalogAsset[] {
  return pairs.map(([symbol, name]) => ({ symbol, name, assetType }));
}

export const CATALOG: CatalogAsset[] = [
  ...build(CRYPTO, "crypto"),
  ...build(FOREX, "forex"),
  ...build(COMMODITIES, "commodities"),
  ...build(INDICES, "indices"),
  ...build(STOCKS, "stocks"),
];

export const ASSET_CLASS_PT: Record<AssetType, string> = {
  crypto: "Cripto",
  forex: "Forex",
  commodities: "Commodities",
  indices: "Índices",
  stocks: "Ações",
};

/** Tickers padrão do dashboard (1 por classe, 6 caixas). */
export const DEFAULT_TICKERS: string[] = ["BTCUSDT", "ETHUSDT", "EURUSD", "XAUUSD", "SPX", "AAPL"];

export function findAsset(symbol: string): CatalogAsset | undefined {
  const s = symbol.toUpperCase();
  return CATALOG.find((a) => a.symbol === s);
}

export function catalogByClass(): Record<AssetType, CatalogAsset[]> {
  const out: Record<AssetType, CatalogAsset[]> = { crypto: [], forex: [], commodities: [], indices: [], stocks: [] };
  for (const a of CATALOG) out[a.assetType].push(a);
  return out;
}

export interface Quote {
  symbol: string;
  name?: string;
  assetType?: AssetType;
  price?: number;
  changePct?: number;
  error?: string;
}
