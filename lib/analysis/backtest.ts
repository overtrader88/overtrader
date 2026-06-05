/**
 * Backtesting básico — walk-forward sobre histórico de candles.
 *
 * Estratégia:
 *   - Janela de cálculo: 200 candles (mesma da engine)
 *   - Para cada candle a partir do índice 200, computa o sinal que A ENGINE GERARIA
 *     usando APENAS dados até esse ponto (sem lookahead bias)
 *   - Se sinal for ACIONÁVEL (BUY/STRONG_BUY/SELL/STRONG_SELL), abre trade simulado
 *   - Walk-forward: checa os candles seguintes para ver se atingiu SL, TP1, TP2 ou TP3
 *   - Limite por trade: 50 candles (depois disso, conta como "expirado")
 *
 * Output: estatísticas resumidas para o usuário decidir se confia no sinal atual.
 *
 * Limitações conhecidas (declaradas na UI):
 *   - Sem custos de slippage/spread
 *   - Não considera execução real (assumimos preenchimento no fechamento da vela)
 *   - Lookahead simulado dentro da vela (HIGH/LOW) — boa aproximação mas não exata
 */
import type { AnalysisInput, AnalysisResult } from "./types";
import { runAnalysis } from "./engine";
import { isActionable, signalSide } from "./signal-utils";

const MIN_CANDLES_FOR_ENGINE = 200;
const MAX_TRADE_DURATION_CANDLES = 50;
const COOLDOWN_AFTER_TRADE = 5; // evita abrir múltiplos trades no mesmo movimento
const PARTIAL_EXIT_FRACTION = 0.5; // fracao da posicao fechada em TP1 na estrategia partial

/**
 * Estrategias de saida disponiveis. Cada uma tem caracteristicas diferentes:
 *
 * - "exit-tp1": Fecha posicao inteira em TP1 (+1.5R). Padrao classico, melhor pra
 *   mercados mean-reverting. Win rate alto, ganhos limitados.
 *
 * - "move-to-breakeven": Move stop pra entrada apos TP1 e busca TP2/TP3. Cria
 *   "free trade". Bom pra tendencias fortes, ruim se preco reverte muito.
 *
 * - "partial-exit": Fecha 50% em TP1 (+0.75R locked), trail o resto com stop em
 *   BE. Compromisso — captura tendencia sem zerar o ganho garantido.
 */
export type BacktestStrategy = "exit-tp1" | "move-to-breakeven" | "partial-exit";

export const BACKTEST_STRATEGIES: BacktestStrategy[] = [
  "exit-tp1",
  "move-to-breakeven",
  "partial-exit",
];

export function isValidStrategy(s: unknown): s is BacktestStrategy {
  return (
    s === "exit-tp1" || s === "move-to-breakeven" || s === "partial-exit"
  );
}

export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  side: "buy" | "sell";
  signal: string; // BUY, STRONG_BUY, etc.
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  /** Resultado final do trade */
  outcome:
    | "TP1"
    | "TP2"
    | "TP3"
    | "BE"
    | "SL"
    | "EXPIRED";
  /** Preco encostou em TP1 durante o trade (mesmo que tenha saido em BE/TP2/TP3 depois) */
  tp1Touched?: boolean;
  /** Distância em candles até o desfecho */
  durationCandles: number;
  /** P&L em pontos (positivo = lucro, negativo = perda) */
  pnlPoints: number;
  /** P&L em R (múltiplos de risco) */
  pnlR: number;
}

export interface BacktestSummary {
  /** Estrategia usada na simulacao */
  strategy: BacktestStrategy;
  /** Quantos trades foram simulados */
  totalTrades: number;
  /** % de trades que atingiram pelo menos TP1 */
  winRate: number;
  /** Ratio (somatório lucro) / (somatório perda) — > 1 é positivo */
  profitFactor: number;
  /** Média de R por trade (1R = distância até SL) */
  avgR: number;
  /** Maior drawdown em R consecutivos */
  maxDrawdownR: number;
  /** Distribuição de saídas */
  outcomes: {
    TP1: number;
    TP2: number;
    TP3: number;
    BE: number;
    SL: number;
    EXPIRED: number;
  };
  /** % de trades em que o preco encostou em TP1 (independente do desfecho final) */
  tp1TouchRate?: number;
  /** Trades individuais (limitados a 100 para payload não estourar) */
  trades: BacktestTrade[];
  /** Período coberto (em candles) */
  candlesAnalyzed: number;
  /** Tempo de execução em ms */
  durationMs: number;
}

