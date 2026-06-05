/**
 * Formatação das mensagens de notificação (Fase C2). PURO e testável. Tom fiel
 * ao posicionamento: factual, com aviso de risco — nunca promete lucro.
 */
export interface BroadcastSignal {
  symbol: string;
  timeframe: string;
  direction: string; // SignalDirection (ex.: STRONG_BUY)
  side: "buy" | "sell";
  entry: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  seal: string; // green | yellow
  rr1: number;
}

const SIGNAL_PT: Record<string, string> = {
  STRONG_BUY: "COMPRA FORTE", BUY: "COMPRA", WEAK_BUY: "COMPRA FRACA", NEUTRAL: "NEUTRO",
  WEAK_SELL: "VENDA FRACA", SELL: "VENDA", STRONG_SELL: "VENDA FORTE",
};
const SEAL_PT: Record<string, string> = { green: "selo verde", yellow: "selo amarelo (com ressalva)" };
const RISK_NOTE = "Análise técnica, não recomendação de investimento. Toda operação envolve risco de perda.";

const fmt = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });

/** Mensagem de um sinal oficial para o canal Telegram (HTML). */
export function formatSignalTelegram(s: BroadcastSignal): string {
  const dir = SIGNAL_PT[s.direction] ?? s.direction;
  return [
    `📡 <b>${s.symbol}</b> · ${s.timeframe.toUpperCase()} — <b>${dir}</b>`,
    `Entrada <b>${fmt(s.entry)}</b> · Stop <b>${fmt(s.stopLoss)}</b>`,
    `Alvos: ${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)} · R:R ${s.rr1.toFixed(1)}`,
    `Qualidade: ${SEAL_PT[s.seal] ?? s.seal}`,
    "",
    `<i>${RISK_NOTE}</i>`,
  ].join("\n");
}

export function formatSignalEmailSubject(s: BroadcastSignal): string {
  return `Overtrader · ${SIGNAL_PT[s.direction] ?? s.direction} em ${s.symbol} ${s.timeframe.toUpperCase()}`;
}

export function formatSignalEmailHtml(s: BroadcastSignal): string {
  const dir = SIGNAL_PT[s.direction] ?? s.direction;
  return `<div style="font-family:Arial,sans-serif;max-width:520px">
    <h2 style="margin:0 0 4px">${s.symbol} · ${s.timeframe.toUpperCase()}</h2>
    <p style="font-size:20px;font-weight:bold;margin:0 0 12px">${dir}</p>
    <p style="margin:2px 0">Entrada: <b>${fmt(s.entry)}</b></p>
    <p style="margin:2px 0">Stop: <b>${fmt(s.stopLoss)}</b></p>
    <p style="margin:2px 0">Alvos: ${fmt(s.tp1)} / ${fmt(s.tp2)} / ${fmt(s.tp3)} (R:R ${s.rr1.toFixed(1)})</p>
    <p style="margin:2px 0">Qualidade: ${SEAL_PT[s.seal] ?? s.seal}</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:14px 0"/>
    <p style="font-size:12px;color:#666">${RISK_NOTE}</p>
  </div>`;
}

/** Alerta de watchlist (sinal atingiu o limiar do usuário). */
export function formatAlertTelegram(a: { symbol: string; timeframe: string; signal: string; strength: number }): string {
  return [
    `🔔 <b>${a.symbol}</b> · ${a.timeframe.toUpperCase()} — <b>${SIGNAL_PT[a.signal] ?? a.signal}</b> (força ${a.strength})`,
    `<i>${RISK_NOTE}</i>`,
  ].join("\n");
}
