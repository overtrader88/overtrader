import { AppBar, SignalBadge } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { supabaseServerSSR } from "@/lib/supabase/server-ssr";
import { signalToDir, signalLabelPt, relativeTime } from "@/lib/analysis/display";
import { MarkAlertsRead } from "@/components/mark-alerts-read";
import { TelegramConnect } from "@/components/telegram-connect";
import { EmailNotify } from "@/components/email-notify";
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
        <div className="head2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1>Alertas</h1>
            <div className="meta"><b>{items.length}</b> {items.length === 1 ? "alerta" : "alertas"} · disparados pela watchlist</div>
          </div>
          <a href="/watchlist" className="btn primary" style={{ whiteSpace: "nowrap" }}>★ Gerenciar watchlist</a>
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
          <div className="tbl" style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>
              Nenhum alerta ainda. Adicione ativos em <a href="/watchlist" style={{ color: "var(--cyan)" }}>Gerenciar watchlist</a> —
              quando o sinal (compra ou venda) atingir o limiar escolhido, o alerta aparece aqui.
            </p>
          </div>
        ) : (
          <div className="tbl">
            {items.map((a) => (
              <div className={`alert-item${a.read_at ? "" : " unread"}`} key={a.id}>
                <div className="a-sym">
                  <span className="s">{a.symbol}</span>
                  <span className="tf">{a.timeframe.toUpperCase()}</span>
                </div>
                <SignalBadge direction={signalToDir(a.signal)}>{signalLabelPt(a.signal)}</SignalBadge>
                {a.engine === "classe" ? <span className="eng-chip">⚙ Motor 2</span> : null}
                <span className="am-msg">{a.message}</span>
                <span className="am-dt">{relativeTime(a.created_at, now)}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 60 }} />
      </div>
      <MarkAlertsRead />
    </div>
  );
}
