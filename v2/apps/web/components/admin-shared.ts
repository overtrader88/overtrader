/**
 * Tipos e helpers compartilhados entre a page do /admin (SERVER component) e o
 * AdminPanel (CLIENT). Módulo PURO — SEM "use client" — para poder ser
 * importado E EXECUTADO no server (ex.: mrrFromSubs no page.tsx). Definir isso
 * dentro do admin-panel.tsx ("use client") quebra o build de produção: chamar
 * a função no server lança "Attempted to call from the server but it's on the client".
 */

export interface AuditRow {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminExtra {
  audit: AuditRow[];
  analysisSeries: { date: string; count: number }[];
  activeSubs: { plan: string; period: string }[];
  ops: {
    lastSignalAt: string | null;
    lastCheckedAt: string | null;
    lastResolvedAt: string | null;
    openSignals: number;
    lastHublaAt: string | null;
    lastAnalysisAt: string | null;
  };
  engines?: EngineComparison | null;
}

/** Comparação de performance entre motores (aba "Motores" do admin). */
export interface EngineStat {
  engine: string; // padrao | classe | padrao_b | classe_b
  label: string;
  resolved: number;
  decisive: number;
  wins: number;
  losses: number;
  expired: number;
  winRatePct: number;
  profitFactor: number;
  avgR: number;
  totalR: number;
  open: number;
  emittedTotal: number;
  firstEmittedAt: string | null;
  lastEmittedAt: string | null;
  perDay: number;
  openInProfit: number;
  openInLoss: number;
  openNeutral: number;
  openUnrealizedR: number;
}

export interface OpenPosition {
  engine: string;
  symbol: string;
  timeframe: string;
  side: string;
  direction: string;
  entry: number;
  emittedAt: string;
  currentPrice: number | null;
  unrealizedR: number | null;
  status: "profit" | "loss" | "flat" | "unknown";
}

export interface GroupStat {
  n: number;
  winRatePct: number;
  totalR: number;
  wins: number;
  decisive: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  /** GroupStat por motor (chaveado pelo id do motor: padrao | padrao_b | classe | classe_b | llm). */
  stats: Record<string, GroupStat>;
}

export interface EquityPoint {
  t: string;       // ISO do resolved_at
  padrao: number;  // R acumulado do Motor 1 até aqui
  classe: number;  // R acumulado do Motor 2 até aqui
}

export interface ClosedOpRow {
  engine: string;
  symbol: string;
  timeframe: string;
  side: string;
  direction: string;
  outcome: string; // TP1/TP2/TP3/SL/EXPIRED
  pnlR: number;
  resolvedAt: string | null;
}

export interface EngineComparison {
  engines: EngineStat[];
  open: OpenPosition[];
  byClass: BreakdownRow[];
  byTimeframe: BreakdownRow[];
  byAsset: BreakdownRow[];
  bySymbolTf: BreakdownRow[];
  equity: EquityPoint[];
  closed: ClosedOpRow[];
}

// Preço mensal-equivalente por plano×período (R$). PRO anual = 600/12=50; PRO+ anual = 936/12=78.
export const MRR_PRICE: Record<string, Record<string, number>> = {
  pro: { monthly: 59, annual: 50 },
  pro_plus: { monthly: 99, annual: 78 },
};

export function mrrFromSubs(subs: { plan: string; period: string }[]): number {
  return subs.reduce((sum, s) => sum + (MRR_PRICE[s.plan]?.[s.period] ?? 0), 0);
}
