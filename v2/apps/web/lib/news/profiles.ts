/**
 * Perfis X (Twitter) curados por classe de ativo — feature de custo zero (só links).
 * Portado do v1. Mostrados como links no card de notícias; ler tweets via API seria
 * pago, então aqui ficam curadoria + link.
 */
import type { AssetType } from "@tradeai/shared";

export interface XProfile {
  handle: string;
  name: string;
  topic: string;
}

export const CURATED_X_PROFILES: Record<AssetType, XProfile[]> = {
  crypto: [
    { handle: "WClementeIII", name: "Will Clemente", topic: "On-chain BTC" },
    { handle: "CryptoCred", name: "CryptoCred", topic: "Análise técnica" },
    { handle: "TheCryptoLark", name: "Lark Davis", topic: "Notícias cripto" },
    { handle: "Augusto_Backes", name: "Augusto Backes", topic: "Cripto Brasil" },
  ],
  stocks: [
    { handle: "LizAnnSonders", name: "Liz Ann Sonders", topic: "Macro EUA" },
    { handle: "WSJmarkets", name: "WSJ Markets", topic: "Mercados globais" },
    { handle: "Bastter", name: "Bastter", topic: "B3 / longo prazo" },
  ],
  forex: [
    { handle: "LiveSquawk", name: "LiveSquawk", topic: "FX em tempo real" },
    { handle: "DailyFX", name: "DailyFX", topic: "Análise forex" },
    { handle: "ForexLive", name: "ForexLive", topic: "Macro forex" },
  ],
  commodities: [
    { handle: "javierblas", name: "Javier Blas", topic: "Petróleo e energia" },
    { handle: "PeterSchiff", name: "Peter Schiff", topic: "Ouro e prata" },
    { handle: "GoldTelegraph_", name: "Gold Telegraph", topic: "Metais preciosos" },
  ],
  indices: [
    { handle: "lisaabramowicz1", name: "Lisa Abramowicz", topic: "Renda fixa + macro" },
    { handle: "ZH_NewsTraders", name: "ZeroHedge Markets", topic: "Macro global" },
    { handle: "MercadoNomeio", name: "Mercado no Meio", topic: "Ibovespa" },
  ],
};
