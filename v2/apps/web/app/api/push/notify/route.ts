/**
 * Dispara um alerta de "confluência reforçada" para o próprio usuário:
 * registra na tabela `alerts` (sininho do app) e envia Web Push para os
 * dispositivos inscritos. O cliente só chama quando uma confluência REFORÇADA
 * nova aparece (dedupe por chave no cliente); aqui há um guard de tempo simples
 * por (user, symbol, timeframe) para evitar repique em recargas.
 * Requer autenticação. Anônimo → 401.
 */
import { NextResponse } from "next/server";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { getCurrentUser } from "@/lib/supabase/auth";
import { sendPushToUser } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { symbol?: string; timeframe?: string; side?: string; verdict?: string; }
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min por (symbol, timeframe)

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let b: Body;
  try { b = (await req.json()) as Body; } catch { return NextResponse.json({ error: "json inválido" }, { status: 400 }); }
  const symbol = (b.symbol ?? "").toUpperCase();
  const timeframe = b.timeframe ?? "";
  if (!symbol || !timeframe) return NextResponse.json({ error: "dados insuficientes" }, { status: 400 });

  const sb = await supabaseServerSSR();
  const signalLabel = b.side === "sell" ? "VENDA reforçada" : "COMPRA reforçada";
  const message = b.verdict ?? "Confluência reforçada ao vivo";

  // Cooldown: não repetir o mesmo alerta recente do mesmo ativo/TF.
  try {
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data: recent } = await sb.from("alerts")
      .select("id").eq("user_id", user.id).eq("symbol", symbol).eq("timeframe", timeframe)
      .gte("created_at", since).limit(1);
    if (recent && recent.length) return NextResponse.json({ ok: true, deduped: true });
  } catch { /* segue */ }

  try {
    await sb.from("alerts").insert({
      user_id: user.id, symbol, timeframe,
      signal: signalLabel, message: `${symbol} ${timeframe.toUpperCase()} — ${message}`,
    });
  } catch { /* gracioso */ }

  const push = await sendPushToUser(sb, user.id, {
    title: `⚡ ${symbol} ${timeframe.toUpperCase()} — ${signalLabel}`,
    body: message,
    url: "/ao-vivo",
    tag: `cross-${symbol}-${timeframe}`,
  });

  return NextResponse.json({ ok: true, push });
}
