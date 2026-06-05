/**
 * Configuração dos planos (mensal + anual). Portada do v1.
 *
 * Mantida em TS (não no DB) para ficar versionada no git — mudança de pricing
 * exige PR/deploy (audit) e tipagem forte em todo o app.
 *
 * Helpers que dependem de env (ex.: getCheckoutUrl) ficam na camada web,
 * não aqui — shared não lê process.env.
 */

export type PlanTier = "free" | "pro" | "pro_plus";
export type BillingPeriod = "monthly" | "annual";

export interface PricingTier {
  /** Preço TOTAL cobrado (em centavos) no momento da assinatura */
  totalPriceCents: number;
  /** Preço equivalente mensal pra exibição (ex.: "R$ 50/mês" no anual) */
  monthlyEquivalentCents: number;
  /** Total de créditos liberados no período */
  credits: number;
  /** Duração em dias (30 ou 365) */
  durationDays: number;
  /** Chave de env com a URL de checkout HUBLA */
  checkoutUrlEnvKey: string;
  /** Chave de env com o ID do produto no HUBLA (mapeia o webhook) */
  productIdEnvKey: string;
}

export interface PlanFeature {
  label: string;
  included: boolean;
  detail?: string;
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  tagline: string;
  monthly?: PricingTier;
  annual?: PricingTier;
  /** Créditos vitalícios concedidos uma única vez (apenas Free) */
  oneTimeCredits?: number;
  features: PlanFeature[];
  highlighted?: boolean;
  order: number;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Experimente o produto",
    oneTimeCredits: 3,
    order: 1,
    features: [
      { label: "3 análises completas — sem expiração", included: true },
      { label: "20 indicadores técnicos + filtros de qualidade", included: true },
      {
        label: "Dashboard ao vivo de 5 mercados",
        included: true,
        detail: "Cripto, Forex, Commodities, Ações e Índices em tempo real",
      },
      { label: "Gráfico TradingView profissional", included: true },
      { label: "Histórico completo das suas análises", included: true },
      { label: "IA narrativa (GPT-4o-mini)", included: false, detail: "Disponível no PRO" },
      { label: "Backtest comparativo", included: false, detail: "Disponível no PRO" },
      { label: "143 ativos em 5 mercados", included: false, detail: "Cripto exclusivo no Free" },
    ],
  },

  pro: {
    id: "pro",
    name: "PRO",
    tagline: "Trader sério multi-mercado",
    highlighted: true,
    order: 2,
    monthly: {
      totalPriceCents: 5900,
      monthlyEquivalentCents: 5900,
      credits: 75,
      durationDays: 30,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_MONTHLY",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_MONTHLY",
    },
    annual: {
      totalPriceCents: 60000,
      monthlyEquivalentCents: 5000,
      credits: 900,
      durationDays: 365,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_ANNUAL",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_ANNUAL",
    },
    features: [
      { label: "143 ativos em 5 mercados", included: true },
      { label: "IA narrativa explicando cada sinal", included: true },
      { label: "Backtest público (3 estratégias comparadas)", included: true },
      { label: "Smart Money Concepts (Order Blocks, FVG, Liquidez)", included: true },
      { label: "Confluência Multi-Timeframe", included: true },
      { label: "Monte Carlo (5.000 simulações)", included: true },
      { label: "Padrões Harmônicos + WEGD + Sazonalidade", included: true },
      { label: "Banner de qualidade automático", included: true },
      { label: "Alertas Telegram em tempo real", included: false, detail: "Disponível no PRO+" },
      { label: "Watchlist ilimitada", included: false, detail: "Disponível no PRO+" },
    ],
  },

  pro_plus: {
    id: "pro_plus",
    name: "PRO+",
    tagline: "Alertas + monitoramento total",
    order: 3,
    monthly: {
      totalPriceCents: 9900,
      monthlyEquivalentCents: 9900,
      credits: 90,
      durationDays: 30,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_PLUS_MONTHLY",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_PLUS_MONTHLY",
    },
    annual: {
      totalPriceCents: 93600,
      monthlyEquivalentCents: 7800,
      credits: 1080,
      durationDays: 365,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_PLUS_ANNUAL",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_PLUS_ANNUAL",
    },
    features: [
      { label: "Tudo do PRO + recursos exclusivos", included: true },
      { label: "Alertas Telegram em tempo real", included: true },
      { label: "Watchlist ilimitada com auto-monitor 24/7", included: true },
      { label: "Bot Telegram interativo", included: true, detail: "/btc 1h · /eth 4h · /xau 1d" },
      { label: "Notificações in-app prioritárias", included: true },
      { label: "Suporte prioritário via Telegram", included: true },
      { label: "Acesso antecipado a novos recursos", included: true },
    ],
  },
};

export const PLANS_ORDERED: PlanConfig[] = Object.values(PLANS).sort(
  (a, b) => a.order - b.order,
);

/** Formata centavos como BRL (locale fixo aqui; a web pode usar i18n). */
export function formatPriceBRL(cents: number): string {
  if (cents === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** % de desconto do anual vs mensal ("Economize X%"). */
export function annualDiscountPercent(plan: PlanConfig): number {
  if (!plan.monthly || !plan.annual) return 0;
  const monthly12 = plan.monthly.monthlyEquivalentCents * 12;
  const annual = plan.annual.totalPriceCents;
  if (monthly12 === 0) return 0;
  return Math.round(((monthly12 - annual) / monthly12) * 100);
}

export function planHasAi(plan: PlanTier): boolean {
  return plan === "pro" || plan === "pro_plus";
}

export function planHasTelegram(plan: PlanTier): boolean {
  return plan === "pro_plus";
}

export function planHasMultiMarket(plan: PlanTier): boolean {
  return plan === "pro" || plan === "pro_plus";
}
