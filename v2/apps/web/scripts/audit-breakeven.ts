/**
 * MEDIÇÃO (Pacote B, achados 7 e 9 — offline, zero mudança no cron):
 *
 * 1) BREAKEVEN PÓS-TP1 (achado 7): fração dos TP1 que morreram no breakeven
 *    (exit == entry) + CONTRAFACTUAL completo — replay de TODOS os sinais
 *    resolvidos sob a regra alternativa "breakeven só após TP2" (variante
 *    estrutural SEM parâmetro novo, a menos overfitável), com ΔavgR e IC 95%
 *    por bootstrap PAREADO. Critério do cético: decidir pela expectância
 *    contrafactual completa (os dois lados), nunca só pela fração de mortes;
 *    gate de amostra ≥30 mortes-no-BE cobertas pelo replay; cobertura parcial
 *    (candles fora da janela do provider) reportada explicitamente.
 *
 * 2) HEAT SIMULTÂNEO (achado 9, camada 1): sweep-line sobre
 *    (emitted_at, resolved_at) por motor — o replayBank finge sequência, isto
 *    mede a exposição REAL. Gate pré-registrado: máx <15% → achado morre;
 *    ≥20-40% → camada 2 (teto) entra em pauta.
 *
 *   pnpm --filter @tradeai/web measure:breakeven
 */
import { TIMEFRAME_MS, isTimeframe, type AssetType, type Timeframe, type Candle } from "@tradeai/shared";
import { resolveLifecycle, type SignalPlan, type SignalOutcome, mulberry32 } from "@tradeai/engine";
import { fetchBinanceHistory, realJsonFetcher } from "../lib/market/history";
import { getCandles, realProviders } from "../lib/market/providers";
import { computeHeat } from "../lib/signals/survival";
import { loadEnvLocal } from "./load-env-local";

loadEnvLocal();
const jsonFetcher = realJsonFetcher({ timeoutMs: 20000 });
// Mesmo mapa do cron resolve-signals (era -j2).
const MAX_DURATION_BY_TF: Partial<Record<Timeframe, number>> = { "1h": 120, "4h": 60, "1d": 25, "1w": 12 };
const DEFAULT_MAX_DURATION = 60;

interface Row {
  id: string; symbol: string; asset_type: string; timeframe: string; side: string; direction: string;
  entry: number; stop_loss: number; tp1: number; tp2: number; tp3: number;
  emitted_at: string; resolved_at: string | null; outcome: string | null;
  exit_price: number | null; pnl_r: number | null; engine: string | null; stop_stage: string | null;
}

/**
 * VARIANTE CONTRAFACTUAL: idêntica ao resolveLifecycle do motor, exceto UMA
 * mudança — após TP1 o stop NÃO sobe pro entry (fica no SL inicial); após TP2
 * sobe pro TP1 como hoje. Rótulo "TP1" aqui significa "1/3 no TP1 + 2/3
 * stopados no SL cheio" (pnlR ≈ −0.17R com os RRs da casa). Fill gap-aware
 * idêntico ao motor (stop sai no open quando o candle abre além dele).
 */
