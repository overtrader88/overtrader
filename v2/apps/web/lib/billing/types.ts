/**
 * Billing agnóstico de provedor (Fase F3). A ideia: cada provedor (Hubla,
 * Kiwify, Asaas…) implementa `BillingProvider` — verifica a autenticidade do
 * webhook e normaliza o payload num `BillingEvent`. O resto do sistema
 * (apply → RPCs Supabase) não sabe qual provedor é. Trocar de gateway = trocar
 * 1 implementação, sem mexer no fluxo.
 */
export type PlanTier = "free" | "pro" | "pro_plus";
export type BillingPeriod = "monthly" | "annual";
export type BillingAction = "activate" | "deactivate";

/** Evento de cobrança já normalizado, pronto pra aplicar no banco. */
export interface BillingEvent {
  action: BillingAction;
  /** ID único do evento no provedor — chave de idempotência (dedupe de retry). */
  providerEventId: string;
  /** E-mail do comprador — resolvemos o user por aqui. */
  email: string;
  /** Plano alvo (para activate; deactivate sempre rebaixa para 'free'). */
  plan: PlanTier;
  period: BillingPeriod;
  /** Fim do período em ISO; null → o RPC calcula (mês/ano a partir de agora). */
  periodEnd: string | null;
}

export interface BillingProvider {
  readonly name: string;
  /**
   * Confere a autenticidade do webhook a partir do CORPO CRU (string, não
   * re-serializado) + headers + segredo. Retorna true se legítimo.
   */
  verify(rawBody: string, headers: Headers, secret: string): boolean;
  /**
   * Normaliza o payload do provedor → BillingEvent. Retorna null para eventos
   * que devemos ignorar (tipo não mapeado, sem e-mail, produto desconhecido).
   */
  parse(rawBody: string): BillingEvent | null;
}
