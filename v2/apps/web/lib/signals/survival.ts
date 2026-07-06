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

// ===================== HEAT DE CARTEIRA (diagnóstico — achado 9, camada 1) =====================
// O replayBank trata os trades como sequenciais, mas o motor pode ter até 12
// posições SIMULTÂNEAS (dedup é 1 por mercado+motor). O heat mede a soma dos
// riscos abertos por instante (variante ADITIVA do sizing de entrada: 5%/10%
// por posição). É SÓ diagnóstico: nenhuma regra de teto foi ativada — a camada
// 2 (teto de heat) fica GATED no resultado observado (gate pré-registrado:
// máximo <15% → achado morre; ≥20-40% → implementar teto).

/** Intervalo de exposição de uma posição do motor (aberta: resolvedAt = null). */
export interface HeatInterval {
  emittedAt: string;
  resolvedAt: string | null;
  direction: string;
}

export interface HeatState {
  /** Pico histórico da soma de frações de risco abertas ao mesmo tempo (0-1). */
  maxConcurrentHeat: number;
  /** Nº de posições abertas no instante do pico. */
  maxConcurrentPositions: number;
  /** ISO do instante do pico (emissão que o causou). null sem posições. */
  maxAt: string | null;
  /** Soma das frações de risco das posições AINDA abertas agora (0-1). */
  currentHeat: number;
  currentPositions: number;
}

const EMPTY_HEAT: HeatState = {
  maxConcurrentHeat: 0, maxConcurrentPositions: 0, maxAt: null, currentHeat: 0, currentPositions: 0,
};

/**
 * Sweep-line PURA sobre (emitted_at, resolved_at): soma as frações de risco
 * (5% normal / 10% STRONG) das posições sobrepostas no tempo — posições ainda
 * abertas contam até "agora". Determinística; datas inválidas são ignoradas.
 */
export function computeHeat(positions: HeatInterval[]): HeatState {
  type Ev = { t: number; delta: number; open: boolean; iso: string };
  const events: Ev[] = [];
  let currentHeat = 0;
  let currentPositions = 0;
  for (const p of positions) {
    const start = Date.parse(p.emittedAt);
    if (!Number.isFinite(start)) continue;
    const frac = survFraction(p.direction);
    events.push({ t: start, delta: frac, open: true, iso: p.emittedAt });
    if (p.resolvedAt) {
      const end = Date.parse(p.resolvedAt);
      if (Number.isFinite(end) && end > start) events.push({ t: end, delta: -frac, open: false, iso: p.resolvedAt });
      // resolvida "no mesmo instante" (ou data ruim): não contribui pro pico
      else events.push({ t: start, delta: -frac, open: false, iso: p.emittedAt });
    } else {
      currentHeat += frac;
      currentPositions++;
    }
  }
  if (events.length === 0) return { ...EMPTY_HEAT };
  // No mesmo instante, fechamento SAI antes da abertura entrar (trade que fecha
  // no tick em que outro abre não conta como sobreposição).
  events.sort((a, b) => a.t - b.t || (a.open === b.open ? 0 : a.open ? 1 : -1));

  let heat = 0;
  let count = 0;
  let maxHeat = 0;
  let maxCount = 0;
  let maxAt: string | null = null;
  for (const e of events) {
    heat += e.delta;
    count += e.open ? 1 : -1;
    if (heat > maxHeat + 1e-12) {
      maxHeat = heat;
      maxCount = count;
      maxAt = e.iso;
    }
  }
  return {
    maxConcurrentHeat: Math.round(maxHeat * 1e4) / 1e4,
    maxConcurrentPositions: maxCount,
    maxAt,
    currentHeat: Math.round(currentHeat * 1e4) / 1e4,
    currentPositions,
  };
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
