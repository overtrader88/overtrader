/**
 * Consumo de créditos (server-only). A análise completa custa 1 crédito; re-ver
 * a MESMA análise (mesmo ativo/TF) numa janela curta é grátis (dedup), pra um
 * refresh não cobrar de novo. Débito é atômico via RPC `consume_credits` (não
 * deixa o saldo negativar). Vale para todos os planos — o que muda é o saldo.
 */
import { supabaseServerSSR } from "./supabase/server-ssr";
import { supabaseService } from "./supabase/server";

const DEDUP_WINDOW_MS = 10 * 60 * 1000;

export interface AnalysisGate {
  allowed: boolean;     // pode ver a análise?
  needsCharge: boolean; // se permitido, vai debitar 1 crédito?
  balance: number;      // saldo atual
}

/** Decide se a próxima análise cobra e se há saldo. NÃO debita. */
export async function checkAnalysisCredit(userId: string, symbol: string, timeframe: string): Promise<AnalysisGate> {
  const sb = await supabaseServerSSR();
  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const [dupRes, credRes] = await Promise.all([
    sb.from("analyses").select("id").eq("user_id", userId).eq("symbol", symbol).eq("timeframe", timeframe).gte("created_at", since).limit(1).maybeSingle(),
    sb.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
  ]);
  const balance = (credRes.data?.balance as number | undefined) ?? 0;
  if (dupRes.data) return { allowed: true, needsCharge: false, balance }; // re-view grátis
  if (balance < 1) return { allowed: false, needsCharge: true, balance }; // esgotado
  return { allowed: true, needsCharge: true, balance };
}

/** Debita 1 crédito pela análise. Retorna o saldo restante, ou null se falhou. */
export async function chargeAnalysis(userId: string, symbol: string, timeframe: string): Promise<number | null> {
  const svc = supabaseService();
  if (!svc) return null; // sem service-role (dev/CI) → não cobra
  const { data, error } = await svc.rpc("consume_credits", {
    p_user_id: userId, p_amount: 1, p_source: "analysis", p_metadata: { symbol, timeframe },
  });
  if (error) return null;
  return data as number;
}
