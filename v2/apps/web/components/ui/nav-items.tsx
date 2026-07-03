/** Itens + ícones da navegação principal — compartilhados pelo AppBar (desktop)
 *  e pelo MobileNav (menu hambúrguer). Puro/presentational. */
export type NavKey = "dashboard" | "analise" | "posicao" | "ao-vivo" | "monitor" | "historico" | "alertas" | "track-record" | "simulador";

export const NAV_ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "analise", label: "Análise", href: "/analise" },
  { key: "posicao", label: "Posição", href: "/posicao" },
  { key: "ao-vivo", label: "Trading ao vivo", href: "/ao-vivo" },
  { key: "monitor", label: "Monitor", href: "/monitor" },
  { key: "track-record", label: "Track record", href: "/track-record" },
  { key: "simulador", label: "Simulador", href: "/simulador" },
  { key: "historico", label: "Histórico", href: "/historico" },
  { key: "alertas", label: "Alertas", href: "/alertas" },
];

/** Ícone por item de navegação (stroke 1.7, grid 24). */
export function NavIcon({ k }: { k: NavKey }) {
  const p = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (k) {
    case "dashboard": return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "analise": return <svg {...p}><path d="M4 19V5M4 19h16" /><path d="m7 14 3-3 3 2 4-6" /></svg>;
    case "posicao": return <svg {...p}><path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="M8.5 12.5h2l1.5-3 1.5 5 1-2h1.5" /></svg>;
    case "ao-vivo": return <svg {...p}><path d="M7 4v3M7 14v3M17 6v2M17 16v2" /><rect x="5" y="7" width="4" height="7" rx="1" /><rect x="15" y="8" width="4" height="8" rx="1" /></svg>;
    case "monitor": return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></svg>;
    case "track-record": return <svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
    case "historico": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "alertas": return <svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
    case "simulador": return <svg {...p}><path d="M12 8v4l2.5 1.5" /><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M18 2v4h-4" /></svg>;
  }
}
