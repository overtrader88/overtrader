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
}

// Preço mensal-equivalente por plano×período (R$). PRO anual = 600/12=50; PRO+ anual = 936/12=78.
export const MRR_PRICE: Record<string, Record<string, number>> = {
  pro: { monthly: 59, annual: 50 },
  pro_plus: { monthly: 99, annual: 78 },
};

export function mrrFromSubs(subs: { plan: string; period: string }[]): number {
  return subs.reduce((sum, s) => sum + (MRR_PRICE[s.plan]?.[s.period] ?? 0), 0);
}
