"use client";

import { useEffect, useState } from "react";
import type { AssetType, Timeframe } from "@tradeai/shared";

interface NewsItem { title: string; url: string; source: string; publishedAt: number; sentiment: number; }
interface NewsSentiment { overall: string; score: number; scored: number; count: number; }
interface XProfile { handle: string; name: string; topic: string; }
interface NewsResponse { items: NewsItem[]; sentiment: NewsSentiment; summary: string | null; profiles: XProfile[]; }

type State = "loading" | "done" | "error";

const SENT_PT: Record<string, { label: string; cls: string }> = {
  bullish: { label: "Otimista", cls: "bull" },
  bearish: { label: "Pessimista", cls: "bear" },
  mixed: { label: "Misto", cls: "neu" },
  neutral: { label: "Neutro", cls: "neu" },
};

function rel(ms: number): string {
  if (!ms) return "";
  const h = Math.floor((Date.now() - ms) / 3_600_000);
  if (h < 1) return "agora há pouco";
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function dotColor(s: number): string {
  return s > 0.15 ? "var(--bull)" : s < -0.15 ? "var(--bear)" : "var(--ink-faint)";
}

/** Notícias do ativo + sentimento agregado (custo zero) + perfis X. Auto-fetch on-mount. */
export function NewsCard({ symbol, assetType, timeframe }: { symbol: string; assetType: AssetType; timeframe: Timeframe }) {
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<NewsResponse | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch("/api/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, assetType, timeframe }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((d: NewsResponse) => {
        if (alive) {
          setData(d);
          setState("done");
        }
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [symbol, assetType, timeframe]);

  if (state === "loading") return <p className="note">Carregando notícias…</p>;
  if (state === "error" || !data) return <p className="note">Não foi possível carregar notícias agora.</p>;

  const sent = SENT_PT[data.sentiment.overall] ?? { label: "Neutro", cls: "neu" };
  return (
    <div className="news">
      <div className="news-head">
        <span className={`news-sent ${sent.cls}`}>{sent.label}</span>
        <span className="news-meta">
          {data.sentiment.scored > 0
            ? `score ${data.sentiment.score > 0 ? "+" : ""}${data.sentiment.score} · ${data.items.length} manchetes`
            : `${data.items.length} manchetes`}
        </span>
      </div>

      {data.summary ? <p className="news-summary">{data.summary}</p> : null}

      {data.items.length === 0 ? (
        <p className="note">Sem notícias recentes para este ativo (ou fonte não configurada).</p>
      ) : (
        <div className="news-list">
          {data.items.map((n) => (
            <a className="news-row" href={n.url} target="_blank" rel="noopener noreferrer" key={n.url}>
              <span className="news-dot" style={{ background: dotColor(n.sentiment) }} />
              <span className="news-title">{n.title}</span>
              <span className="news-src">{n.source}{n.publishedAt ? ` · ${rel(n.publishedAt)}` : ""}</span>
            </a>
          ))}
        </div>
      )}

      {data.profiles.length > 0 ? (
        <div className="news-x">
          <span className="news-x-lbl">Perfis para acompanhar</span>
          {data.profiles.map((p) => (
            <a className="news-chip" href={`https://x.com/${p.handle}`} target="_blank" rel="noopener noreferrer" key={p.handle}>
              @{p.handle} <em>{p.topic}</em>
            </a>
          ))}
        </div>
      ) : null}

      <p className="note">Sentimento agregado dos scores do provedor (World News API) — contexto, não recomendação.</p>
    </div>
  );
}