function resolveLifecycleBeAfterTp2(plan: SignalPlan, future: Candle[], maxDuration: number): {
  status: "resolved" | "open"; outcome: SignalOutcome | null; pnlR: number | null; tp2Hit: boolean;
} {
  const { side, entry, stopLoss, takeProfit1: tp1, takeProfit2: tp2, takeProfit3: tp3 } = plan;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0 || !Number.isFinite(risk)) return { status: "open", outcome: null, pnlR: null, tp2Hit: false };
  const rOf = (p: number): number => (side === "buy" ? p - entry : entry - p) / risk;
  const reachedTp = (c: Candle, tp: number): boolean => (side === "buy" ? c.high >= tp : c.low <= tp);
  const hitStop = (c: Candle, stop: number): boolean => (side === "buy" ? c.low <= stop : c.high >= stop);
  const stopFill = (open: number, stop: number): number => (side === "buy" ? Math.min(open, stop) : Math.max(open, stop));

  let stage = 0;
  let stop = stopLoss;
  let realizedR = 0;
  let closed = 0;
  let tp1Hit = false, tp2Hit = false;
  const THIRD = 1 / 3;
  const scan = Math.min(future.length, maxDuration);
  for (let j = 0; j < scan; j++) {
    const c = future[j]!;
    if (hitStop(c, stop)) {
      const exit = stopFill(c.open, stop);
      realizedR += (1 - closed) * rOf(exit);
      const outcome: SignalOutcome = stage === 0 ? "SL" : stage === 1 ? "TP1" : "TP2";
      return { status: "resolved", outcome, pnlR: realizedR, tp2Hit };
    }
    if (reachedTp(c, tp3)) {
      if (!tp1Hit) { realizedR += THIRD * rOf(tp1); tp1Hit = true; }
      if (!tp2Hit) { realizedR += THIRD * rOf(tp2); tp2Hit = true; }
      realizedR += THIRD * rOf(tp3);
      return { status: "resolved", outcome: "TP3", pnlR: realizedR, tp2Hit };
    }
    if (!tp2Hit && reachedTp(c, tp2)) {
      if (!tp1Hit) { realizedR += THIRD * rOf(tp1); tp1Hit = true; closed += THIRD; }
      realizedR += THIRD * rOf(tp2); tp2Hit = true; closed += THIRD;
      stage = 2; stop = tp1; // igual ao motor
      continue;
    }
    if (!tp1Hit && reachedTp(c, tp1)) {
      realizedR += THIRD * rOf(tp1); tp1Hit = true; closed += THIRD;
      stage = 1; // ÚNICA MUDANÇA: stop permanece no SL inicial (sem breakeven)
      continue;
    }
  }
  if (future.length >= maxDuration) {
    const last = future[maxDuration - 1]!;
    realizedR += (1 - closed) * rOf(last.close);
    return { status: "resolved", outcome: "EXPIRED", pnlR: realizedR, tp2Hit };
  }
  return { status: "open", outcome: null, pnlR: null, tp2Hit };
}

