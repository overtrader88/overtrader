import type { ReactNode } from "react";

/** Chip de telemetria (créditos, plano, status). */
export function Chip({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "plan";
}) {
  return <span className={`chip${variant ? ` ${variant}` : ""}`}>{children}</span>;
}
