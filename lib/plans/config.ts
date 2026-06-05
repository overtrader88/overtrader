/**
 * Configuracao dos planos — versao 2 (mensal + anual).
 *
 * Mantemos em TS (nao no DB) para:
 *   - Ficar versionado no git
 *   - Mudanca de pricing exige PR/deploy (audit)
 *   - Tipagem forte em todo o app
 *
 * Modelo de creditos:
 *   - Free: 3 creditos PRO VITALICIOS (one-time no signup, nao renovam)
 *   - PRO mensal: 75 creditos/mes
 *   - PRO anual: 900 creditos/ano (= 75/mes mas paga 10 meses)
 *   - PRO+ mensal: 90 creditos/mes
 *   - PRO+ anual: 1080 creditos/ano (= 90/mes mas paga ~9.5 meses)
 *
 * 1 credito = 1 analise (independente do mercado: cripto, forex, acoes, etc).
 */

export type PlanTier = "free" | "pro" | "pro_plus";
export type BillingPeriod = "monthly" | "annual";

/** Configuracao de pricing por periodo (mensal ou anual) */
export interface PricingTier {
  /** Preco TOTAL cobrado (em centavos) no momento da assinatura */
  totalPriceCents: number;
  /** Preco equivalente mensal pra exibicao (ex: "R$ 50/mes" no plano anual) */
  monthlyEquivalentCents: number;
  /** Total de creditos liberados no periodo */
  credits: number;
  /** Duracao em dias (30 ou 365) */
  durationDays: number;
  /** URL de checkout HUBLA pra esse periodo (env var) */
  checkoutUrlEnvKey: string;
  /** ID do produto no HUBLA (env var) — usado pra mapear webhook */
  productIdEnvKey: string;
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  tagline: string;
  /** Pricing mensal (nao definido pra Free) */
  monthly?: PricingTier;
  /** Pricing anual (nao definido pra Free) */
  annual?: PricingTier;
  /** Creditos vitalicios concedidos uma unica vez (apenas Free) */
  oneTimeCredits?: number;
  features: Array<{
    label: string;
    included: boolean;
    detail?: string;
  }>;
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
      { label: "20 indicadores técnicos + 8 filtros de qualidade", included: true },
      {
        label: "Dashboard ao vivo de 5 mercados (que ninguém oferece)",
        included: true,
        detail: "Cripto, Forex, Commodities, Ações e Índices em tempo real",
      },
      { label: "Gráfico TradingView profissional", included: true },
      { label: "Histórico completo das suas análises", included: true },
      {
        label: "IA narrativa (GPT-4o-mini)",
        included: false,
        detail: "Disponível no PRO — narra cada sinal em português",
      },
      {
        label: "Backtest comparativo (3 estratégias de saída)",
        included: false,
        detail: "Disponível no PRO — prova histórica de cada sinal",
      },
      {
        label: "Smart Money + Multi-TF + Monte Carlo + Harmônicos",
        included: false,
        detail: "Análises institucionais disponíveis no PRO",
      },
      {
        label: "143 ativos em 5 mercados",
        included: false,
        detail: "Cripto exclusivo no Free. Multi-mercado no PRO+",
      },
    ],
  },

  pro: {
    id: "pro",
    name: "PRO",
    tagline: "Trader serio multi-mercado",
    highlighted: true,
    order: 2,
    monthly: {
      totalPriceCents: 5900, // R$ 59
      monthlyEquivalentCents: 5900,
      credits: 75,
      durationDays: 30,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_MONTHLY",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_MONTHLY",
    },
    annual: {
      totalPriceCents: 60000, // R$ 600
      monthlyEquivalentCents: 5000, // R$ 50/mes
      credits: 900,
      durationDays: 365,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_ANNUAL",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_ANNUAL",
    },
    features: [
      // Linha "X analises/mes" e dinamica — renderizada no PlanCard com base
      // no periodo selecionado.
      {
        label: "143 ativos em 5 mercados",
        included: true,
        detail: "Cripto, Forex, Commodities, Ações e Índices",
      },
      {
        label: "IA narrativa explicando cada sinal",
        included: true,
        detail: "GPT-4o-mini escreve em PT-BR como um analista profissional",
      },
      {
        label: "Backtest público (3 estratégias comparadas)",
        included: true,
        detail: "Exit-TP1 · Move-to-BE · Saída Parcial — você escolhe qual usar",
      },
      {
        label: "Smart Money Concepts (Order Blocks, FVG, Liquidez)",
        included: true,
        detail: "Análise institucional usada por bancos e hedge funds",
      },
      {
        label: "Confluência Multi-Timeframe",
        included: true,
        detail: "Alinhamento entre 1h, 4h e D1 — confirma o sinal",
      },
      {
        label: "Monte Carlo (5.000 simulações)",
        included: true,
        detail: "Cenários otimista, mediana e pessimista",
      },
      {
        label: "Padrões Harmônicos + WEGD + Sazonalidade",
        included: true,
        detail: "Bat, Butterfly, Wyckoff, Elliott, Gann, Dow",
      },
      {
        label: "Banner de qualidade automático",
        included: true,
        detail: "Verde/Amarelo/Vermelho avisa se vale operar",
      },
      {
        label: "Contexto macro com notícias + sentimento (IA)",
        included: true,
      },
      { label: "Histórico ilimitado", included: true },
      {
        label: "Alertas Telegram em tempo real",
        included: false,
        detail: "Disponível no PRO+",
      },
      {
        label: "Watchlist ilimitada",
        included: false,
        detail: "Disponível no PRO+",
      },
    ],
  },

  pro_plus: {
    id: "pro_plus",
    name: "PRO+",
    tagline: "Alertas + monitoramento total",
    order: 3,
    monthly: {
      totalPriceCents: 9900, // R$ 99
      monthlyEquivalentCents: 9900,
      credits: 90,
      durationDays: 30,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_PLUS_MONTHLY",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_PLUS_MONTHLY",
    },
    annual: {
      totalPriceCents: 93600, // R$ 936
      monthlyEquivalentCents: 7800, // R$ 78/mes
      credits: 1080,
      durationDays: 365,
      checkoutUrlEnvKey: "HUBLA_CHECKOUT_URL_PRO_PLUS_ANNUAL",
      productIdEnvKey: "HUBLA_PRODUCT_PRO_PLUS_ANNUAL",
    },
    features: [
      // Linha "X analises/mes" e dinamica — renderizada no PlanCard.
      { label: "Tudo do PRO + recursos exclusivos", included: true },
      {
        label: "Alertas Telegram em tempo real",
        included: true,
        detail: "Bot envia sinais STRONG_BUY/SELL no seu chat",
      },
      {
        label: "Watchlist ilimitada com auto-monitor 24/7",
        included: true,
        detail: "Sistema verifica a cada 15 min e te avisa quando algo aparecer",
      },
      {
        label: "Bot Telegram interativo (consulta sem abrir o site)",
        included: true,
        detail: "/btc 1h · /eth 4h · /xau 1d — análise direto no chat",
      },
      {
        label: "Notificações in-app prioritárias",
        included: true,
      },
      {
        label: "Suporte prioritário via Telegram",
        included: true,
        detail: "Resposta em até 24h úteis",
      },
      {
        label: "Acesso antecipado a novos recursos",
        included: true,
        detail: "Beta tester de tudo que vamos lançar",
      },
    ],
  },
};

