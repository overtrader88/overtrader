import { AppBar, SignalBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { signalToDir, signalLabelPt, relativeTime } from "@/lib/analysis/display";
import { MarkAlertsRead } from "@/components/mark-alerts-read";
import { TelegramConnect } from "@/components/telegram-connect";
import { EmailNotify } from "@/components/email-notify";
import { AssetGlyph } from "@/components/asset-glyph";
import type { SignalDirection } from "@tradeai/shared";

export const dynamic = "force-dynamic";

interface AlertRow {
  id: string;
  symbol: string;
  timeframe: string;
  signal: SignalDirection;
  message: string;
  read_at: string | null;
  created_at: string;
  engine?: string;
}

const ENGINE_TABS = [
  { key: "ambos", label: "Ambos" },
  { key: "padrao", label: "Motor padrão" },
  { key: "classe", label: "Motor por classe" },
] as const;

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden><path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9L12 3Z" /></svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ engine?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = ENGINE_TABS.find((t) => t.key === sp.engine) ?? ENGINE_TABS[0];
  const user = await getCurrentUser();
  const sb = await supabaseServerSSR();
  // select("*") tolera a coluna `engine` ausente antes da migration (não quebra a lista).
  let q = user
    ? sb.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
    : null;
  if (q && activeTab.key !== "ambos") q = q.eq("engine", activeTab.key);
  const { data } = q ? await q : { data: [] };
  const items = (data ?? []) as AlertRow[];
  const now = Date.now();

  return (
    <div className="hist-page">
      <AppBar
        active="alertas"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="wrap">
        <div className="al-head">
          <span className="al-ico"><BellIcon /></span>
          <div className="al-titles">
            <h1>Alertas</h1>
            <div className="al-sub"><b>{items.length} {items.length === 1 ? "alerta" : "alertas"}</b> · disparados pela watchlist</div>
          </div>
          <a href="/watchlist" className="btn primary lg al-wl"><StarIcon /> Gerenciar watchlist</a>
        </div>

        <TelegramConnect />
        <EmailNotify />

        <div className="tr-tabs" style={{ marginBottom: 14 }}>
          {ENGINE_TABS.map((t) => (
            <a key={t.key} href={t.key === "ambos" ? "/alertas" : `/alertas?engine=${t.key}`}
              className={`tr-tab${t.key === activeTab.key ? " on" : ""}`}>{t.label}</a>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="tbl" style={{ padding: "44px 24px", textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>
              Nenhum alerta ainda. Adicione ativos em <a href="/watchlist" style={{ color: "var(--cyan)" }}>Gerenciar watchlist</a> —
              quando o sinal (compra ou venda) atingir o limiar escolhido, o alerta aparece aqui.
            </p>
          </div>
        ) : (
          <div className="tbl">
            {items.map((a) => (
              <a className={`alert-item${a.read_at ? "" : " unread"}`} key={a.id}
                href={`/analise?symbol=${encodeURIComponent(a.symbol)}&tf=${a.timeframe}${a.engine === "classe" ? "&engine=classe" : ""}`}>
                <span className="a-sym">
                  <AssetGlyph symbol={a.symbol} size={34} />
                  <span className="s">{a.symbol}</span>
                  <span className="tf">{a.timeframe.toUpperCase()}</span>
                </span>
                <span className="am-sig">
                  <SignalBadge direction={signalToDir(a.signal)}>{signalLabelPt(a.signal)}</SignalBadge>
                  {a.engine === "classe" ? <span className="eng-chip">⚙ Motor 2</span> : null}
                </span>
                <span className="am-msg">{a.message}</span>
                <span className="am-meta">
                  <ClockIcon />
                  <span className="am-dt">{relativeTime(a.created_at, now)}</span>
                  <span className="am-chev" aria-hidden>›</span>
                </span>
              </a>
            ))}
          </div>
        )}

        <div style={{ height: 60 }} />
      </div>
      <MarkAlertsRead />
    </div>
  );
}
