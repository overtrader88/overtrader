/**
 * Watchlist do usuário = ALERTAS PAGOS (tabela `watchlist`, RLS por dono via SSR).
 *   GET    → lista os itens do usuário + saldo de créditos
 *   POST   → adiciona/RENOVA um alerta (ativo+TF+lado). Cobra 15 créditos e dá
 *            5 dias de validade quando o alerta é NOVO ou está VENCIDO. Atualizar
 *            um alerta ainda ATIVO (ex.: trocar o limiar) não cobra de novo.
 *   DELETE ?id= → remove um item do usuário
 * Anônimo: GET retorna vazio; POST/DELETE → 401.
 */
import { NextResponse } from "next/server";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { supabaseService } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import { watchlistCreateSchema } from "@/lib/validation/schemas";
import { WATCHLIST_ALERT_COST, WATCHLIST_ALERT_MS } from "@/lib/billing-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [], credits: 0 });
  const sb = await supabaseServerSSR();
  const [{ data }, { data: cred }] = await Promise.all([
    sb.from("watchlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    sb.from("user_credits").select("balance").eq("user_id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({ items: data ?? [], credits: (cred?.balance as number | undefined) ?? user.credits ?? 0 });
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para usar a watchlist." }, { status: 401 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = watchlistCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const sb = await supabaseServerSSR();
  // Lado do gatilho — permite acompanhar compra E venda do mesmo ativo+TF.
  const side = parsed.data.min_signal_strength.includes("SELL") ? "sell" : "buy";
  const { symbol, timeframe } = parsed.data;
  const base = { user_id: user.id, symbol, timeframe, min_signal_strength: parsed.data.min_signal_strength, side };
  const conflict = { onConflict: "user_id,symbol,timeframe,side" };

  // Já existe um alerta p/ esse (ativo, TF, lado)? Vale saber se ainda está ATIVO
  // (legado sem expiração = ativo; com expiração futura = ativo) → não recobra.
  let hasExpiry = true;
  const existingRes = await sb
    .from("watchlist")
    .select("id, expires_at")
    .eq("user_id", user.id).eq("symbol", symbol).eq("timeframe", timeframe).eq("side", side)
    .maybeSingle();
  if (existingRes.error && /expires_at/i.test(existingRes.error.message)) hasExpiry = false;
  const existing = existingRes.data as { id: string; expires_at: string | null } | null;

  const now = Date.now();
  // ATIVO = pago e dentro da validade. expires_at NULL (alerta legado, nunca pago)
  // NÃO conta como ativo → precisa pagar 15 p/ ativar (só recebe quem paga).
  const active = !!existing && existing.expires_at != null && new Date(existing.expires_at).getTime() > now;

  // Cobrança: p/ alerta NOVO, VENCIDO ou LEGADO (não pago), e só quando a coluna já existe (pós-migration).
  let expiresAt: string | null | undefined = hasExpiry ? (existing?.expires_at ?? null) : undefined;
  let charged = false;
  const svc = supabaseService();
  if (hasExpiry && !active) {
    if (svc) {
      const { error: chErr } = await svc.rpc("consume_credits", {
        p_user_id: user.id, p_amount: WATCHLIST_ALERT_COST, p_source: "watchlist_alert",
        p_metadata: { symbol, timeframe, side },
      });
      if (chErr) {
        const insufficient = /insuficient/i.test(chErr.message);
        return NextResponse.json(
          { error: insufficient ? `Créditos insuficientes — cada alerta custa ${WATCHLIST_ALERT_COST} créditos.` : "Falha ao cobrar os créditos." },
          { status: insufficient ? 402 : 500 },
        );
      }
      charged = true;
    }
    expiresAt = new Date(now + WATCHLIST_ALERT_MS).toISOString(); // 5 dias de validade
  }

  // Monta o upsert preservando engine/expires_at quando as colunas existem.
  const extra: Record<string, unknown> = {};
  if (parsed.data.engine) extra.engine = parsed.data.engine;
  if (hasExpiry) extra.expires_at = expiresAt;

  let { error } = await sb.from("watchlist").upsert({ ...base, ...extra }, conflict);
  if (error && /engine/i.test(error.message)) {
    delete extra.engine; // antes da migration 0012 não há coluna `engine`
    ({ error } = await sb.from("watchlist").upsert({ ...base, ...extra }, conflict));
  }
  if (error) {
    // Falhou DEPOIS de cobrar → estorna os créditos (best-effort) p/ não cobrar à toa.
    if (charged && svc) {
      await svc.rpc("credit_user", { p_user_id: user.id, p_amount: WATCHLIST_ALERT_COST, p_source: "watchlist_alert_refund", p_metadata: { symbol, timeframe, side } });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, charged, expiresAt: expiresAt ?? null });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  const sb = await supabaseServerSSR();
  const { error } = await sb.from("watchlist").delete().eq("user_id", user.id).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
