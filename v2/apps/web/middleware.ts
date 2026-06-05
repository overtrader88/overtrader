/**
 * Middleware de sessão Supabase: faz refresh dos cookies a cada request e
 * protege as rotas de dados do usuário. /analise fica PÚBLICA (try-before-signup);
 * /dashboard, /historico e /alertas exigem login.
 *
 * Se o Supabase não estiver configurado (sem env), não bloqueia nada — assim o
 * dev/CI sem `.env` segue funcionando.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/dashboard", "/historico", "/alertas"];

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
  const needsAuth = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

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
  matcher: ["/dashboard/:path*", "/historico/:path*", "/alertas/:path*", "/login"],
};
