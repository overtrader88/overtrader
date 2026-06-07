"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ENGINES, type EngineId } from "@/lib/analysis/engines";

/** Alterna Motor 1 (padrão) ⇄ Motor 2 (por classe) via ?engine=, preservando o resto. */
export function EngineSelector({ active }: { active: EngineId }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(id: EngineId) {
    if (id === active) return;
    const next = new URLSearchParams(params?.toString() ?? "");
    if (id === "padrao") next.delete("engine");
    else next.set("engine", id);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="engine-switch" role="group" aria-label="Motor de análise" title="Motor de análise">
      {ENGINES.map((e) => (
        <button
          key={e.id}
          type="button"
          className={e.id === active ? "on" : undefined}
          onClick={() => choose(e.id)}
          aria-pressed={e.id === active}
          title={e.hint}
        >
          {e.id === "classe" ? "⚙ Por classe" : "Padrão"}
        </button>
      ))}
    </div>
  );
}
