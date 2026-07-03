/**
 * Cota e cobrança do Simulador (server-only). A decisão é pura (quota.ts);
 * aqui vive só o I/O: contar as simulações do dia (RLS: o dono lê), debitar
 * via RPC `consume_credits` (atômica, não negativa saldo) e registrar a
 * simulação na trilha de auditoria. Débito/registro são best-effort no mesmo
 * espírito de lib/credits.ts — sem service-role (dev/CI), não cobra.
 */
import type { AssetType, Timeframe } from "@tradeai/shared";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { supabaseService } from "@/lib/supabase/server";
import { SIMULATOR_CREDIT_COST } from "@/lib/billing-constants";
import { decideSimulatorGate, type SimulatorGate } from "./quota";

export type { SimulatorGate };

/** Início do dia UTC corrente (a cota reseta à meia-noite UTC). */
function utcDayStartISO(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Conta as simulações de hoje + saldo e decide grátis × cobrada × bloqueada. */
export async function checkSimulatorGate(userId: string): Promise<SimulatorGate> {
  const sb = await supabaseServerSSR();
  const [cntRes, credRes] = await Promise.all([
    sb.from("simulations").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", utcDayStartISO()),
    sb.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
  ]);
  // Tabela ausente (migration 0016 não aplicada) → count null → trata como 0
  // (fail-open: a feature degrada pra grátis, nunca quebra).
  const usedToday = cntRes.count ?? 0;
  const balance = (credRes.data?.balance as number | undefined) ?? 0;
  return decideSimulatorGate(usedToday, balance);
}

/** Debita a simulação paga. Retorna o saldo restante, ou null se não cobrou. */
export async function chargeSimulation(
  userId: string,
  metadata: { symbol: string; timeframe: string; date: string },
): Promise<number | null> {
  const svc = supabaseService();
  if (!svc) return null;
  const { data, error } = await svc.rpc("consume_credits", {
    p_user_id: userId, p_amount: SIMULATOR_CREDIT_COST, p_source: "simulator", p_metadata: metadata,
  });
  if (error) return null;
  return data as number;
}

/** Grava a simulação na trilha (cota diária + auditoria). Best-effort. */
export async function recordSimulation(
  userId: string,
  row: {
    symbol: string;
    assetType: AssetType;
    timeframe: Timeframe;
    simDate: string;
    charged: boolean;
    outcome: string | null;
    pnlR: number | null;
  },
): Promise<void> {
  const svc = supabaseService();
  if (!svc) return;
  await svc.from("simulations").insert({
    user_id: userId,
    symbol: row.symbol,
    asset_type: row.assetType,
    timeframe: row.timeframe,
    sim_date: row.simDate,
    charged: row.charged,
    outcome: row.outcome,
    pnl_r: row.pnlR,
  });
}
