"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Bell icon no header com badge de unread count.
 * Polla /api/alerts a cada 90s pra evitar carga (e nao tornar evidente que
 * nao temos realtime ainda).
 */
export function BellBadge() {
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/alerts?unread_only=true&limit=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setUnread(data.unreadCount ?? 0);
        setLoaded(true);
      } catch {
        // silencia
      }
    }

    fetchUnread();
    const id = setInterval(fetchUnread, 90_000);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <Link
      href="/dashboard/alertas"
      aria-label={`Alertas${unread > 0 ? ` (${unread} novos)` : ""}`}
      className="relative inline-flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[44px] min-w-[44px]"
    >
      <Bell className="h-4 w-4" />
      {loaded && unread > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums leading-none"
          )}
          aria-hidden
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
