"use client";

import { useState } from "react";
import { NAV_ITEMS, NavIcon, type NavKey } from "./nav-items";
import { AlertsNavBadge } from "../alerts-nav-badge";

/** Menu de navegação no mobile (≤980px): botão hambúrguer + painel com os links.
 *  No desktop fica oculto (CSS) — lá a nav inline é usada. */
export function MobileNav({ active }: { active?: NavKey }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="appbar-burger" aria-label="Menu de navegação" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 6 12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>
      {open ? (
        <>
          <button type="button" className="mnav-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <nav className="mnav-panel" aria-label="Navegação">
            {NAV_ITEMS.map((it) => (
              <a key={it.key} href={it.href} className={`mnav-item${it.key === active ? " on" : ""}`} onClick={() => setOpen(false)}>
                <NavIcon k={it.key} />
                <span>{it.label}</span>
                {it.key === "alertas" ? <AlertsNavBadge /> : null}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </>
  );
}
