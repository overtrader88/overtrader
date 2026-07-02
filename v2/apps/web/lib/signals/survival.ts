/**
 * Contabilidade de SOBREVIVÊNCIA — fonte única das regras da banca:
 * começa em SURV_START, aposta RISK_NORMAL/STRONG da banca por trade e MORRE
 * abaixo de SURV_FLOOR (reencarna contando vidas). Usada pelo Ringue do /admin
 * (engine-comparison) e pelo FEEDBACK dos motores *_surv (o estado da banca é
 * injetado no prompt — a "mentalidade" vira ciclo fechado).
 */

export const SURV_START = 100;   // banca inicial
export const SURV_FLOOR = 33;    // morre abaixo de 33% (−67%)
export const RISK_NORMAL = 0.05; // 5% da banca por trade (convicção normal)
export const RISK_STRONG = 0.10; // 10% se convicção alta (direção STRONG_*)

export const survFraction = (direction: string): number =>
  /^STRONG/.test(direction) ? RISK_STRONG : RISK_NORMAL;

/** Estado da banca após o replay dos trades resolvidos (ordem cronológica). */
export interface BankState {
  equity: number;          // capital atual da vida corrente (unidades; start=100)
  peak: number;            // pico da vida corrente
  lives: number;           // 1 + mortes
  deaths: number;
  lifeTrades: number;      // trades da vida corrente
  maxDrawdownPct: number;  // pior queda pico→vale (%) dentro de uma vida
  lastResults: ("G" | "P" | "0")[]; // últimos 5 desfechos (Ganho/Perda/neutro)
}

/** Replay determinístico da banca. `trades` em ordem cronológica (resolved_at asc). */
export function replayBank(trades: { pnlR: number; direction: string }[]): BankState {
  let equity = SURV_START, peak = SURV_START, maxDD = 0;
  let lives = 1, deaths = 0, lifeTrades = 0;
  const last: ("G" | "P" | "0")[] = [];
  for (const t of trades) {
    equity = equity * (1 + t.pnlR * survFraction(t.direction));
    lifeTrades++;
    last.push(t.pnlR > 0 ? "G" : t.pnlR < 0 ? "P" : "0");
    if (last.length > 5) last.shift();
    if (equity <= SURV_FLOOR) {
      deaths++; lives++;
      equity = SURV_START; peak = SURV_START; lifeTrades = 0;
    } else {
      peak = Math.max(peak, equity);
      maxDD = Math.max(maxDD, (peak - equity) / peak);
    }
  }
  return { equity, peak, lives, deaths, lifeTrades, maxDrawdownPct: Math.round(maxDD * 100), lastResults: last };
}
