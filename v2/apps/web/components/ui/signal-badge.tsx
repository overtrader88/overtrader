import type { ReactNode } from "react";

export type SignalDir = "buy" | "sell" | "neu";

/** Etiqueta de direção do sinal (compra/venda/neutro). */
export function SignalBadge({
  direction,
  children,
}: {
  direction: SignalDir;
  children: ReactNode;
}) {
  return <span className={`signal-badge ${direction}`}>{children}</span>;
}
