/**
 * POST /api/admin/credit
 *
 * Endpoint admin pra creditar PRO/Simples manualmente.
 * Gate por email via ADMIN_EMAILS no .env.
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/auth/admin";

interface Body {
  targetEmail?: string;
  creditsPro?: number;
  creditsSimple?: number;
  reason?: string;
  /** Se preenchido, ativa subscription do plano informado */
  activatePlan?: "pro" | "pro_plus" | null;
  /** Periodo de cobranca: mensal (30 dias) ou anual (365 dias). Default monthly */
  billingPeriod?: "monthly" | "annual";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const email = body.targetEmail?.trim().toLowerCase();
  const cPro = Number(body.creditsPro ?? 0);
  const cSimple = Number(body.creditsSimple ?? 0);
  const reason = body.reason?.trim() || "admin-manual";

  if (!email) {
    return NextResponse.json({ error: "Email obrigatorio" }, { status: 400 });
  }
  if (cPro < 0 || cSimple < 0 || cPro > 10000 || cSimple > 10000) {
    return NextResponse.json(
      { error: "Valores fora do range (0-10000)" },
      { status: 400 }
    );
  }
  if (cPro === 0 && cSimple === 0 && !body.activatePlan) {
    return NextResponse.json(
      { error: "Informe pelo menos um credito ou plano" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Resolve user_id
  const { data: targetUserId, error: resolveErr } = await service.rpc(
    "get_user_id_by_email",
    { p_email: email }
  );

  console.log("[admin/credit] resolve email:", { email, targetUserId, err: resolveErr });

  if (resolveErr) {
    return NextResponse.json(
      {
        error: "Falha ao resolver email",
        detail: resolveErr.message,
      },
      { status: 500 }
    );
  }

  if (!targetUserId || typeof targetUserId !== "string") {
    return NextResponse.json(
      { error: `Usuario nao encontrado: ${email}` },
      { status: 404 }
    );
  }

  // Se ativatePlan, usa activate_subscription (subscription + creditos juntos)
  if (body.activatePlan) {
    const period = body.billingPeriod === "annual" ? "annual" : "monthly";
    const days = period === "annual" ? 365 : 30;

    const actArgs = {
      p_user_id: targetUserId,
      p_plan: body.activatePlan,
      p_credits_pro: cPro,
      p_credits_simple: cSimple,
      p_period_days: days,
      p_external_id: `manual-${Date.now()}-${targetUserId.slice(0, 8)}`,
      p_source: "manual-admin",
      p_metadata: { reason, by: user.email, period },
      p_billing_period: period,
    };

    console.log("[admin/credit] chamando activate_subscription:", actArgs);

    const { data, error } = await service.rpc("activate_subscription", actArgs);

    if (error) {
      console.error("[admin/credit] erro do RPC activate_subscription:", error);
      return NextResponse.json(
        {
          error: "Falha ao ativar plano",
          detail: `${error.message ?? "sem mensagem"}${error.hint ? " (hint: " + error.hint + ")" : ""}${error.code ? " [code: " + error.code + "]" : ""}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, action: "subscription_activated", result: data });
  }

  // Caso simples: so credita
  // NOTA: o RPC credit_user usa o parametro p_source (texto livre que vai
  // pro log de auditoria em credit_transactions.source) — nao p_reason.
  // A "razao" informada pelo admin entra como p_source.
  const rpcArgs = {
    p_user_id: targetUserId,
    p_amount_pro: cPro,
    p_amount_simple: cSimple,
    p_source: reason,
    p_type: "bonus",
    p_metadata: { by: user.email },
  };

  console.log("[admin/credit] chamando credit_user:", rpcArgs);

  const { data, error } = await service.rpc("credit_user", rpcArgs);

  if (error) {
    console.error("[admin/credit] erro do RPC credit_user:", error);
    return NextResponse.json(
      {
        error: "Falha ao creditar",
        detail: `${error.message ?? "sem mensagem"}${error.hint ? " (hint: " + error.hint + ")" : ""}${error.code ? " [code: " + error.code + "]" : ""}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, action: "credited", result: data });
}

/**
 * GET — lista os ultimos N usuarios com saldos (debug / admin UI)
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);

  const service = createServiceClient();

  // Query manual via SQL (user_credits join auth.users via id)
  const { data, error } = await service
    .from("user_credits")
    .select(
      `
      user_id,
      credits_pro,
      credits_simple,
      total_used,
      updated_at
    `
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enriquece com email/nome via auth.users (service role bypasses RLS)
  if (!data || data.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const userIds = data.map((row) => row.user_id);
  const { data: usersData } = await service
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const userMap = new Map(
    (usersData ?? []).map((u) => [u.id, u])
  );

  let enriched = data.map((row) => {
    const u = userMap.get(row.user_id);
    return {
      user_id: row.user_id,
      email: u?.email ?? "(sem email)",
      full_name: u?.full_name ?? "",
      credits_pro: row.credits_pro,
      credits_simple: row.credits_simple,
      total_used: row.total_used,
      updated_at: row.updated_at,
    };
  });

  if (search) {
    enriched = enriched.filter(
      (r) =>
        r.email.toLowerCase().includes(search) ||
        r.full_name.toLowerCase().includes(search)
    );
  }

  return NextResponse.json({ users: enriched });
}
