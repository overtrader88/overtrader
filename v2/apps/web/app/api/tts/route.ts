/**
 * POST /api/tts — voz NATURAL via OpenAI TTS (opcional). Recebe { text } e
 * devolve áudio MP3. Rate-limited (custo). Sem OPENAI_API_KEY → 503 (o front
 * cai pra voz do navegador, grátis). Texto limitado p/ conter custo.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 900;

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "tts", 20);
  if (limited) return limited;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voz premium não configurada." }, { status: 503 });

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const text = (body.text ?? "").slice(0, MAX_CHARS);
  if (!text.trim()) return NextResponse.json({ error: "Texto vazio." }, { status: 400 });

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: "onyx", input: text, response_format: "mp3", speed: 1.05 }),
    });
    if (!res.ok) return NextResponse.json({ error: "Falha na geração de voz." }, { status: 502 });
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Falha na geração de voz." }, { status: 502 });
  }
}
