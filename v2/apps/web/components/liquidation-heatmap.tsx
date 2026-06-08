"use client";

import { useEffect, useState } from "react";

/**
 * Zonas de liquidação ESTIMADAS (modelo, NÃO ordens reais).
 *
 * Mesma técnica do CoinGlass: projeta onde posições alavancadas provavelmente
 * seriam liquidadas, a partir de preço+volume recentes (clusters de entrada) e
 * níveis de alavancagem (10x–100x). NÃO usa o feed real de liquidações (que a
 * Binance entrega capado a 1/seg/símbolo e sem histórico). É ESTIMATIVA honesta,
 * rotulada como tal — zero dado fictício, mas também não é medição.
 *
 * Roda NO NAVEGADOR (a Binance bloqueia IP de cloud da Vercel). Falha → nada.
 */
const FAPI = "https://fapi.binance.com";

// Distribuição de alavancagem assumida (perp cripto). Soma = 1.
const LEV = [
  { L: 10, f: 0.30 },
  { L: 25, f: 0.30 },
  { L: 50, f: 0.25 },
  { L: 100, f: 0.15 },
];
const BIN_PCT = 0.005; // bins de 0,5%
const RANGE_PCT = 0.18; // ±18% em torno do preço

interface Zone { price: number; pct: number; intensity: number; side: "long" | "short" }
interface Heat { above: Zone[]; below: Zone[]; price: number; oiNotional: number | null }

function toPerp(s: string): string | null {
  const x = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return x.endsWith("USDT") ? x : null;
}
const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
};
const fmtPrice = (p: number) => p.toLocaleString("pt-BR", { maximumFractionDigits: p >= 100 ? 2 : p >= 1 ? 4 : 6 });

export function LiquidationHeatmap({ symbol }: { symbol: string }) {
  const [heat, setHeat] = useState<Heat | null>(null);
  const [state, setState] = useState<"load" | "ok" | "off">("load");

  useEffect(() => {
    const sym = toPerp(symbol);
    if (!sym) { setState("off"); return; }
    let alive = true;
    (async () => {
      try {
        const [klines, prem, oi] = await Promise.all([
          fetch(`${FAPI}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=300`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${FAPI}/fapi/v1/premiumIndex?symbol=${sym}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${FAPI}/fapi/v1/openInterest?symbol=${sym}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (!Array.isArray(klines) || klines.length < 20) throw new Error("no klines");
        const last = klines[klines.length - 1] as unknown[];
        const P0 = num(prem?.markPrice) || num(last[4]);
        if (!(P0 > 0)) throw new Error("no price");

        // Acumula "peso de liquidação" por bin de preço relativo.
        const bins = new Map<number, { long: number; short: number }>();
        for (const k of klines as unknown[][]) {
          const close = num(k[4]);
          const qVol = num(k[7]); // volume em USD (quote asset volume)
          if (!(close > 0) || !(qVol > 0)) continue;
          for (const { L, f } of LEV) {
            const w = qVol * f * 0.5; // metade long, metade short (neutro)
            const longLiq = close * (1 - 1 / L);
            const shortLiq = close * (1 + 1 / L);
            const lp = (longLiq - P0) / P0;
            if (lp < 0 && lp >= -RANGE_PCT) {
              const idx = Math.round(lp / BIN_PCT);
              const b = bins.get(idx) ?? { long: 0, short: 0 }; b.long += w; bins.set(idx, b);
            }
            const sp = (shortLiq - P0) / P0;
            if (sp > 0 && sp <= RANGE_PCT) {
              const idx = Math.round(sp / BIN_PCT);
              const b = bins.get(idx) ?? { long: 0, short: 0 }; b.short += w; bins.set(idx, b);
            }
          }
        }
        const arr = [...bins.entries()].map(([idx, v]) => ({
          pct: idx * BIN_PCT,
          price: P0 * (1 + idx * BIN_PCT),
          intensity: v.long + v.short,
          side: (idx < 0 ? "long" : "short") as "long" | "short",
        }));
        if (arr.length === 0) throw new Error("no zones");
        const maxI = Math.max(1, ...arr.map((z) => z.intensity));
        const norm = arr.map((z) => ({ ...z, intensity: z.intensity / maxI })).filter((z) => z.intensity >= 0.08);
        const below = norm.filter((z) => z.pct < 0).sort((a, b) => b.intensity - a.intensity).slice(0, 4).sort((a, b) => b.price - a.price);
        const above = norm.filter((z) => z.pct > 0).sort((a, b) => b.intensity - a.intensity).slice(0, 4).sort((a, b) => a.price - b.price);
        const oiBase = oi ? num(oi.openInterest) : NaN;
        const oiNotional = Number.isFinite(oiBase) ? oiBase * P0 : null;

        if (!alive) return;
        setHeat({ above, below, price: P0, oiNotional });
        setState("ok");
      } catch {
        if (alive) setState("off");
      }
    })();
    return () => { alive = false; };
  }, [symbol]);

  if (state === "off") return null;
  if (state === "load" || !heat) {
    return (
      <div className="cls-deriv est">
        <div className="cd-h">Zonas de liquidação <span className="est-badge">estimativa</span></div>
        <p className="note" style={{ margin: 0 }}>Calculando zonas estimadas…</p>
      </div>
    );
  }

  const Row = (z: Zone) => (
    <div className={`liqz-row ${z.side}`} key={`${z.side}-${z.pct}`}>
      <span className="px">{fmtPrice(z.price)}</span>
      <span className="liqz-bar"><i style={{ width: `${Math.max(6, z.intensity * 100)}%` }} /></span>
      <span className="dist">{z.pct >= 0 ? "+" : ""}{(z.pct * 100).toFixed(1)}%</span>
    </div>
  );

  return (
    <div className="cls-deriv est">
      <div className="cd-h">Zonas de liquidação <span className="est-badge">estimativa · modelo</span></div>

      {heat.above.length > 0 && <div className="liqz-sub up">↑ Liquidação de SHORTS · gatilho de alta</div>}
      <div className="liqz">{heat.above.map(Row)}</div>

      <div className="liqz-now">— preço atual {fmtPrice(heat.price)} —</div>

      {heat.below.length > 0 && <div className="liqz-sub dn">↓ Liquidação de LONGS · gatilho de queda</div>}
      <div className="liqz">{heat.below.map(Row)}</div>

      {heat.oiNotional != null && (
        <p className="note" style={{ margin: "8px 0 0" }}>Open Interest atual ≈ ${(heat.oiNotional / 1e9).toFixed(2)}B.</p>
      )}
      <p className="note" style={{ margin: "4px 0 0" }}>
        <b>Estimativa</b>, não ordens reais: projeção de onde posições alavancadas (10x–100x) provavelmente seriam liquidadas,
        a partir de preço+volume recentes. Mesma técnica do CoinGlass. Zonas densas tendem a funcionar como <b>ímãs</b>. Não é
        medição — use como mapa de risco, não como gatilho isolado.
      </p>
    </div>
  );
}
