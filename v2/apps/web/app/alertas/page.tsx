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
}

export default async function AlertasPage() {
  const user = await getCurrentUser();
  const sb = await supabaseServerSSR();
  const { data } = user
    ? await sb
        .from("alerts")
        .select("id,symbol,timeframe,signal,message,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
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
        <div className="head2">
          <div>
            <h1>Alertas</h1>
            <div className="meta"><b>{items.length}</b> {items.length === 1 ? "alerta" : "alertas"} · disparados pela watchlist</div>
          </div>
        </div>

        <TelegramConnect />
        <EmailNotify />

        {items.length === 0 ? (
          <div className="tbl" style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="note" style={{ margin: 0 }}>
              Nenhum alerta ainda. Adicione ativos à watchlist com <b>★ Acompanhar</b> na <a href="/analise" style={{ color: "var(--cyan)" }}>Análise</a> —
              quando o sinal de compra atingir o limiar, o alerta aparece aqui.
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
