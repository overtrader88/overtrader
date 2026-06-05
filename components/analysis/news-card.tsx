"use client";

/**
 * Card de Noticias + Sentimento Macro.
 *
 * Mostra:
 *   - Sentimento agregado (bullish/bearish/neutral/mixed) com badge
 *   - Resumo gerado por IA (2-3 frases) com gatilhos macroeconomicos
 *   - Lista das 5 noticias mais relevantes (titulo + fonte + link)
 *   - Sugestoes de perfis X (Twitter) pra acompanhamento manual
 */

import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  AtSign,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

import { CURATED_X_PROFILES } from "@/lib/news/providers";
import type { AssetType } from "@/lib/market";

interface NewsItemLike {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: "positive" | "negative" | "neutral" | "important";
  summary?: string;
}

interface SentimentLike {
  overall: "bullish" | "bearish" | "neutral" | "mixed";
  score: number;
  summary: string;
  newsCount: number;
}

interface Props {
  news?: {
    items: NewsItemLike[];
    sentiment: SentimentLike | null;
  } | null;
  assetType?: AssetType;
}

const SENTIMENT_META = {
  bullish: {
    label: "Bullish",
    icon: TrendingUp,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/40",
    description: "Notícias predominantemente positivas pro ativo.",
  },
  bearish: {
    label: "Bearish",
    icon: TrendingDown,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/40",
    description: "Notícias predominantemente negativas pro ativo.",
  },
  neutral: {
    label: "Neutro",
    icon: Minus,
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    border: "border-border/40",
    description: "Sem viés claro nas notícias recentes.",
  },
  mixed: {
    label: "Misto",
    icon: AlertCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/40",
    description: "Sinais conflitantes nas notícias — opere com cautela.",
  },
} as const;

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) {
    const mins = Math.floor(ms / (1000 * 60));
    return `${mins}min atrás`;
  }
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function NewsCard({ news, assetType }: Props) {
  if (!news || (news.items.length === 0 && !news.sentiment)) return null;

  const profiles = assetType ? CURATED_X_PROFILES[assetType] ?? [] : [];

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-4">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          Contexto Macro
        </h4>
        <span className="text-[11px] text-muted-foreground">
          {news.items.length} notícia{news.items.length !== 1 ? "s" : ""} analisada{news.items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Sentimento agregado */}
      {news.sentiment && (
        <SentimentBlock sentiment={news.sentiment} />
      )}

      {/* Lista de noticias */}
      {news.items.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Notícias recentes
          </p>
          <ul className="space-y-2">
            {news.items.slice(0, 5).map((n, i) => (
              <NewsRow key={i} item={n} />
            ))}
          </ul>
        </div>
      )}

      {/* Perfis X curados */}
      {profiles.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border/40">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Perfis X pra acompanhar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profiles.slice(0, 8).map((p) => (
              <a
                key={p.handle}
                href={`https://x.com/${p.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/50 hover:bg-card hover:border-primary/40 transition-colors px-2.5 py-1 text-[11px] min-h-[28px]"
                title={`${p.name} — ${p.bio}. ${p.topic}`}
              >
                <AtSign className="h-3 w-3 text-primary" />
                <span className="font-medium">{p.handle}</span>
                <span className="text-muted-foreground text-[10px] hidden sm:inline">
                  · {p.topic}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground italic mt-4 leading-relaxed">
        Notícias via CryptoPanic / NewsAPI. Sentimento agregado por IA generativa.
        Use como contexto, não como sinal isolado de operação.
      </p>
    </Card>
  );
}

function SentimentBlock({ sentiment }: { sentiment: SentimentLike }) {
  const meta = SENTIMENT_META[sentiment.overall];
  const Icon = meta.icon;

  return (
    <Card className={cn("p-4 border-2", meta.bg, meta.border)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-full shrink-0",
            meta.bg
          )}
        >
          <Icon className={cn("h-4 w-4", meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className={cn("text-sm font-bold", meta.color)}>
              {meta.label}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] tabular-nums", meta.color)}
            >
              Score{" "}
              {sentiment.score >= 0 ? "+" : ""}
              {sentiment.score.toFixed(2)}
            </Badge>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">
            {sentiment.summary}
          </p>
        </div>
      </div>
    </Card>
  );
}

function NewsRow({ item }: { item: NewsItemLike }) {
  const sentColor =
    item.sentiment === "positive"
      ? "text-success"
      : item.sentiment === "negative"
        ? "text-destructive"
        : item.sentiment === "important"
          ? "text-warning"
          : "text-muted-foreground";

  return (
    <li>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md border border-border/40 bg-card/40 hover:bg-card hover:border-primary/40 transition-colors p-3 group"
      >
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "w-1 h-full shrink-0 rounded-full mt-0.5",
              item.sentiment === "positive" && "bg-success",
              item.sentiment === "negative" && "bg-destructive",
              item.sentiment === "important" && "bg-warning",
              (!item.sentiment || item.sentiment === "neutral") && "bg-muted"
            )}
            style={{ minHeight: "100%" }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground/90 group-hover:text-primary transition-colors line-clamp-2 flex-1">
                {item.title}
              </p>
              <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors" />
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span className={cn("font-medium", sentColor)}>
                {item.source}
              </span>
              <span>·</span>
              <span>{formatTimeAgo(item.publishedAt)}</span>
              {item.sentiment && item.sentiment !== "neutral" && (
                <>
                  <span>·</span>
                  <span className={sentColor}>{item.sentiment}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </a>
    </li>
  );
}
