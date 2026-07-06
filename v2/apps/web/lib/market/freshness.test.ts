import { describe, expect, it } from "vitest";
import type { Candle } from "@tradeai/shared";
import { dropFormingCandles, isStaleForEmission } from "./freshness";

const H = 60 * 60_000;

function candleAt(time: number): Candle {
  return { time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };
}

describe("dropFormingCandles", () => {
  const series = [candleAt(0), candleAt(4 * H), candleAt(8 * H)];

  it("descarta o candle em formação (open + tf > now)", () => {
    // now = 8h + 30s → o candle das 8h ainda está aberto
    const out = dropFormingCandles(series, "4h", 8 * H + 30_000);
    expect(out).toHaveLength(2);
    expect(out.at(-1)!.time).toBe(4 * H);
  });

  it("preserva o candle já fechado (open + tf <= now)", () => {
    const out = dropFormingCandles(series, "4h", 12 * H);
    expect(out).toHaveLength(3);
  });

  it("série vazia não quebra", () => {
    expect(dropFormingCandles([], "4h", 12 * H)).toEqual([]);
  });

  it("não muta a série original", () => {
    dropFormingCandles(series, "4h", 8 * H + 1);
    expect(series).toHaveLength(3);
  });
});

describe("isStaleForEmission (frescor pelo CLOSE esperado)", () => {
  it("cripto 4h recém-fechado é fresco", () => {
    // último fechado abriu às 20h, fechou às 24h; now = 24h + 30s
    expect(isStaleForEmission(20 * H, "4h", "crypto", 24 * H + 30_000)).toBe(false);
  });

  it("cripto 4h com close esperado a mais de 0.5×tf → stale (provider degradado)", () => {
    // fechou às 24h; now = 27h → 3h além do close > 2h (0.5×tf)
    expect(isStaleForEmission(20 * H, "4h", "crypto", 27 * H)).toBe(true);
  });

  it("SPX 4h no tick fantasma da madrugada → stale", () => {
    // último 4h fechou ~20h UTC; cron das 04h do dia seguinte = 8h além do close
    expect(isStaleForEmission(16 * H, "4h", "indices", 28 * H)).toBe(true);
  });

  it("1d NÃO-cripto tem +48h de tolerância (segunda-feira não é falso positivo)", () => {
    // candle de sexta carimbado na abertura (t=0); segunda 16h = 64h depois.
    // Idade além do close (24h) = 40h — dentro de 12h + 48h = 60h → fresco.
    expect(isStaleForEmission(0, "1d", "indices", 64 * H)).toBe(false);
    // Quarta-feira sem candle novo (72h além do close) → stale de verdade.
    expect(isStaleForEmission(0, "1d", "indices", 24 * H + 61 * H)).toBe(true);
  });

  it("1d cripto NÃO ganha tolerância de fim de semana", () => {
    // fechou às 24h; now = 24h + 13h → 13h além do close > 12h (0.5×tf)
    expect(isStaleForEmission(0, "1d", "crypto", 37 * H)).toBe(true);
    expect(isStaleForEmission(0, "1d", "crypto", 35 * H)).toBe(false);
  });
});
