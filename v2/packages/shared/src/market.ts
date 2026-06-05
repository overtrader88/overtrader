/**
 * Tipos de mercado compartilhados (portados do v1, limpos).
 */
import { z } from "zod";

export const ASSET_TYPES = ["crypto", "forex", "stocks", "indices", "commodities"] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const assetTypeSchema = z.enum(ASSET_TYPES);

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
  type: AssetType;
  /** Símbolo na fonte de dados (Binance, Twelve Data) */
  sourceSymbol: string;
  /** Casas decimais para exibição de preço */
  precision: number;
  emoji?: string;
}
