import type { CSSProperties } from "react";

/** Ícone do ativo — círculo (ou quadrado p/ índices) colorido por símbolo. Presentational. */
const GLYPH: Record<string, { g: string; grad: string; sq?: boolean }> = {
  BTCUSDT: { g: "₿", grad: "linear-gradient(135deg,#f7931a,#ffbf6b)" },
  ETHUSDT: { g: "◈", grad: "linear-gradient(135deg,#8a8bff,#b08bff)" },
  SOLUSDT: { g: "◎", grad: "linear-gradient(135deg,#14f195,#9945ff)" },
  BNBUSDT: { g: "B", grad: "linear-gradient(135deg,#f3ba2f,#d99a1c)" },
  XRPUSDT: { g: "✕", grad: "linear-gradient(135deg,#4a5a78,#222a3a)" },
  ADAUSDT: { g: "₳", grad: "linear-gradient(135deg,#3468d1,#54a8ff)" },
  DOGEUSDT: { g: "Ð", grad: "linear-gradient(135deg,#c2a633,#e3c75a)" },
  EURUSD: { g: "€", grad: "linear-gradient(135deg,#2bd49e,#1f9d74)" },
  GBPUSD: { g: "£", grad: "linear-gradient(135deg,#a98bff,#7b6cff)" },
  USDJPY: { g: "¥", grad: "linear-gradient(135deg,#ff6b8a,#ff9aae)" },
  AUDUSD: { g: "$", grad: "linear-gradient(135deg,#2bd49e,#1f9d74)" },
  USDCAD: { g: "$", grad: "linear-gradient(135deg,#ff6b6b,#e23b3b)" },
  XAUUSD: { g: "Au", grad: "linear-gradient(135deg,#ffd24a,#caa01c)" },
  DJI: { g: "DJI", grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true },
  NDX: { g: "NDX", grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true },
  SPX: { g: "S&P", grad: "linear-gradient(135deg,#8a8bff,#5b5cff)", sq: true },
};

export function AssetGlyph({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const it = GLYPH[symbol] ?? { g: symbol.replace(/USDT$|USD$/i, "").slice(0, 3) || symbol.slice(0, 3), grad: "linear-gradient(135deg,#3a4a66,#222a3a)", sq: true };
  const style: CSSProperties = {
    background: it.grad,
    width: size,
    height: size,
    borderRadius: it.sq ? Math.round(size * 0.28) : "50%",
    fontSize: Math.round(size * (it.sq ? 0.34 : 0.46)),
  };
  return <span className={`aglyph${it.sq ? " sq" : ""}`} style={style} aria-hidden>{it.g}</span>;
}
