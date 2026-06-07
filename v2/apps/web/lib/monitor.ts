/**
 * Ativação do Monitor ao vivo (server-only). Exclusivo PRO/PRO+: ativar custa
 * 20 créditos e libera 5 dias de uso; expirou → reativar por mais 20.
 * Débito atômico via RPC `consume_credits` (service-role).
 */
import { supabaseServerSSR } from "./supabase/server-ssr";
import { supabaseService } from "./supabase/server";

const WINDOW_MS = 5 * 24 * 60 * 60 * 1000; // 5 dias
const COST = 20;

export interface MonitorStatus {
  active: boolean;
  expiresAt: string | null;
}

/** Lê a ativação vigente do usuário (janela com expires_at no futuro). */
export async function getMonitorStatus(userId: string): Promise<MonitorStatus> {
  const sb = await supabaseServerSSR();
  const { data } = await sb
    .from("monitor_activations")
    .select("expires_at")
    .eq("user_id", userId)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expiresAt = (data as { expires_at?: string } | null)?.expires_at ?? null;
  const active = !!expiresAt && new Date(expiresAt).getTime() > Date.now();
  return { active, expiresAt: active ? expiresAt : null };
}

export type ActivateResult =
  | { ok: true; expiresAt: string; remaining: number }
  | { ok: false; reason: "plan" | "already_active" | "no_credits" | "error"; expiresAt?: string };

/** Ativa o monitor: gate PRO/PRO+, cobra 20 créditos, abre janela de 5 dias. */
export async function activateMonitor(userId: string, plan: string): Promise<ActivateResult> {
  if (plan !== "pro" && plan !== "pro_plus") return { ok: false, reason: "plan" };

  const status = await getMonitorStatus(userId);
  if (status.active) return { ok: false, reason: "already_active", expiresAt: status.expiresAt! };

  const svc = supabaseService();
  if (!svc) return { ok: false, reason: "error" };

  const { data: remaining, error } = await svc.rpc("consume_credits", {
    p_user_id: userId, p_amount: COST, p_source: "monitor_activation", p_metadata: { days: 5 },
  });
  if (error) return { ok: false, reason: "no_credits" }; // consume_credits lança se saldo < 20

  const expiresAt = new Date(Date.now() + WINDOW_MS).toISOString();
  const { error: insErr } = await svc.from("monitor_activations").insert({ user_id: userId, expires_at: expiresAt, credits: COST });
  if (insErr) return { ok: false, reason: "error" };

  return { ok: true, expiresAt, remaining: remaining as number };
}
