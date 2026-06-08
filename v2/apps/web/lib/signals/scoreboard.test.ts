import { describe, it, expect } from "vitest";
import { formatScoreboard, type Scoreboard, type ClosedOp } from "./scoreboard";

const sb: Scoreboard = {
  totalClosed: 12,
  lines: [
    { engine: "padrao", label: "Motor 1 (padrão)", take: 6, stop: 3, expired: 0, decisive: 9, ops: 9, open: 8, winPct: 66.67, totalR: 4.2 },
    { engine: "classe", label: "Motor 2 (classe)", take: 2, stop: 1, expired: 0, decisive: 3, ops: 3, open: 5, winPct: 66.67, totalR: -0.5 },
  ],
};

describe("formatScoreboard", () => {
  it("monta o placar com Take/Stop/%/ops/R dos dois motores", () => {
    const out = formatScoreboard(sb, null);
    expect(out).toContain("PLACAR DOS MOTORES");
    expect(out).toContain("Motor 1 (padrão)");
    expect(out).toContain("6 Take");
    expect(out).toContain("3 Stop");
    expect(out).toContain("67%");
    expect(out).toContain("+4.2R");
    expect(out).toContain("Motor 2 (classe)");
    expect(out).toContain("-0.5R");
  });

  it("inclui a última operação fechada com direção, resultado e motor", () => {
    const last: ClosedOp = { engine: "classe", symbol: "BTCUSDT", timeframe: "4h", side: "sell", outcome: "SL", pnlR: -1 };
    const out = formatScoreboard(sb, last);
    expect(out).toContain("Última fechada");
    expect(out).toContain("BTCUSDT 4H");
    expect(out).toContain("Venda");
    expect(out).toContain("STOP");
    expect(out).toContain("Motor 2");
    expect(out).toContain("🔴");
  });

  it("não aponta líder com amostra fraca", () => {
    const weak: Scoreboard = { ...sb, lines: [
      { ...sb.lines[0]!, decisive: 1, winPct: 100 },
      { ...sb.lines[1]!, decisive: 1, winPct: 0 },
    ] };
    expect(formatScoreboard(weak, null)).not.toContain("Liderando");
  });
});
