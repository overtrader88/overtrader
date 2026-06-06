/**
 * GET /api/admin/user/[id] — bundle 360 de um usuário para o painel admin.
 * Gate: ADMIN_EMAILS. Junta profile, saldo, análises recentes, assinaturas,
 * movimentações de crédito, contagem de alertas/watchlist e vínculo Telegram.
 */
import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const me = await getCurrentUser();
  if (!isAdmin(me)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { id } = await params;
  const sb = supabaseService();
  if (!sb) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  const [
    { data: profile },
    { data: credit },
    { data: analyses },
    { data: subs },
    { data: txs },
    { count: alertsCount },
    { count: watchCount },
    { data: tg },
  ] = await Promise.all([
    sb.from("profiles").select("email, full_name, plan, created_at").eq("id", id).maybeSingle(),
    sb.from("user_credits").select("balance").eq("user_id", id).maybeSingle(),
    sb.from("analyses").select("symbol, asset_type, timeframe, signal, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    sb.from("subscriptions").select("plan, period, status, current_period_end, hubla_event_id, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    sb.from("credit_transactions").select("amount, source, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    sb.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("telegram_links").select("chat_id, linked_at").eq("user_id", id).maybeSingle(),
  ]);

  if (!profile) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

  return NextResponse.json({
    profile,
    balance: (credit as { balance: number } | null)?.balance ?? 0,
    analyses: analyses ?? [],
    subscriptions: subs ?? [],
    transactions: txs ?? [],
    alertsCount: alertsCount ?? 0,
    watchlistCount: watchCount ?? 0,
    telegram: tg ?? null,
  });
}
