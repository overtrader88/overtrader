/**
 * Webhook de pagamento da Hubla (Fase F3). Verifica a assinatura, normaliza o
 * evento e aplica no banco (promove/rebaixa plano, idempotente).
 *
 * Segurança: lê o CORPO CRU (req.text) — não re-serializa — para validar o HMAC
 * byte-a-byte. Protegido por HUBLA_WEBHOOK_SECRET (não por rate-limit por IP).
 * Responde 200 em tudo que foi tratado/ignorado (senão a Hubla re-tenta); 401
 * só quando a assinatura falha; 503 se o webhook não está configurado.
 */
import { NextResponse } from "next/server";
import { getProvider, applyBillingEvent } from "@/lib/billing";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.HUBLA_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });

  const provider = getProvider("hubla");
  if (!provider) return NextResponse.json({ error: "Provedor desconhecido." }, { status: 500 });

  const rawBody = await req.text();
  if (!provider.verify(rawBody, req.headers, secret)) {
    return NextResponse.json({ ok: false, error: "assinatura inválida" }, { status: 401 });
  }

  const event = provider.parse(rawBody);
  if (!event) return NextResponse.json({ ok: true, ignored: true });

  const sb = supabaseService();
  if (!sb) return NextResponse.json({ ok: false, error: "Supabase indisponível" }, { status: 503 });

  const status = await applyBillingEvent(sb, event);
  // Sempre 200 — o resultado vai no corpo (e em audit_log). Evita re-tentativa em
  // casos terminais (user_not_found/duplicate). Erro transitório: a Hubla re-tenta
  // e a idempotência cuida do resto.
  return NextResponse.json({ ok: true, status, action: event.action });
}
