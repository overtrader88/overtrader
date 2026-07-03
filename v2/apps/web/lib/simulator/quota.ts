/**
 * Regra de cobrança do Simulador — PURA (sem I/O), testável em isolamento.
 * As primeiras SIMULATOR_FREE_PER_DAY simulações do dia (UTC) são grátis;
 * a partir daí cada uma custa SIMULATOR_CREDIT_COST crédito(s).
 */
import { SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST } from "@/lib/billing-constants";

export interface SimulatorGate {
  /** Pode simular agora? (grátis, ou pago com saldo suficiente) */
  allowed: boolean;
  /** Se permitido, esta simulação será cobrada? */
  needsCharge: boolean;
  usedToday: number;
  balance: number;
}

export function decideSimulatorGate(usedToday: number, balance: number): SimulatorGate {
  const needsCharge = usedToday >= SIMULATOR_FREE_PER_DAY;
  return {
    allowed: !needsCharge || balance >= SIMULATOR_CREDIT_COST,
    needsCharge,
    usedToday,
    balance,
  };
}
