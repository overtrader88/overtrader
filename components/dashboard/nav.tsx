"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LineChart,
  LayoutDashboard,
  History,
  Menu,
  X,
  Crown,
  CreditCard,
  Bell,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analise", label: "Análise", icon: LineChart },
  { href: "/dashboard/historico", label: "Histórico", icon: History },
  { href: "/dashboard/alertas", label: "Alertas", icon: Bell },
  { href: "/dashboard/assinatura", label: "Minha conta", icon: CreditCard },
  { href: "/planos", label: "Planos", icon: Crown },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav (inline no header) */}
      <nav className="hidden md:flex items-center gap-1" aria-label="Navegação principal">
        {ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-2 h-10 px-3 rounded-lg text-sm font-medium transition-colors min-h-0",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile button (mostra/esconde drawer) */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden absolute top-16 left-0 right-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl overflow-hidden transition-all duration-200",
          open ? "max-h-96" : "max-h-0"
        )}
      >
        <nav className="container-fluid py-3 flex flex-col gap-1" aria-label="Navegação móvel">
          {ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 min-h-[44px] px-4 rounded-lg text-base font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
