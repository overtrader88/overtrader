/**
 * POST /api/webhooks/hubla
 *
 * Webhook receiver para eventos do HUBLA:
 *   - invoice.paid / order.approved -> ativa/renova plano + credita
 *   - subscription.created / subscription.renewed -> idem
 *   - subscription.cancelled -> marca como cancelada (mantem acesso ate fim do periodo)
 *   - refund.processed / chargeback -> revoga acesso imediatamente
 *
 * Seguranca:
 *   - Valida HMAC SHA-256 com HUBLA_WEBHOOK_SECRET
 *   - Aceita apenas POST
 *   - Idempotente via external_id
 *
 * Mapeia email do HUBLA -> user_id do Supabase (auth.users).
 *
 * NOTA: a estrutura exata do payload HUBLA pode variar. Esta implementacao
 * cobre os campos mais comuns (event, data.email, data.product_id, data.id).
 * Ajuste o parsing conforme a documentacao oficial: https://docs.hub.la
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

import { createServiceClient } from "@/lib/supabase/service";
import { PLANS, type PlanTier } from "@/lib/plans/config";

interface HublaEvent {
  /** Tipo do evento. Ex: "invoice.paid", "subscription.cancelled" */
  type?: string;
  event?: string;
  data?: {
    email?: string;
    customer?: { email?: string };
    /** ID do produto/plano no HUBLA — mapeamos via env */
    product_id?: string;
    productId?: string;
    /** ID unico da transacao/subscription */
    id?: string;
    subscription_id?: string;
    /** Status legivel */
    status?: string;
  };
}

/**
 * Mapeia product_id do HUBLA -> plan tier + billing period.
 * 4 produtos: PRO mensal/anual e PRO+ mensal/anual.
 */
function mapProductToPlanAndPeriod(
  productId: string | undefined
): { plan: PlanTier; period: "monthly" | "annual" } | null {
  if (!productId) return null;
  if (productId === process.env.HUBLA_PRODUCT_PRO_MONTHLY)
    return { plan: "pro", period: "monthly" };
  if (productId === process.env.HUBLA_PRODUCT_PRO_ANNUAL)
    return { plan: "pro", period: "annual" };
  if (productId === process.env.HUBLA_PRODUCT_PRO_PLUS_MONTHLY)
    return { plan: "pro_plus", period: "monthly" };
  if (productId === process.env.HUBLA_PRODUCT_PRO_PLUS_ANNUAL)
    return { plan: "pro_plus", period: "annual" };
  return null;
}

/**
 * Valida assinatura HMAC do webhook.
 * HUBLA envia X-Hubla-Signature: sha256=<hex>
 */
function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  // Extrai hex da string "sha256=<hex>" (ou usa direto se ja for hex)
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Identifica o tipo de evento independente do nome do campo
 */
function getEventType(payload: HublaEvent): string {
  return (payload.type ?? payload.event ?? "").toLowerCase();
}

/**
 * Identifica se o evento e de pagamento/renovacao bem-sucedida
 */
function isActivationEvent(eventType: string): boolean {
  return [
    "invoice.paid",
    "order.approved",
    "subscription.created",
    "subscription.renewed",
    "purchase.completed",
    "payment.succeeded",
  ].includes(eventType);
}

/**
 * Identifica se o evento revoga acesso (refund/chargeback)
 */
function isRevocationEvent(eventType: string): boolean {
  return [
    "refund.processed",
    "refund.completed",
    "chargeback",
    "chargeback.created",
    "dispute.created",
  ].includes(eventType);
}

/**
 * Identifica se o evento e cancelamento (mantem ate fim do periodo)
 */
function isCancellationEvent(eventType: string): boolean {
  return [
    "subscription.cancelled",
    "subscription.canceled",
  ].includes(eventType);
}

