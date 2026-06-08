/**
 * Placar dos MOTORES para o Telegram do admin. A cada operação fechada por
 * lucro/prejuízo, o cron de resolução dispara este placar: Take × Stop, % de
 * acerto, nº de operações e R acumulado por motor, + a última operação fechada.
 * Leve (uma query, sem buscar preços). No-op gracioso se o chat não estiver
 * configurado (TELEGRAM_ADMIN_CHAT_ID).
 */
import { notifyTelegram, type NotifyResult } from "@/lib/notify/telegram";
import { supabaseService } from "@/lib/supabase/server";

export interface ScoreLine {
  engine: "padrao" | "classe";
  label: string;
  take: number;      // TP1+TP2+TP3
  stop: number;      // SL
  expired: number;
  decisive: number;  // take+stop
  ops: number;       // resolvidos (take+stop+expired)
  open: number;      // abertos agora
  winPct: number;    // take/decisive
  totalR: number;    // R acumulado realizado
}

export interface ClosedOp {
  engine: string;
  symbol: string;
  timeframe: string;
  side: string;
  outcome: string;   // TP1/TP2/TP3/SL/EXPIRED
  pnlR: number;
}

export interface Scoreboard {
  lines: ScoreLine[];
  totalClosed: number;
}

const LABEL: Record<string, string> = { padrao: "Motor 1 (padrão)", classe: "Motor 2 (classe)" };
const isWin = (o: string) => o === "TP1" || o === "TP2" || o === "TP3";

export async function getScoreboard(): Promise<Scoreboard | null> {
  const sb = supabaseService();
  if (!sb) return null;
  const { data, error } = await sb.from("signals").select("engine, outcome, pnl_r").limit(8000);
  if (error) return null;
  const rows = (data ?? []) as { engine: string | null; outcome: string | null; pnl_r: number | null }[];

  const lines: ScoreLine[] = (["padrao", "classe"] as const).map((eng) => {
    const list = rows.filter((r) => (r.engine ?? "padrao") === eng);
    let take = 0, stop = 0, expired = 0, open = 0, totalR = 0;
    for (const r of list) {
      if (r.outcome == null) { open++; continue; }
      if (isWin(r.outcome)) take++;
      else if (r.outcome === "SL") stop++;
      else expired++;
      if (r.pnl_r != null) totalR += Number(r.pnl_r);
    }
    const decisive = take + stop;
    return {
      engine: eng, label: LABEL[eng]!, take, stop, expired, decisive,
      ops: take + stop + expired, open,
      winPct: decisive > 0 ? (take / decisive) * 100 : 0,
      totalR: Math.round(totalR * 10) / 10,
    };
  });

  return { lines, totalClosed: lines.reduce((s, l) => s + l.ops, 0) };
}

const OUTCOME_PT: Record<string, string> = {
  TP1: "TAKE (TP1)", TP2: "TAKE (TP2)", TP3: "TAKE (TP3)", SL: "STOP", EXPIRED: "Expirou",
};

/** Monta o HTML do placar para o Telegram. */
export function formatScoreboard(sb: Scoreboard, last: ClosedOp | null): string {
  const leader = (() => {
    const [p, c] = sb.lines;
    if (!p || !c || (p.decisive < 3 && c.decisive < 3)) return null;
    if (p.winPct === c.winPct) return null;
    return p.winPct > c.winPct ? p.label : c.label;
  })();

  const block = (l: ScoreLine) =>
    `<b>${l.label}</b>\n` +
    `✅ ${l.take} Take · ❌ ${l.stop} Stop · 🎯 ${l.winPct.toFixed(0)}%\n` +
    `${l.ops} ops${l.expired ? ` (${l.expired} exp.)` : ""} · ${l.open} abertas · ${l.totalR >= 0 ? "+" : ""}${l.totalR}R`;

  const lines = [
    "🏁 <b>PLACAR DOS MOTORES</b>",
    "",
    block(sb.lines[0]!),
    "",
    block(sb.lines[1]!),
  ];
  if (leader) lines.push("", `🏆 Liderando: <b>${leader}</b>`);

  if (last) {
    const win = isWin(last.outcome);
    const emoji = win ? "🟢" : last.outcome === "SL" ? "🔴" : "⚪";
    const eng = last.engine === "classe" ? "Motor 2" : "Motor 1";
    const dir = last.side === "sell" ? "Venda" : "Compra";
    lines.push(
      "",
      "📌 <b>Última fechada</b>",
      `${emoji} ${last.symbol} ${last.timeframe.toUpperCase()} · ${dir} · ${OUTCOME_PT[last.outcome] ?? last.outcome} (${last.pnlR >= 0 ? "+" : ""}${last.pnlR.toFixed(2)}R) · ${eng}`,
    );
  }
  return lines.join("\n");
}

/** Busca o placar e envia ao Telegram do admin. No-op se não configurado. */
export async function sendScoreboardToAdmin(last: ClosedOp | null): Promise<NotifyResult> {
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chat) return "unconfigured";
  const sb = await getScoreboard();
  if (!sb) return "error";
  return notifyTelegram(chat, formatScoreboard(sb, last));
}
