import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Fraunces, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Fonte display pra landing/marketing — serif expressivo, longe do AI-generic.
// Fraunces tem eixos variaveis (peso, opticais size, "softness") que dao caracter.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "900"],
});

// Mono melhorado pra dados numericos na landing — Geist Mono tem leitura
// superior pra tabelas e cotacoes vs JetBrains Mono mais "code-oriented".
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-display",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TradeAI — Análises de trading com IA, sem delay e com explicação",
    template: "%s | TradeAI",
  },
  description:
    "Plataforma de análises de trading com IA para Forex, Cripto, Ações e Commodities. " +
    "Dados ao vivo de verdade, explicação do sinal, backtesting básico e alertas grátis no Telegram.",
  keywords: [
    "trading", "IA", "inteligência artificial", "análise técnica",
    "criptomoedas", "forex", "ações", "Smart Money Concepts",
    "Bitcoin", "sinais de trading", "backtest",
  ],
  authors: [{ name: "TradeAI" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "TradeAI",
    title: "TradeAI — Análises de trading com IA",
    description:
      "Análises com IA, ao vivo de verdade, com explicação. Free tier real, sem créditos sumindo enquanto você dorme.",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeAI",
    description: "Análises de trading com IA, transparentes e ao vivo.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B1426" },
    { media: "(prefers-color-scheme: light)", color: "#0B1426" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="font-sans">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
