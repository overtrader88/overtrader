/**
 * POST /api/waitlist
 * Cadastra um lead na lista de espera.
 *
 * Body: { name?: string, email: string, utm_source?, utm_medium?, utm_campaign?, referrer? }
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";

const schema = z.object({
  name: z.string().min(2).max(80).optional().or(z.literal("")),
  email: z.string().email().toLowerCase(),
  utm_source: z.string().nullable().optional(),
  utm_medium: z.string().nullable().optional(),
  utm_campaign: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
});

// Rate limit: 5 requests por IP por minuto (best-effort em memória)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function rateLimit(ip: string) {
  const now = Date.now();
  const current = rateLimitStore.get(ip);
  if (!current || current.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count++;
  return { ok: true };
}

export async function POST(req: Request) {
  // 1. IP & rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns segundos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  // 2. Parse body
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, utm_source, utm_medium, utm_campaign, referrer } =
    parsed.data;

  // Hash do IP para LGPD (não armazenamos IP cru)
  const ipHash = crypto
    .createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "tradeai"))
    .digest("hex")
    .slice(0, 32);

  // 3. Persiste
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("waitlist").insert({
      email,
      name: name || null,
      source: "landing",
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer: referrer || null,
      ip_hash: ipHash,
    });

    if (error) {
      // Violação de UNIQUE -> email já cadastrado
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: true, message: "Você já está na lista! Obrigado." },
          { status: 200 }
        );
      }
      console.error("[waitlist] insert error:", error);
      return NextResponse.json(
        { error: "Erro ao salvar. Tente novamente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Cadastro realizado." }, { status: 201 });
  } catch (err) {
    console.error("[waitlist] unexpected error:", err);
    return NextResponse.json(
      { error: "Erro inesperado no servidor." },
      { status: 500 }
    );
  }
}