export async function POST(req: Request) {
  const secret = process.env.HUBLA_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[hubla webhook] HUBLA_WEBHOOK_SECRET nao configurado");
    return NextResponse.json(
      { error: "Webhook nao configurado" },
      { status: 500 }
    );
  }

  // Le raw body antes de parsear pra validar HMAC
  const rawBody = await req.text();
  const signature = req.headers.get("x-hubla-signature") ?? req.headers.get("x-signature");

  if (!isValidSignature(rawBody, signature, secret)) {
    console.warn("[hubla webhook] assinatura invalida");
    return NextResponse.json(
      { error: "Assinatura invalida" },
      { status: 401 }
    );
  }

  // Parse JSON
  let payload: HublaEvent;
  try {
    payload = JSON.parse(rawBody) as HublaEvent;
  } catch {
    return NextResponse.json(
      { error: "JSON invalido" },
      { status: 400 }
    );
  }

  const eventType = getEventType(payload);
  const email =
    payload.data?.email ?? payload.data?.customer?.email ?? null;
  const productId =
    payload.data?.product_id ?? payload.data?.productId ?? null;
  const externalId =
    payload.data?.id ?? payload.data?.subscription_id ?? null;

  if (!email) {
    return NextResponse.json(
      { error: "email ausente no payload" },
      { status: 400 }
    );
  }

  console.log("[hubla webhook]", {
    eventType,
    email,
    productId,
    externalId,
  });

  // Service client (bypass RLS — operacao privilegiada)
  const supabase = createServiceClient();

  // Resolve user_id pelo email
  const { data: userData, error: userErr } = await supabase
    .from("auth.users" as never)
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // Fallback: chama a view nativa do Postgres
  let userId: string | null = null;
  if (userData && typeof userData === "object" && "id" in userData) {
    userId = (userData as { id: string }).id;
  }
  if (!userId) {
    // Usa RPC se a query direta nao funcionar
    const { data: rpcData } = await supabase.rpc(
      "get_user_id_by_email" as never,
      { p_email: email } as never
    );
    if (typeof rpcData === "string") userId = rpcData;
  }

  if (!userId) {
    console.warn("[hubla webhook] email nao encontrado:", email, userErr);
    // Retorna 200 pra HUBLA nao retentar — usuario inexistente, falha logica
    return NextResponse.json(
      { ok: false, reason: "user_not_found", email },
      { status: 200 }
    );
  }

  // === ATIVACAO / RENOVACAO ===
  if (isActivationEvent(eventType)) {
    const mapped = mapProductToPlanAndPeriod(productId ?? undefined);
    if (!mapped) {
      console.warn(
        "[hubla webhook] product_id nao mapeado:",
        productId
      );
      return NextResponse.json(
        { ok: false, reason: "unknown_product", productId },
        { status: 200 }
      );
    }

    const { plan, period } = mapped;
    const planConfig = PLANS[plan];
    const tier = period === "annual" ? planConfig.annual : planConfig.monthly;
    if (!tier) {
      return NextResponse.json(
        { ok: false, reason: "tier_not_configured", plan, period },
        { status: 200 }
      );
    }

    const { error: actErr } = await supabase.rpc("activate_subscription", {
      p_user_id: userId,
      p_plan: plan,
      p_credits_pro: tier.credits,
      p_credits_simple: 0, // modelo novo: so PRO credits
      p_period_days: tier.durationDays,
      p_external_id: externalId,
      p_source: "hubla",
      p_metadata: { event: eventType, period, raw: payload },
      p_billing_period: period,
    });

    if (actErr) {
      console.error("[hubla webhook] activate_subscription error:", actErr);
      return NextResponse.json(
        { error: "Falha ao ativar plano", detail: actErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, action: "activated", plan, period, userId },
      { status: 200 }
    );
  }

  // === CANCELAMENTO ===
  if (isCancellationEvent(eventType)) {
    if (!externalId) {
      return NextResponse.json(
        { ok: false, reason: "external_id_required" },
        { status: 200 }
      );
    }
    await supabase.rpc("cancel_subscription", {
      p_external_id: externalId,
      p_revoke_access: false,
    });
    return NextResponse.json(
      { ok: true, action: "cancelled", externalId },
      { status: 200 }
    );
  }

  // === REVOGACAO (refund / chargeback) ===
  if (isRevocationEvent(eventType)) {
    if (!externalId) {
      return NextResponse.json(
        { ok: false, reason: "external_id_required" },
        { status: 200 }
      );
    }
    await supabase.rpc("cancel_subscription", {
      p_external_id: externalId,
      p_revoke_access: true,
    });
    return NextResponse.json(
      { ok: true, action: "revoked", externalId },
      { status: 200 }
    );
  }

  // Evento desconhecido — loga e retorna 200 pra nao retentar
  console.log("[hubla webhook] evento ignorado:", eventType);
  return NextResponse.json(
    { ok: true, ignored: eventType },
    { status: 200 }
  );
}

// HUBLA pode mandar GET pra validar a URL
export async function GET() {
  return NextResponse.json({ ok: true, webhook: "hubla", version: 1 });
}
