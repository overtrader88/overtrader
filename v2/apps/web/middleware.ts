/**
 * Middleware de sessão Supabase: faz refresh dos cookies a cada request e
 * controla o acesso às rotas.
 *
 * DOIS MODOS (chave: NEXT_PUBLIC_SIGNUPS_OPEN):
 *  - PRÉ-LANÇAMENTO (flag != "true", padrão): site fechado — só a allowlist
 *    pública (landing, login, recuperação, legais, callback OAuth) é navegável
 *    sem login. Todo o resto (dashboard, /analise, /ao-vivo, /monitor, /planos…)
 *    redireciona pra /login. Evita a concorrência navegar o produto na validação.
 *  - LANÇADO (flag == "true"): comportamento aberto — só /dashboard, /historico
 *    e /alertas exigem login; /analise e demais voltam a ser públicas
 *    (try-before-signup).
 *
 * Sem env do Supabase (dev/CI), não bloqueia nada.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Dados do usuário — exigem login em QUALQUER modo (pré ou pós-lançamento).
const PROTECTED = ["/dashboard", "/analise", "/ao-vivo", "/monitor", "/track-record", "/historico", "/alertas", "/creditos", "/watchlist"];
// Navegável sem login em QUALQUER modo (marketing + auth + legais).
// Navegável sem login em QUALQUER modo (marketing + auth + legais).
const PUBLIC = new Set(["/", "/login", "/recuperar", "/redefinir-senha", "/termos", "/privacidade"]);
const LAUNCHED = process.env.NEXT_PUBLIC_SIGNUPS_OPEN === "true";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  let res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of toSet) res.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const needsAuth = LAUNCHED
    ? PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))
    : !PUBLIC.has(path); // pré-lançamento: tudo fora da allowlist exige login

  if (needsAuth && !user) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  if (path === "/login" && user) {
    const dash = req.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }
  return res;
}

export const config = {
  // Roda em todas as páginas, exceto assets estáticos, /api e o callback OAuth (/auth).
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-).*)"],
};