/** IC 95% (percentil) da média por bootstrap pareado, determinístico. */
function bootstrapMeanCI(xs: number[], iterations = 2000, seed = 42): [number, number] {
  if (xs.length === 0) return [0, 0];
  const rng = mulberry32(seed);
  const means: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let s = 0;
    for (let k = 0; k < xs.length; k++) s += xs[Math.floor(rng() * xs.length)]!;
    means.push(s / xs.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * iterations)]!, means[Math.floor(0.975 * iterations)]!];
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.log("Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."); return; }
  // PostgREST direto via fetch (supabase-js puxa realtime, que exige WebSocket
  // nativo — indisponível no Node 20 local). Script read-only, service role.
  const select = "id,symbol,asset_type,timeframe,side,direction,entry,stop_loss,tp1,tp2,tp3,emitted_at,resolved_at,outcome,exit_price,pnl_r,engine,stop_stage";
  const res = await fetch(`${url}/rest/v1/signals?select=${select}&order=emitted_at.asc&limit=5000`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) { console.log("erro na query:", res.status, (await res.text()).slice(0, 300)); return; }
  const rows = (await res.json()) as Row[];
  const resolved = rows.filter((r) => r.outcome != null);
  console.log(`\n=== Contrafactual do breakeven pós-TP1 + heat simultâneo ===`);
  console.log(`Sinais no banco: ${rows.length} (${resolved.length} resolvidos, ${rows.length - resolved.length} abertos)`);

  // ---------- Parte 1: fração de TP1 mortos no breakeven (só banco) ----------
  const tp1s = resolved.filter((r) => r.outcome === "TP1");
  const beDead = tp1s.filter((r) => r.stop_stage === "breakeven" || (r.exit_price != null && Math.abs(r.exit_price - r.entry) <= Math.abs(r.entry) * 1e-9));
  const pct = (n: number, d: number): string => (d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "—");
  console.log(`\n--- Parte 1 · TP1 mortos no breakeven (dados já gravados) ---`);
  console.log(`Outcome TP1: ${tp1s.length} · mortos no BE (exit==entry): ${beDead.length} (${pct(beDead.length, tp1s.length)} dos TP1)`);
  if (tp1s.length > 0) {
    const avgTp1R = tp1s.reduce((s, r) => s + Number(r.pnl_r ?? 0), 0) / tp1s.length;
    console.log(`R médio dos TP1: ${avgTp1R.toFixed(3)} (o "win" modal paga ~+0.5R vs perda cheia de −1R)`);
  }
  const perEngineBe = new Map<string, { tp1: number; be: number }>();
  for (const r of tp1s) {
    const e = r.engine ?? "padrao";
    const c = perEngineBe.get(e) ?? { tp1: 0, be: 0 };
    c.tp1++;
    if (beDead.includes(r)) c.be++;
    perEngineBe.set(e, c);
  }
  for (const [e, c] of [...perEngineBe.entries()].sort((a, b) => b[1].tp1 - a[1].tp1)) {
    console.log(`  ${e.padEnd(16)} TP1=${String(c.tp1).padStart(3)} · BE=${String(c.be).padStart(3)} (${pct(c.be, c.tp1)})`);
  }

  // ---------- Parte 2: replay contrafactual (breakeven só após TP2) ----------
  console.log(`\n--- Parte 2 · Replay contrafactual (regra atual vs "BE só após TP2") ---`);
  const providers = realProviders({ twelveDataKey: process.env.TWELVEDATA_API_KEY });
  const candleCache = new Map<string, Candle[] | null>();
  const fetchSeries = async (r: Row): Promise<Candle[] | null> => {
    const k = `${r.symbol}|${r.timeframe}`;
    if (candleCache.has(k)) return candleCache.get(k)!;
    let out: Candle[] | null = null;
    try {
      out = r.asset_type === "crypto"
        ? await fetchBinanceHistory(r.symbol, r.timeframe as Timeframe, 2000, jsonFetcher)
        : await getCandles(r.symbol, r.asset_type as AssetType, r.timeframe as Timeframe, r.timeframe === "1d" ? 2000 : 3000, { providers, minCandles: 30 });
    } catch { out = null; }
    candleCache.set(k, out);
    return out;
  };

  let covered = 0, uncovered = 0, stillOpen = 0;
  const deltas: number[] = [];
  let sumA = 0, sumB = 0;
  let beDeathsCovered = 0, beWouldReachTp2 = 0, beFullStop = 0, beOther = 0;
  for (const r of resolved) {
    const candles = await fetchSeries(r);
    const emittedMs = Date.parse(r.emitted_at);
    if (!candles || candles.length === 0 || candles[0]!.time > emittedMs) { uncovered++; continue; }
    const tfMs = isTimeframe(r.timeframe) ? TIMEFRAME_MS[r.timeframe] : 0;
    const future = candles.filter((c) => c.time > emittedMs - tfMs);
    const plan: SignalPlan = {
      side: r.side === "sell" ? "sell" : "buy",
      entry: r.entry, stopLoss: r.stop_loss, takeProfit1: r.tp1, takeProfit2: r.tp2, takeProfit3: r.tp3,
    };
    const maxDuration = (isTimeframe(r.timeframe) ? MAX_DURATION_BY_TF[r.timeframe as Timeframe] : undefined) ?? DEFAULT_MAX_DURATION;
    const a = resolveLifecycle(plan, future, maxDuration);        // regra ATUAL (motor)
    const b = resolveLifecycleBeAfterTp2(plan, future, maxDuration); // contrafactual
    if (a.status !== "resolved" || b.status !== "resolved" || a.pnlR == null || b.pnlR == null) { stillOpen++; continue; }
    covered++;
    sumA += a.pnlR;
    sumB += b.pnlR;
    deltas.push(b.pnlR - a.pnlR);
    // subset: morte no BE sob a regra atual — o que teria acontecido sem o BE?
    if (a.outcome === "TP1" && a.stopStage === "breakeven") {
      beDeathsCovered++;
      if (b.tp2Hit) beWouldReachTp2++;
      else if (b.outcome === "TP1") beFullStop++; // 1/3 TP1 + 2/3 SL cheio
      else beOther++;
    }
  }
  console.log(`Cobertura do replay: ${covered}/${resolved.length} resolvidos (${uncovered} sem candles na janela do provider, ${stillOpen} não fecham no replay)`);
  if (covered > 0) {
    const avgA = sumA / covered;
    const avgB = sumB / covered;
    const dMean = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const [lo, hi] = bootstrapMeanCI(deltas);
    console.log(`avgR regra ATUAL (replay):        ${avgA.toFixed(3)}R`);
    console.log(`avgR contrafactual (BE após TP2): ${avgB.toFixed(3)}R`);
    console.log(`ΔavgR (contrafactual − atual):    ${dMean >= 0 ? "+" : ""}${dMean.toFixed(3)}R · IC95 bootstrap [${lo.toFixed(3)}, ${hi.toFixed(3)}] · n=${deltas.length}`);
    console.log(`\nMortes no BE cobertas: ${beDeathsCovered} — teriam alcançado TP2: ${beWouldReachTp2} (${pct(beWouldReachTp2, beDeathsCovered)}) · virariam 1/3TP1+2/3SL: ${beFullStop} · outros: ${beOther}`);
    console.log(beDeathsCovered >= 30
      ? "Gate de amostra (≥30 mortes-no-BE): ATINGIDO — o ΔavgR acima é utilizável."
      : `Gate de amostra (≥30 mortes-no-BE): NÃO atingido (${beDeathsCovered}) — NÃO decidir ainda; repetir quando acumular.`);
  }

  // ---------- Parte 3: heat simultâneo por motor (achado 9, camada 1) ----------
  console.log(`\n--- Parte 3 · maxConcurrentHeat por motor (sweep-line, inclui abertos) ---`);
  const engines = [...new Set(rows.map((r) => r.engine ?? "padrao"))].sort();
  console.log("motor".padEnd(18) + "sinais".padStart(7) + "heat máx".padStart(10) + "posições".padStart(10) + "heat agora".padStart(12) + "  pico em");
  let worst = 0;
  for (const e of engines) {
    const h = computeHeat(rows.filter((r) => (r.engine ?? "padrao") === e)
      .map((r) => ({ emittedAt: r.emitted_at, resolvedAt: r.resolved_at, direction: r.direction })));
    worst = Math.max(worst, h.maxConcurrentHeat);
    console.log(
      e.padEnd(18) + String(rows.filter((r) => (r.engine ?? "padrao") === e).length).padStart(7) +
      `${(h.maxConcurrentHeat * 100).toFixed(0)}%`.padStart(10) + String(h.maxConcurrentPositions).padStart(10) +
      `${(h.currentHeat * 100).toFixed(0)}%`.padStart(12) + `  ${h.maxAt?.slice(0, 16) ?? "—"}`,
    );
  }
  console.log(`\nGate pré-registrado (achado 9): heat máx <15% → achado morre; ≥20-40% → camada 2 (teto pro rata / risco-0) entra em pauta.`);
  console.log(`Pior heat observado entre os motores: ${(worst * 100).toFixed(0)}%\n`);
}

main().catch((e) => { console.error("erro:", e instanceof Error ? e.message : e); process.exit(1); });