/**
 * Executa o backtest sobre os candles fornecidos.
 *
 * @param input mesmos parâmetros usados na análise atual
 * @param maxCandlesToScan limita o tamanho da janela varrida (default: até 500 candles após o 200)
 */
export function runBacktest(
  input: AnalysisInput,
  maxCandlesToScan: number = 500,
  strategy: BacktestStrategy = "exit-tp1"
): BacktestSummary {
  const t0 = Date.now();
  const candles = input.candles;
  const trades: BacktestTrade[] = [];

  if (candles.length < MIN_CANDLES_FOR_ENGINE + 20) {
    return {
      strategy,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      avgR: 0,
      maxDrawdownR: 0,
      outcomes: { TP1: 0, TP2: 0, TP3: 0, BE: 0, SL: 0, EXPIRED: 0 },
      tp1TouchRate: 0,
      trades: [],
      candlesAnalyzed: candles.length,
      durationMs: Date.now() - t0,
    };
  }

  // Janela: do índice 200 até o último candle - alguns para dar espaço de walk-forward
  const start = MIN_CANDLES_FOR_ENGINE;
  const end = Math.min(
    candles.length - 1,
    start + maxCandlesToScan
  );

  let cooldown = 0;

  for (let i = start; i < end; i++) {
    if (cooldown > 0) {
      cooldown--;
      continue;
    }

    // Slice de histórico ATÉ esse candle (sem lookahead)
    const historySlice = candles.slice(0, i + 1);

    let result: AnalysisResult;
    try {
      result = runAnalysis({
        symbol: input.symbol,
        assetType: input.assetType,
        timeframe: input.timeframe,
        candles: historySlice,
      });
    } catch {
      continue;
    }

    // Só simula trade se sinal é acionável (BUY/SELL/STRONG_*)
    if (!isActionable(result.signal.signal)) continue;

    const side = signalSide(result.signal.signal);
    if (side === "neutral") continue;

    const entry = result.risk.entry;
    const sl = result.risk.stopLoss;
    const tp1 = result.risk.takeProfit1;
    const tp2 = result.risk.takeProfit2;
    const tp3 = result.risk.takeProfit3;
    const riskDistance = Math.abs(entry - sl);
    if (riskDistance === 0) continue;

    // Walk-forward — branch por estrategia
    let outcome: BacktestTrade["outcome"] = "EXPIRED";
    let exitIndex = i;
    let pnlPoints = 0;
    let tp1Touched = false;
    // effectiveStop comeca em sl. Vira entry apos TP1 nas estrategias com BE.
    let effectiveStop = sl;
    // Para partial-exit: PnL ja travado em TP1 (50% × distancia TP1)
    let lockedPnl = 0;
    const usesBE =
      strategy === "move-to-breakeven" || strategy === "partial-exit";

    /** Helper: marca que TP1 foi atravessado (TP2/TP3 implicam TP1) */
    const markTp1Touched = () => {
      if (!tp1Touched) {
        tp1Touched = true;
        if (usesBE) effectiveStop = entry;
        if (strategy === "partial-exit") {
          const tp1Distance = side === "buy" ? tp1 - entry : entry - tp1;
          lockedPnl = PARTIAL_EXIT_FRACTION * tp1Distance;
        }
      }
    };

    for (
      let j = i + 1;
      j < Math.min(candles.length, i + MAX_TRADE_DURATION_CANDLES);
      j++
    ) {
      const c = candles[j];

      if (side === "buy") {
        // Stop primeiro (conservador). Pode estar em BE apos TP1.
        if (c.low <= effectiveStop) {
          if (tp1Touched && usesBE) {
            outcome = "BE";
            // Strategy partial-exit ja travou metade do ganho em TP1
            pnlPoints = lockedPnl;
          } else {
            outcome = "SL";
            pnlPoints = sl - entry;
          }
          exitIndex = j;
          break;
        }
        if (c.high >= tp3) {
          markTp1Touched();
          outcome = "TP3";
          exitIndex = j;
          pnlPoints =
            strategy === "partial-exit"
              ? lockedPnl + (1 - PARTIAL_EXIT_FRACTION) * (tp3 - entry)
              : tp3 - entry;
          break;
        }
        if (c.high >= tp2) {
          markTp1Touched();
          outcome = "TP2";
          exitIndex = j;
          pnlPoints =
            strategy === "partial-exit"
              ? lockedPnl + (1 - PARTIAL_EXIT_FRACTION) * (tp2 - entry)
              : tp2 - entry;
          break;
        }
        if (!tp1Touched && c.high >= tp1) {
          if (strategy === "exit-tp1") {
            // Estrategia classica: fecha tudo aqui
            tp1Touched = true;
            outcome = "TP1";
            exitIndex = j;
            pnlPoints = tp1 - entry;
            break;
          }
          // BE ou partial: marca, move stop pra BE, continua
          markTp1Touched();
        }
      } else {
        // sell — espelhado
        if (c.high >= effectiveStop) {
          if (tp1Touched && usesBE) {
            outcome = "BE";
            pnlPoints = lockedPnl;
          } else {
            outcome = "SL";
            pnlPoints = entry - sl;
          }
          exitIndex = j;
          break;
        }
        if (c.low <= tp3) {
          markTp1Touched();
          outcome = "TP3";
          exitIndex = j;
          pnlPoints =
            strategy === "partial-exit"
              ? lockedPnl + (1 - PARTIAL_EXIT_FRACTION) * (entry - tp3)
              : entry - tp3;
          break;
        }
        if (c.low <= tp2) {
          markTp1Touched();
          outcome = "TP2";
          exitIndex = j;
          pnlPoints =
            strategy === "partial-exit"
              ? lockedPnl + (1 - PARTIAL_EXIT_FRACTION) * (entry - tp2)
              : entry - tp2;
          break;
        }
        if (!tp1Touched && c.low <= tp1) {
          if (strategy === "exit-tp1") {
            tp1Touched = true;
            outcome = "TP1";
            exitIndex = j;
            pnlPoints = entry - tp1;
            break;
          }
          markTp1Touched();
        }
      }
    }

    if (outcome === "EXPIRED") {
      // Saida pelo close do ultimo candle avaliado
      exitIndex = Math.min(
        candles.length - 1,
        i + MAX_TRADE_DURATION_CANDLES - 1
      );
      const exitClose = candles[exitIndex].close;
      const fullPnl = side === "buy" ? exitClose - entry : entry - exitClose;
      // Em partial-exit, se TP1 foi tocado, metade ja foi locked
      if (strategy === "partial-exit" && tp1Touched) {
        pnlPoints = lockedPnl + (1 - PARTIAL_EXIT_FRACTION) * fullPnl;
      } else {
        pnlPoints = fullPnl;
      }
    }

    const pnlR = pnlPoints / riskDistance;

    trades.push({
      entryIndex: i,
      exitIndex,
      entryPrice: entry,
      side,
      signal: result.signal.signal,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      outcome,
      tp1Touched,
      durationCandles: exitIndex - i,
      pnlPoints,
      pnlR,
    });

    cooldown = COOLDOWN_AFTER_TRADE;
  }

  // Estatísticas
  const outcomes = { TP1: 0, TP2: 0, TP3: 0, BE: 0, SL: 0, EXPIRED: 0 };
  let totalGain = 0;
  let totalLoss = 0;
  let sumR = 0;
  let tp1TouchCount = 0;

  for (const t of trades) {
    outcomes[t.outcome]++;
    if (t.pnlR > 0) totalGain += t.pnlR;
    else if (t.pnlR < 0) totalLoss += Math.abs(t.pnlR);
    // pnlR === 0 (BE) nao entra em gain nem loss
    sumR += t.pnlR;
    if (t.tp1Touched || t.outcome === "TP1" || t.outcome === "TP2" || t.outcome === "TP3" || t.outcome === "BE") {
      tp1TouchCount++;
    }
  }

  const wins = outcomes.TP1 + outcomes.TP2 + outcomes.TP3;
  const losses = outcomes.SL;
  const totalDecisive = wins + losses;
  const winRate =
    totalDecisive > 0 ? wins / totalDecisive : 0;
  const profitFactor =
    totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0;
  const avgR = trades.length > 0 ? sumR / trades.length : 0;
  const tp1TouchRate = trades.length > 0 ? tp1TouchCount / trades.length : 0;

  // Max drawdown em R consecutivos
  let runningPnl = 0;
  let peak = 0;
  let maxDdR = 0;
  for (const t of trades) {
    runningPnl += t.pnlR;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDdR) maxDdR = dd;
  }

  return {
    strategy,
    totalTrades: trades.length,
    winRate,
    profitFactor: Number.isFinite(profitFactor) ? profitFactor : 99,
    avgR,
    maxDrawdownR: maxDdR,
    outcomes,
    tp1TouchRate,
    trades: trades.slice(-100), // últimos 100
    candlesAnalyzed: end - start,
    durationMs: Date.now() - t0,
  };
}
