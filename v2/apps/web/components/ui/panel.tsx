import type { CSSProperties, ReactNode } from "react";

/** Painel base do design system (superfície escura + hairline frio). */
export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return <section className={`panel${className ? ` ${className}` : ""}`} style={style}>{children}</section>;
}

/** Rótulo de seção dentro de um painel (mono + dot cyan + régua). */
export function PanelLabel({
  children,
  more,
  moreHref,
}: {
  children: ReactNode;
  more?: ReactNode;
  moreHref?: string;
}) {
  const hasLink = !!moreHref && moreHref !== "#";
  return (
    <div className="label">
      <span>{children}</span>
      <span className="tail" />
      {more ? (
        hasLink ? (
          <a className="more" href={moreHref}>
            {more}
          </a>
        ) : (
          // sem destino real → texto, nunca um link morto pra "#"
          <span className="more" style={{ opacity: 0.6, cursor: "default" }}>{more}</span>
        )
      ) : null}
    </div>
  );
}
