/**
 * GET    /api/watchlist           Lista watchlist do usuario
 * POST   /api/watchlist           Adiciona um item { asset, timeframe, min_signal_strength? }
 * DELETE /api/watchlist?id=xxx    Remove item por id
 */
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAsset } from "@/lib/market";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("watchlist")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  let body: {
    asset?: string;
    timeframe?: string;
    min_signal_strength?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const asset = body.asset?.toUpperCase().trim();
  const timeframe = body.timeframe;
  const minStrength = body.min_signal_strength ?? "STRONG_BUY";

  if (!asset || !timeframe) {
    return NextResponse.json(
      { error: "asset e timeframe obrigatorios" },
      { status: 400 }
    );
  }

  const meta = getAsset(asset);
  if (!meta) {
    return NextResponse.json(
      { error: `Ativo ${asset} nao esta no catalogo` },
      { status: 400 }
    );
  }

  const validTimeframes = ["15m", "1h", "4h", "1d", "1w", "1M"];
  if (!validTimeframes.includes(timeframe)) {
    return NextResponse.json(
      { error: `Timeframe ${timeframe} invalido` },
      { status: 400 }
    );
  }

  const validStrengths = ["WEAK_BUY", "BUY", "STRONG_BUY"];
  if (!validStrengths.includes(minStrength)) {
    return NextResponse.json(
      { error: "min_signal_strength deve ser WEAK_BUY, BUY ou STRONG_BUY" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("watchlist")
    .insert({
      user_id: user.id,
      asset,
      asset_type: meta.type,
      timeframe,
      min_signal_strength: minStrength,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique violation (ja existe)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `${asset} ${timeframe} ja esta na sua watchlist` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
