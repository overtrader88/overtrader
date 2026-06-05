/**
 * Helper de rate-limit por rota (Fase F1). Aplica o `InMemoryRateLimiter` por
 * (rota × cliente). Retorna uma resposta 429 pronta quando estoura, ou `null`
 * para seguir. Chave do cliente = IP (x-forwarded-for na Vercel) ou "anon".
 *
 * Caveat serverless: o estado é por-instância. Protege contra abuso/burst numa
 * instância; o rate-limit GLOBAL (compartilhado) usa a tabela `rate_limits` no
 * Supabase — TODO de produção (ver PENDENTES). Já corta o pior do abuso.
 */
import { NextResponse } from "next/server";
import { InMemoryRateLimiter } from "./rate-limit";

const limiters = new Map<string, InMemoryRateLimiter>();

function limiterFor(name: string, limit: number, windowMs: number): InMemoryRateLimiter {
  const key = `${name}:${limit}:${windowMs}`;
  let l = limiters.get(key);
  if (!l) {
    l = new InMemoryRateLimiter({ limit, windowMs });
    limiters.set(key, l);
  }
  return l;
}

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anon";
}

/**
 * Aplica o limite. Retorna `NextResponse` 429 (com `Retry-After`) se estourou,
 * ou `null` para o handler prosseguir. `limit` requisições por `windowMs`.
 */
export async function rateLimit(req: Request, name: string, limit: number, windowMs = 60_000): Promise<NextResponse | null> {
  const r = await limiterFor(name, limit, windowMs).check(`${name}:${clientKey(req)}`);
  if (r.allowed) return null;
  const retry = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Muitas requisições — aguarde um instante." },
    { status: 429, headers: { "Retry-After": String(retry) } },
  );
}
