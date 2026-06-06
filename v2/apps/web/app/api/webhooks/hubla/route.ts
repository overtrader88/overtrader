/**
 * Webhook de pagamento da Hubla (Fase F3). Verifica a assinatura, normaliza o
 * evento e aplica no banco (promove/rebaixa plano, idempotente).
 *
 * Segurança em DUAS camadas:
 *  1. HUBLA_WEBHOOK_SECRET — token que a Hubla envia (NÃO rotacionável no painel).
 *  2. HUBLA_URL_SECRET — segredo que NÓS controlamos, exigido como `?k=` na URL do
 *     webhook. Como o token da Hubla não pode ser trocado, essa 2ª camada (que
 *     nunca vazou) garante que só requests com o nosso segredo na URL passem.
 *     Opcional: se HUBLA_URL_SECRET não estiver setado, a checagem é pulada.
 * Lê o CORPO CRU (req.text) — não re-serializa — para validar o token byte-a-byte.
 * Responde 200 no que foi tratado/ignorado (senão a Hubla re-tenta); 401 quando
 * a auth falha; 503 se não configurado.
 */
import { NextResponse } from "next/server";
import { getProvider, applyBillingEvent } from "@/lib/billing";
import { supabaseService } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.HUBLA_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });

  // Camada 2 — segredo nosso na URL (`?k=...`). Independente do token da Hubla.
  const urlSecret = process.env.HUBLA_URL_SECRET;
  if (urlSecret) {
    const k = new URL(req.url).searchParams.get("k") ?? "";
    if (k !== urlSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

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
