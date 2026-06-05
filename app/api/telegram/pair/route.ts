/**
 * POST /api/telegram/pair    Gera um token de pareamento (valido 15min)
 * GET  /api/telegram/pair    Status do vinculo atual (linked ou nao)
 * DELETE                     Desvincula
 */
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isTelegramConfigured } from "@/lib/telegram/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { data: link } = await supabase
    .from("telegram_links")
    .select("chat_id, username, paired_at, pair_token, pair_token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    configured: isTelegramConfigured(),
    linked: link?.paired_at != null,
    chatId: link?.paired_at ? link.chat_id : null,
    username: link?.username ?? null,
    pendingToken: link?.pair_token && !link.paired_at ? link.pair_token : null,
    tokenExpiresAt: link?.pair_token_expires_at ?? null,
  });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "Bot Telegram nao configurado pelo administrador" },
      { status: 503 }
    );
  }

  // Gera token de 32 hex chars
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const service = createServiceClient();

  // Upsert: cria ou atualiza pre-link
  // chat_id e temporario aqui (usa user_id pra ficar unico ate o /start completar)
  const placeholderChatId = `pending-${user.id}`;

  // Remove pre-link pendente anterior, se houver
  await service
    .from("telegram_links")
    .delete()
    .eq("user_id", user.id)
    .is("paired_at", null);

  const { error } = await service.from("telegram_links").insert({
    user_id: user.id,
    chat_id: placeholderChatId,
    pair_token: token,
    pair_token_expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    token,
    expiresAt,
    instructions: `Abra o bot no Telegram e mande: /start ${token}`,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { error } = await supabase
    .from("telegram_links")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
