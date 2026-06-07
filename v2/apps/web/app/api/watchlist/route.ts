/**
 * Watchlist do usuário (tabela `watchlist`, RLS por dono via SSR client).
 *   GET    → lista os itens do usuário
 *   POST   → adiciona/atualiza (upsert por user+symbol+timeframe)
 *   DELETE ?id= → remove um item do usuário
 * Anônimo: GET retorna vazio; POST/DELETE → 401.
 */
import { NextResponse } from "next/server";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { getCurrentUser } from "@/lib/supabase/auth";
import { watchlistCreateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ items: [] });
  const sb = await supabaseServerSSR();
  const { data, error } = await sb
    .from("watchlist")
    .select("id,symbol,timeframe,min_signal_strength,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error || !data) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: data });
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
  const { error } = await sb.from("watchlist").upsert(
    {
      user_id: user.id,
      symbol: parsed.data.symbol,
      timeframe: parsed.data.timeframe,
      min_signal_strength: parsed.data.min_signal_strength,
      side,
    },
    { onConflict: "user_id,symbol,timeframe,side" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
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
