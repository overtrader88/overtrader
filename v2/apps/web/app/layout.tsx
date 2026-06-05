import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Overtrader — A IA que prova antes de prometer",
  description:
    "Análise de trading com IA, auditável. Toda métrica com amostra, intervalo de confiança e período. Backtest público, algoritmos abertos.",
  applicationName: "Overtrader",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62.5..125,400..800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
