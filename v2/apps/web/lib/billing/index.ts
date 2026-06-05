/**
 * Registry de provedores de billing (Fase F3). Adicionar Kiwify/Asaas depois =
 * implementar BillingProvider e registrar aqui.
 */
import type { BillingProvider } from "./types";
import { hublaProvider } from "./hubla";

const PROVIDERS: Record<string, BillingProvider> = {
  hubla: hublaProvider,
};

export function getProvider(name: string): BillingProvider | null {
  return PROVIDERS[name] ?? null;
}

export type { BillingProvider, BillingEvent, PlanTier, BillingPeriod } from "./types";
export { applyBillingEvent, type ApplyStatus } from "./apply";
