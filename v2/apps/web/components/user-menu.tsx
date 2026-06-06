"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Avatar + popover com e-mail, link de planos e logout. */
export function UserMenu({ initials, email, isAdmin }: { initials: string; email: string; isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await supabaseBrowser().auth.signOut();
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="usermenu">
      <button type="button" className="avatar" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title={email}>
        {initials}
      </button>
      {open ? (
        <>
          <button type="button" className="usermenu-scrim" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="usermenu-pop" role="menu">
            <div className="um-email" title={email}>{email}</div>
            <a className="um-item" href="/planos" role="menuitem">Planos &amp; créditos</a>
            {isAdmin ? <a className="um-item" href="/admin" role="menuitem">Admin</a> : null}
            <button type="button" className="um-item danger" onClick={signOut} disabled={busy} role="menuitem">
              {busy ? "Saindo…" : "Sair"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
