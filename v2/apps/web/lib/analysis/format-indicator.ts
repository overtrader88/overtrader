/**
 * Formata o valor de um indicador do motor para exibição. PURO.
 * O valor pode ser número simples, objeto composto (MACD/Bollinger/Stoch/ADX)
 * ou NULL/indisponível (ex.: VWMA em ativo sem volume — forex/commodities/índices).
 */
export function fmtIndicatorValue(v: number | Record<string, number> | null | undefined): string {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1000) return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    if (a >= 1) return v.toFixed(2);
    return v.toPrecision(3);
  }
  // valor indisponível → traço (NUNCA chamar Object.values(null): crash)
  if (v == null || typeof v !== "object") return "—";
  // composto → mostra o 1º número relevante
  const nums = Object.values(v).filter((n) => Number.isFinite(n));
  return nums.length ? (Math.abs(nums[0]!) >= 1 ? nums[0]!.toFixed(2) : nums[0]!.toPrecision(3)) : "·";
}
