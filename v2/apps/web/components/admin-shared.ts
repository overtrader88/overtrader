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
  /** Expiração reclassificada (só admin): ganho (R≥0) e perda (R<0). */
  expiredWin: number;
  expiredLoss: number;
  winRatePct: number;
  profitFactor: number;
  avgR: number;
  totalR: number;
  /** R médio dos GANHOS (TP1/TP2/TP3). */
  avgWinR: number;
  /** R médio das PERDAS (SL). */
  avgLossR: number;
  /** Payoff = ganho médio / |perda média| (>1 = assimetria a favor). */
  payoff: number;
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
  assetType: string;
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
  t: string;                       // ISO do resolved_at
  values: Record<string, number>;  // R acumulado por motor (padrao|padrao_b|classe|classe_b|llm) até aqui
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
  /** Post-mortem da IA (sinais mortos no SL; coluna da migration 0015). */
  autopsy?: string | null;
}

/** Geração MORTA da linhagem evo (arquivo evo_engines_history, migration 0018). */
export interface EvoGeneration {
  generation: number;
  diedAt: string;
  lifeTrades: number | null;
  expectancyR: number | null;
  deathContext: string | null;
}

/** Slot da EVOLUÇÃO darwiniana (núcleo vigente + linhagem). */
export interface EvoInfo {
  slot: string;
  provider: string;
  core: string;
  generation: number;
  deaths: number;
  parents: string | null;
  bornAt: string;
  /** Fitness AO VIVO da vida do núcleo (replay dos resolvidos desde born_at). */
  lifeResolved: number;
  lifeMeanR: number | null;
  /** Upper bound 90% da expectância (média + 1.28σ/√n) — morte se < 0 com n ≥ 20. */
  fitnessUbR: number | null;
  /** Darwin 2.0: banca quebrou mas n < 20 — morte adiada até amostra suficiente. */
  observing: boolean;
  /** Elitismo passivo (migration 0018): recorde da linhagem. null pré-migration. */
  bestExpectancy: number | null;
  bestGeneration: number | null;
  /** Gerações mortas (mais recentes primeiro). null pré-migration 0018. */
  history: EvoGeneration[] | null;
}

/** Mesmas métricas por motor, recortadas por uma classe de ativo (filtro do ranking). */
export interface ClassEngines {
  class: string;   // crypto | forex | commodities | indices | stocks
  label: string;   // PT
  engines: EngineStat[];
}

/** Uma "conta de sobrevivência": banca que aposta fração por trade e MORRE se quebrar (reencarna). */
export interface SurvivalLine {
  engine: string;           // llm_surv | llm | llm_ds_surv | llm_ds | humano_<slug>
  label: string;            // "GPT · mente", "GPT · gestão", "🧑 Joao"…
  flavor: "mente" | "gestao" | "humano";
  provider: "gpt" | "ds" | "humano";
  alive: boolean;           // vida atual ainda viva?
  equity: number;           // capital atual em × da banca inicial (1.43 = +43%), inclui abertos a mercado
  realizedEquity: number;   // só dos fechados (× da banca inicial)
  lives: number;            // vidas totais (1 + mortes)
  deaths: number;
  resolved: number;         // trades resolvidos considerados
  avgTradesPerLife: number; // trades médios até quebrar (ou até agora)
  currentLifeTrades: number;
  maxDrawdownPct: number;   // pior queda pico→vale dentro de uma vida
  peakEquity: number;       // melhor capital atingido (× banca)
  curve: number[];          // pontos de capital (× banca) p/ sparkline; 0 = morte
  open: number;             // posições abertas agora
  /** DIAGNÓSTICO (achado 9, camada 1): pico da soma de riscos abertos ao mesmo
   *  tempo, em % da banca (posições simultâneas × 5-10%). SEM regra de teto.
   *  Opcionais p/ payloads antigos serializados. */
  maxHeatPct?: number;
  /** Nº de posições simultâneas no instante do pico de heat. */
  maxHeatPositions?: number;
  /** Soma dos riscos das posições abertas AGORA (% da banca). */
  currentHeatPct?: number;
}
export interface SurvivalArena {
  start: number;            // banca inicial (100)
  floorPct: number;         // morre abaixo deste % da banca (ex.: 33 = −67%)
  riskNormalPct: number;    // % arriscado por trade (convicção normal)
  riskStrongPct: number;    // % arriscado por trade (convicção alta / STRONG)
  lines: SurvivalLine[];
}

export interface EngineComparison {
  engines: EngineStat[];
  survival?: SurvivalArena | null;
  evo?: EvoInfo[] | null;
  /** Stats por classe de ativo × motor — alimenta o filtro de classe no ranking. */
  byClassEngine: ClassEngines[];
  open: OpenPosition[];
  byClass: BreakdownRow[];
  byTimeframe: BreakdownRow[];
  byAsset: BreakdownRow[];
  bySymbolTf: BreakdownRow[];
  equity: EquityPoint[];
  closed: ClosedOpRow[];
  daily: DailyRow[];
}

export interface DailyCell { wins: number; stops: number; expired: number; totalR: number; n: number }
export interface DailyRow { date: string; perEngine: Record<string, DailyCell> }

// Preço mensal-equivalente por plano×período (R$). PRO anual = 600/12=50; PRO+ anual = 936/12=78.
export const MRR_PRICE: Record<string, Record<string, number>> = {
  pro: { monthly: 59, annual: 50 },
  pro_plus: { monthly: 99, annual: 78 },
};

export function mrrFromSubs(subs: { plan: string; period: string }[]): number {
  return subs.reduce((sum, s) => sum + (MRR_PRICE[s.plan]?.[s.period] ?? 0), 0);
}
