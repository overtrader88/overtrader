import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Consome os pacotes do monorepo direto do TypeScript-fonte (sem build prévio).
  transpilePackages: ["@tradeai/shared", "@tradeai/engine"],
  // Raiz de tracing:
  //  - Na Vercel, o deploy clona a RAIZ do repo (t_a_der = path0) e o app fica em
  //    path0/v2/apps/web. O bundler resolve as funções a partir de path0, então o
  //    tracing root precisa ser a raiz do repo (../../..) — senão o Next gera o
  //    caminho relativo a v2/ e a Vercel procura a função em path0/apps/web (erra o v2/).
  //  - Local: mantém v2/ (evita o Next inferir pelo lockfile do v1).
  outputFileTracingRoot: process.env.VERCEL
    ? path.join(dir, "../../..")
    : path.join(dir, "../.."),
  // Garante que as fontes embutidas do Relatório PDF entrem no bundle serverless.
  outputFileTracingIncludes: {
    "/api/report": ["./lib/report/fonts/**"],
  },
};

export default nextConfig;
