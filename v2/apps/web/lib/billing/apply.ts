/**
 * Aplica um BillingEvent normalizado no banco (Fase F3). Resolve o usuário pelo
 * e-mail (RPC get_user_id_by_email) e chama os RPCs atômicos de assinatura.
 * Service-role (ignora RLS). Best-effort e idempotente — seguro para retries.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingEvent } from "./types";

export type ApplyStatus =
  | "activated"
  | "deactivated"
  | "duplicate"     // evento já processado (idempotência)
  | "user_not_found"
  | "error";

export async function applyBillingEvent(sb: SupabaseClient, event: BillingEvent): Promise<ApplyStatus> {
  try {
    const { data: userId, error: e1 } = await sb.rpc("get_user_id_by_email", { p_email: event.email });
    if (e1) return "error";
    if (!userId) return "user_not_found";

    if (event.action === "deactivate") {
      const { error } = await sb.rpc("deactivate_subscription", {
        p_event_id: event.providerEventId,
        p_user_id: userId,
      });
      return error ? "error" : "deactivated";
    }

    const { data: applied, error } = await sb.rpc("activate_subscription", {
      p_event_id: event.providerEventId,
      p_user_id: userId,
      p_plan: event.plan,
      p_period: event.period,
      p_period_end: event.periodEnd,
    });
    if (error) return "error";
    return applied === false ? "duplicate" : "activated";
  } catch {
    return "error";
  }
}
