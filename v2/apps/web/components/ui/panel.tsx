import type { ReactNode } from "react";

/** Painel base do design system (superfície escura + hairline frio). */
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel${className ? ` ${className}` : ""}`}>{children}</section>;
}

/** Rótulo de seção dentro de um painel (mono + dot cyan + régua). */
export function PanelLabel({
  children,
  more,
  moreHref = "#",
}: {
  children: ReactNode;
  more?: ReactNode;
  moreHref?: string;
}) {
  return (
    <div className="label">
      <span>{children}</span>
      <span className="tail" />
      {more ? (
        <a className="more" href={moreHref}>
          {more}
        </a>
      ) : null}
    </div>
  );
}