export const PLANS_ORDERED: PlanConfig[] = Object.values(PLANS).sort(
  (a, b) => a.order - b.order
);

/**
 * Formata centavos como BRL (R$ 59,00)
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return "Grátis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Pega URL de checkout HUBLA pra um plano + periodo. Null se nao configurada.
 */
export function getCheckoutUrl(
  plan: PlanConfig,
  period: BillingPeriod
): string | null {
  const tier = period === "annual" ? plan.annual : plan.monthly;
  if (!tier) return null;
  return process.env[tier.checkoutUrlEnvKey] ?? null;
}

/**
 * Calcula o % de desconto do anual vs mensal pra exibir "Economize X%"
 */
export function annualDiscountPercent(plan: PlanConfig): number {
  if (!plan.monthly || !plan.annual) return 0;
  const monthly12 = plan.monthly.monthlyEquivalentCents * 12;
  const annual = plan.annual.totalPriceCents;
  if (monthly12 === 0) return 0;
  return Math.round(((monthly12 - annual) / monthly12) * 100);
}

/**
 * O plano tem acesso a IA generativa?
 */
export function planHasAi(plan: PlanTier): boolean {
  return plan === "pro" || plan === "pro_plus";
}

/**
 * O plano tem alertas Telegram?
 */
export function planHasTelegram(plan: PlanTier): boolean {
  return plan === "pro_plus";
}

/**
 * O plano tem acesso a mercados nao-cripto?
 */
export function planHasMultiMarket(plan: PlanTier): boolean {
  return plan === "pro" || plan === "pro_plus";
}
