/**
 * Provedor Hubla (Fase F3). Verifica a assinatura do webhook e normaliza o
 * payload num BillingEvent.
 *
 * ⚠️ CONFIRMAR COM UM EVENTO REAL: o formato exato do payload e o esquema de
 * assinatura da Hubla devem ser conferidos no painel/docs ao cadastrar o
 * webhook. Por isso a extração é DEFENSIVA (tenta vários caminhos) e os tipos
 * de evento ficam em listas fáceis de ajustar. Ver docs/PENDENTES.md.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingPeriod, BillingProvider, PlanTier } from "./types";

/**
 * Classifica o tipo de evento por palavra-chave (PT/EN) — resiliente à string
 * exata do payload da Hubla v2 ("Assinatura ativa", "Solicitação reembolso"…).
 * Desativação é checada ANTES (ex.: "deactivated" contém "activ").
 */
function classifyAction(type: string): "activate" | "deactivate" | null {
  const t = type.toLowerCase();
  if (/refund|reembolso|charge.?back|cancel|expir|inativ|inactiv|desativ|deactivat|removed|revoke/.test(t)) {
    return "deactivate";
  }
  if (/activ|ativ|paid|pago|approv|aprovad|succeed|sucesso|complet|renew|renova|created|criad|\bsale\b/.test(t)) {
    return "activate";
  }
  return null;
}

/** Mapa produto→(plano,período) lido do ambiente. Ajuste os IDs na Hubla. */
function productMap(): { id: string; plan: PlanTier; period: BillingPeriod }[] {
  const e = process.env;
  return [
    { id: e.HUBLA_PRODUCT_PRO_MONTHLY, plan: "pro", period: "monthly" },
    { id: e.HUBLA_PRODUCT_PRO_ANNUAL, plan: "pro", period: "annual" },
    { id: e.HUBLA_PRODUCT_PRO_PLUS_MONTHLY, plan: "pro_plus", period: "monthly" },
    { id: e.HUBLA_PRODUCT_PRO_PLUS_ANNUAL, plan: "pro_plus", period: "annual" },
  ].filter((m): m is { id: string; plan: PlanTier; period: BillingPeriod } => !!m.id);
}

/** Pega o 1º valor string não-vazio entre vários caminhos pontilhados. */
function pick(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path.split(".")) {
      if (cur == null) break;
      cur = (cur as Record<string, unknown>)[key];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return null;
}

const EMAIL_PATHS = [
  "event.user.email", "event.userEmail", "event.customer.email", "event.buyer.email",
  "data.customer.email", "data.user.email", "customer.email", "email",
];
const PRODUCT_PATHS = [
  "event.product.id", "event.productId", "event.product.id", "event.groupId",
  "event.products.0.id", "event.offer.id", "data.product.id", "data.productId",
  "product.id", "productId",
];
const EVENT_ID_PATHS = [
  "event.id", "event.invoiceId", "event.subscriptionId", "data.id", "id", "eventId",
];
const PERIOD_END_PATHS = [
  "event.currentPeriodEnd", "event.expiresAt", "event.endDate",
  "data.currentPeriodEnd", "data.expiresAt",
];

function eventType(payload: Record<string, unknown>): string {
  return (
    pick(payload, [
      "type", "event.type", "eventType", "data.type",
      "event.kind", "kind", "topic", "event", "data.event.type",
    ]) ?? ""
  );
}

export const hublaProvider: BillingProvider = {
  name: "hubla",

  verify(rawBody, headers, secret) {
    // A Hubla autentica por TOKEN ESTÁTICO (painel → Autenticação), enviado no
    // header do webhook. Coletamos os headers prováveis (+ Authorization Bearer)
    // e comparamos timing-safe com o secret. Fallback HMAC por robustez.
    const auth = headers.get("authorization") ?? "";
    const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : auth;
    const candidates = [
      headers.get("x-hubla-token"),
      headers.get("x-hubla-signature"),
      headers.get("x-webhook-signature"),
      headers.get("x-hub-signature-256"),
      bearer || null,
    ].filter((v): v is string => !!v);
    if (candidates.length === 0) return false;

    // 1) Token estático (caso da Hubla).
    for (const c of candidates) if (timingEqual(c, secret)) return true;

    // 2) HMAC-SHA256 hex (com/sem prefixo "sha256=") — fallback.
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
    for (const c of candidates) {
      const provided = c.startsWith("sha256=") ? c.slice(7) : c;
      if (timingEqual(provided, expected)) return true;
    }
    return false;
  },

  parse(rawBody) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const type = eventType(payload);
    const action = classifyAction(type);
    if (!action) return null;

    const email = pick(payload, EMAIL_PATHS);
    if (!email) return null;

    const providerEventId = pick(payload, EVENT_ID_PATHS) ?? `${type}:${email}`;

    if (action === "deactivate") {
      return { action: "deactivate", providerEventId, email, plan: "free", period: "monthly", periodEnd: null };
    }

    // activate → precisa casar o produto com um plano configurado
    const productId = pick(payload, PRODUCT_PATHS);
    const match = productId ? productMap().find((m) => m.id === productId) : undefined;
    if (!match) return null; // produto desconhecido → ignora (não promove plano errado)

    return {
      action: "activate",
      providerEventId,
      email,
      plan: match.plan,
      period: match.period,
      periodEnd: pick(payload, PERIOD_END_PATHS),
    };
  },
};

function timingEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
