/**
 * POST /api/news — notícias do ativo (World News API) + sentimento agregado
 * (custo zero, dos scores do provedor) + perfis X curados. Sem LLM, sem auth.
 * Sem WORLDNEWS_API_KEY → items vazio, mas ainda devolve os perfis (degrada bem).
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { analyzeInputSchema } from "@/lib/validation/schemas";
import { fetchNews, aggregateSentiment } from "@/lib/news/world-news";
import { fetchNewsData } from "@/lib/news/newsdata";
import { summarizeNewsSentiment } from "@/lib/news/sentiment-llm";
import { CURATED_X_PROFILES } from "@/lib/news/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const limited = await rateLimit(req, "news", 30);
  if (limited) return limited;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const parsed = analyzeInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  const { symbol, assetType } = parsed.data;
  // Provedor selecionável por env; default NewsData.io (melhor cobertura cripto + free).
  const provider = process.env.NEWS_PROVIDER === "worldnews" ? fetchNews : fetchNewsData;
  const items = await provider(symbol, assetType, { limit: 8 });

  // Sentimento via LLM (funciona em qualquer idioma); fallback no agregado dos scores.
  let sentiment = aggregateSentiment(items);
  let summary: string | null = null;
  if (items.length > 0) {
    const llm = await summarizeNewsSentiment(symbol, items);
    if (llm) {
      sentiment = { overall: llm.overall, score: llm.score, scored: items.length, count: items.length };
      summary = llm.summary;
    }
  }

  const profiles = CURATED_X_PROFILES[assetType] ?? [];
  return NextResponse.json({ items, sentiment, summary, profiles });
}
