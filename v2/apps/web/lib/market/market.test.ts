import { describe, expect, it } from "vitest";
import { binanceSymbol, twelveDataSymbol, yahooSymbol, BINANCE_INTERVAL, TWELVEDATA_INTERVAL, YAHOO_INTERVAL } from "./symbols";
import { parseBinanceKlines, parseTwelveData, parseYahooChart } from "./parse";

describe("symbols", () => {
  it("mapeia símbolos por provedor", () => {
    expect(binanceSymbol("btcusdt")).toBe("BTCUSDT");
    expect(twelveDataSymbol("EURUSD", "forex")).toBe("EUR/USD");
    expect(twelveDataSymbol("XAUUSD", "commodities")).toBe("XAU/USD");
    expect(twelveDataSymbol("AAPL", "stocks")).toBe("AAPL");
    expect(yahooSymbol("BTCUSDT", "crypto")).toBe("BTC-USD");
    expect(yahooSymbol("EURUSD", "forex")).toBe("EURUSD=X");
    expect(yahooSymbol("XAUUSD", "commodities")).toBe("GC=F");
    expect(yahooSymbol("SPX", "indices")).toBe("^GSPC");
  });

  it("intervalos cobrem os 6 timeframes", () => {
    for (const tf of ["15m", "1h", "4h", "1d", "1w", "1M"] as const) {
      expect(BINANCE_INTERVAL[tf]).toBeTruthy();
      expect(TWELVEDATA_INTERVAL[tf]).toBeTruthy();
      expect(YAHOO_INTERVAL[tf]).toBeTruthy();
    }
  });
});

describe("parseBinanceKlines", () => {
  it("converte klines em candles ascendentes", () => {
    const payload = [
      [1700000000000, "100", "105", "99", "104", "12.5", 1700003599999],
      [1700003600000, "104", "110", "103", "108", "9.1", 1700007199999],
    ];
    const c = parseBinanceKlines(payload);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ time: 1700000000000, open: 100, high: 105, low: 99, close: 104, volume: 12.5 });
    expect(c[1]!.time).toBeGreaterThan(c[0]!.time);
  });
  it("payload inválido → vazio", () => {
    expect(parseBinanceKlines(null)).toEqual([]);
    expect(parseBinanceKlines([[1, "x"]])).toEqual([]);
  });
});

describe("parseTwelveData", () => {
  it("reverte para ascendente e parseia datas", () => {
    const payload = {
      status: "ok",
      values: [
        { datetime: "2023-11-15 10:00:00", open: "1.05", high: "1.06", low: "1.04", close: "1.055", volume: "0" },
        { datetime: "2023-11-15 09:00:00", open: "1.04", high: "1.05", low: "1.03", close: "1.05", volume: "0" },
      ],
    };
    const c = parseTwelveData(payload);
    expect(c).toHaveLength(2);
    expect(c[0]!.time).toBeLessThan(c[1]!.time); // ascendente após reverter
    expect(c[1]!.close).toBeCloseTo(1.055, 6);
  });
});

describe("parseYahooChart", () => {
  it("monta candles e pula nulls", () => {
    const payload = {
      chart: { result: [{
        timestamp: [1700000000, 1700003600, 1700007200],
        indicators: { quote: [{ open: [100, null, 108], high: [105, null, 112], low: [99, null, 107], close: [104, null, 110], volume: [10, null, 8] }] },
      }] },
    };
    const c = parseYahooChart(payload);
    expect(c).toHaveLength(2); // candle do meio (null) pulado
    expect(c[0]).toMatchObject({ time: 1700000000000, close: 104 });
  });
});
