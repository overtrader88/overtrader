/**
 * Volume Profile (perfil de volume por preço) — PURO. Distribui o volume de cada
 * candle pelas faixas de preço que ele cobre e identifica:
 *   - POC (Point of Control): faixa de maior volume
 *   - VAH/VAL (Value Area High/Low): limites da área que concentra ~70% do volume
 * É observado (não probabilístico). Volume 0 (ex.: forex free) → retorna null.
 */
import type { Candle } from "@tradeai/shared";

export interface VolumeBin { price: number; volume: number; }
export interface VolumeProfile {
  bins: VolumeBin[];
  poc: number;
  vah: number;
  val: number;
  binSize: number;
}

export function computeVolumeProfile(candles: Candle[], binCount = 24): VolumeProfile | null {
  if (candles.length < 10) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of candles) { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; }
  if (!(hi > lo)) return null;

  const binSize = (hi - lo) / binCount;
  const vol = new Array<number>(binCount).fill(0);
  for (const c of candles) {
    const v = c.volume || 0;
    if (v <= 0) continue;
    const loI = Math.max(0, Math.min(binCount - 1, Math.floor((c.low - lo) / binSize)));
    const hiI = Math.max(0, Math.min(binCount - 1, Math.floor((c.high - lo) / binSize)));
    const span = hiI - loI + 1;
    const per = v / span;
    for (let i = loI; i <= hiI; i++) vol[i]! += per;
  }

  const total = vol.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  let pocI = 0;
  for (let i = 1; i < binCount; i++) if (vol[i]! > vol[pocI]!) pocI = i;

  // Área de valor: expande do POC pegando sempre o vizinho de maior volume até 70%.
  let loI = pocI, hiI = pocI, acc = vol[pocI]!;
  while (acc < total * 0.7 && (loI > 0 || hiI < binCount - 1)) {
    const below = loI > 0 ? vol[loI - 1]! : -1;
    const above = hiI < binCount - 1 ? vol[hiI + 1]! : -1;
    if (above >= below) { hiI++; acc += vol[hiI]!; } else { loI--; acc += vol[loI]!; }
  }

  const priceOf = (i: number) => lo + (i + 0.5) * binSize;
  return {
    bins: vol.map((v, i) => ({ price: priceOf(i), volume: v })),
    poc: priceOf(pocI),
    vah: lo + (hiI + 1) * binSize,
    val: lo + loI * binSize,
    binSize,
  };
}
