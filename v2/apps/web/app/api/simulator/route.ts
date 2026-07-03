/**
 * POST /api/simulator — Simulador "Máquina do Tempo".
 *
 * Fluxo: auth → rate-limit → Zod (+ data no PASSADO, dia já encerrado em UTC)
 * → gate de cota (3 grátis/dia; depois 1 crédito) → runSimulation (séries
 * truncadas no fim do dia escolhido, sem lookahead) → cobra (se além da cota)
 * → registra na trilha → DTO + billing.
 *
 * A cobrança acontece DEPOIS de simular com sucesso (falha de dados não come
 * crédito). Débito/registro são best-effort (padrão lib/credits.ts).
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/http/limit";
import { simulatorInputSchema } from "@/lib/validation/schemas";
import { simulateSymbol } from "@/lib/simulator/service";
import { checkSimulatorGate, chargeSimulation, recordSimulation } from "@/lib/simulator/gate";
import { getCurrentUser } from "@/lib/supabase/auth";
import { SIMULATOR_FREE_PER_DAY, SIMULATOR_CREDIT_COST } from "@/lib/billing-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Data mínima simulável (antes disso os provedores não têm série confiável). */
const MIN_DATE_MS = Date.UTC(2010, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Faça login para simular." }, { status: 401 });

  const limited = await rateLimit(req, "simulator", 10);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }
  const parsed = simulatorInputSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const { symbol, assetType, timeframe, date } = parsed.data;

  // Máquina do tempo só viaja pro PASSADO: o dia escolhido precisa ter
  // terminado (corte = fim do dia UTC) — senão haveria candles "do futuro"
  // ainda inexistentes e a simulação viraria análise ao vivo disfarçada.
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dayStart) || dayStart < MIN_DATE_MS) {
    return NextResponse.json({ error: "Escolha uma data a partir de 01/01/2010." }, { status: 400 });
  }
  if (dayStart + DAY_MS > Date.now()) {
    return NextResponse.json({ error: "Escolha um dia que já terminou (ontem ou antes, em UTC)." }, { status: 400 });
  }

  const gate = await checkSimulatorGate(user.id);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: `Você usou as ${SIMULATOR_FREE_PER_DAY} simulações grátis de hoje e não tem créditos (cada simulação extra custa ${SIMULATOR_CREDIT_COST} crédito).`,
        balance: gate.balance,
      },
      { status: 402 },
    );
  }

  let result;
  try {
    result = await simulateSymbol(symbol, assetType, timeframe, date);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao obter dados / computar a simulação." },
      { status: 502 },
    );
  }

  let charged = false;
  let balance = gate.balance;
  if (gate.needsCharge) {
    const remaining = await chargeSimulation(user.id, { symbol, timeframe, date });
    if (remaining != null) {
      charged = true;
      balance = remaining;
    }
  }
  await recordSimulation(user.id, {
    symbol, assetType, timeframe, simDate: date, charged,
    outcome: result.lifecycle?.outcome ?? null,
    pnlR: result.lifecycle?.pnlR ?? null,
  });

  return NextResponse.json({
    ...result,
    billing: {
      usedToday: gate.usedToday + 1,
      freePerDay: SIMULATOR_FREE_PER_DAY,
      cost: SIMULATOR_CREDIT_COST,
      charged,
      balance,
    },
  });
}
