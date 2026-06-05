"use client";

/**
 * Tabs simples acessível (sem Radix para ficar enxuto).
 * Pode trocar por @radix-ui/react-tabs futuramente se quiser.
 */
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface Tab {
  id: string;
  label: string;
  badge?: string;
}

interface Props {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
}

export function ResultTabs({ tabs, defaultTab, children }: Props) {
  const [active, setActive] = useState(defaultTab ?? tabs[0].id);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Abas de análise"
        className="flex overflow-x-auto gap-1 border-b border-border/40 pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`tabpanel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-0",
              active === t.id
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {t.label}
            {t.badge && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-card border border-border/60 text-muted-foreground">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {children(active)}
      </div>
    </div>
  );
}
