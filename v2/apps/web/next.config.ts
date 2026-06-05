import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Consome os pacotes do monorepo direto do TypeScript-fonte (sem build prévio).
  transpilePackages: ["@tradeai/shared", "@tradeai/engine"],
  // Fixa a raiz de tracing no monorepo v2 (evita o Next inferir pelo lockfile do v1).
  outputFileTracingRoot: path.join(dir, "../.."),
  // Garante que as fontes embutidas do Relatório PDF entrem no bundle serverless.
  outputFileTracingIncludes: {
    "/api/report": ["./lib/report/fonts/**"],
  },
};

export default nextConfig;
