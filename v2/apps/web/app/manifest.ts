import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Overtrader",
    short_name: "Overtrader",
    description: "Análise de trading com IA, auditável — toda métrica com amostra, IC e período.",
    start_url: "/",
    display: "standalone",
    background_color: "#07090e",
    theme_color: "#185FA5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
