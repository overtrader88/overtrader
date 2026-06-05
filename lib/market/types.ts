/**
 * Tipos compartilhados de mercado.
 */

export type AssetType = "crypto" | "forex" | "stocks" | "indices" | "commodities";

export type Timeframe = "15m" | "1h" | "4h" | "1d" | "1w" | "1M";

export interface Candle {
  /** Timestamp em ms (UTC, abertura da vela) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Volume; pode ser 0 ou estimado para forex no free tier */
  volume: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  /** Timestamp da cotação em ms */
  timestamp: number;
}

export interface AssetMeta {
  /** Símbolo interno (ex.: BTCUSDT, EURUSD) */
  symbol: string;
  /** Nome amigável (ex.: Bitcoin, Euro / Dólar) */
  name: string;
  /** Categoria */
  type: AssetType;
  /** Símbolo na fonte de dados (Binance, Twelve Data) */
  sourceSymbol: string;
  /** Quantidade de casas decimais para exibição de preço */
  precision: number;
  /** Categoria visual (ex.: 🪙 cripto) */
  emoji?: string;
}
