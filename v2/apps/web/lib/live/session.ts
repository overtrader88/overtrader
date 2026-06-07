/**
 * Metering do Live Trading (server-only). Cobra 2 créditos na ativação (1ª hora)
 * e +2 a cada hora cheia enquanto a sessão está ativa. O acerto ("settle") é
 * idempotente por relógio: cobra só as horas ainda não cobradas. Sem saldo →
 * desativa automaticamente. Exclusivo PRO/PRO+.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssetType } from "@tradeai/shared";
import { supabaseServerSSR } from "../supabase/server-ssr";
import { supabaseService } from "../supabase/server";
import { findAsset } from "../market/catalog";
import { marketState } from "../market/hours";

const HOUR_MS = 60 * 60 * 1000;
const COST_PER_HOUR = 2;

export interface LiveSession {
  symbol: string;
  assetType: string;
  activatedAt: string;
  hoursCharged: number;
}

interface Row { id: string; user_id: string; symbol: string; asset_type: string; activated_at: string; hours_charged: number; }

/** Cobra as horas cheias ainda não cobradas. Desativa se faltar saldo. */
async function settle(svc: SupabaseClient, row: Row, now: number): Promise<{ active: boolean; hoursCharged: number }> {
  const elapsedHours = Math.floor((now - new Date(row.activated_at).getTime()) / HOUR_MS);
  const target = 1 + elapsedHours; // 1ª hora paga na ativação
  let charged = row.hours_charged;
  while (charged < target) {
    const { error } = await svc.rpc("consume_credits", {
      p_user_id: row.user_id, p_amount: COST_PER_HOUR, p_source: "live_trading", p_metadata: { symbol: row.symbol, hour: charged + 1 },
    });
    if (error) {
      // sem saldo → desativa
      await svc.from("live_sessions").update({ active: false, deactivated_at: new Date(now).toISOString(), reason: "no_credits", hours_charged: charged }).eq("id", row.id);
      return { active: false, hoursCharged: charged };
    }
    charged++;
  }
  if (charged !== row.hours_charged) {
    await svc.from("live_sessions").update({ hours_charged: charged }).eq("id", row.id);
  }
  return { active: true, hoursCharged: charged };
}

export type ActivateLive =
  | { ok: true; remaining: number }
  | { ok: false; reason: "plan" | "market_closed" | "already_active" | "no_credits" | "unknown_symbol" | "error" };

export async function activateLive(userId: string, plan: string, symbol: string): Promise<ActivateLive> {
  if (plan !== "pro" && plan !== "pro_plus") return { ok: false, reason: "plan" };
  const asset = findAsset(symbol);
  if (!asset) return { ok: false, reason: "unknown_symbol" };
  if (!marketState(asset.assetType as AssetType, new Date()).open) return { ok: false, reason: "market_closed" };

  const svc = supabaseService();
  if (!svc) return { ok: false, reason: "error" };

  // já ativa?
  const { data: existing } = await svc.from("live_sessions").select("id").eq("user_id", userId).eq("symbol", asset.symbol).eq("active", true).maybeSingle();
  if (existing) return { ok: false, reason: "already_active" };

  // cobra a 1ª hora
  const { data: remaining, error } = await svc.rpc("consume_credits", {
    p_user_id: userId, p_amount: COST_PER_HOUR, p_source: "live_trading", p_metadata: { symbol: asset.symbol, hour: 1 },
  });
  if (error) return { ok: false, reason: "no_credits" };

  const { error: insErr } = await svc.from("live_sessions").insert({
    user_id: userId, symbol: asset.symbol, asset_type: asset.assetType, active: true, hours_charged: 1,
  });
  if (insErr) return { ok: false, reason: "error" };
  return { ok: true, remaining: remaining as number };
}

/** Desliga a live (acerta as horas pendentes antes). */
export async function deactivateLive(userId: string, symbol: string): Promise<{ ok: boolean }> {
  const svc = supabaseService();
  if (!svc) return { ok: false };
  const { data: row } = await svc.from("live_sessions").select("id,user_id,symbol,asset_type,activated_at,hours_charged").eq("user_id", userId).eq("symbol", symbol.toUpperCase()).eq("active", true).maybeSingle();
  if (row) {
    await settle(svc, row as Row, Date.now());
    await svc.from("live_sessions").update({ active: false, deactivated_at: new Date().toISOString(), reason: "user" }).eq("id", (row as Row).id);
  }
  return { ok: true };
}

/** Lista as sessões ativas do usuário (acerta cada uma no caminho). */
export async function listActiveLive(userId: string): Promise<LiveSession[]> {
  const svc = supabaseService();
  if (!svc) {
    // fallback só-leitura (sem settle) via SSR
    const sb = await supabaseServerSSR();
    const { data } = await sb.from("live_sessions").select("symbol,asset_type,activated_at,hours_charged").eq("user_id", userId).eq("active", true);
    return ((data ?? []) as Row[]).map((r) => ({ symbol: r.symbol, assetType: r.asset_type, activatedAt: r.activated_at, hoursCharged: r.hours_charged }));
  }
  const { data } = await svc.from("live_sessions").select("id,user_id,symbol,asset_type,activated_at,hours_charged").eq("user_id", userId).eq("active", true);
  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const out: LiveSession[] = [];
  for (const r of rows) {
    const s = await settle(svc, r, now);
    if (s.active) out.push({ symbol: r.symbol, assetType: r.asset_type, activatedAt: r.activated_at, hoursCharged: s.hoursCharged });
  }
  return out;
}

/** Cron: acerta TODAS as sessões ativas (cobra horas acumuladas / desativa sem saldo). */
export async function settleAllActive(svc: SupabaseClient): Promise<{ settled: number; deactivated: number }> {
  const { data } = await svc.from("live_sessions").select("id,user_id,symbol,asset_type,activated_at,hours_charged").eq("active", true);
  const rows = (data ?? []) as Row[];
  const now = Date.now();
  let settled = 0, deactivated = 0;
  for (const r of rows) {
    const s = await settle(svc, r, now);
    settled++;
    if (!s.active) deactivated++;
  }
  return { settled, deactivated };
}
