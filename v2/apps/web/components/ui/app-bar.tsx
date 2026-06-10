import { Logo } from "./logo";
import { Chip } from "./chip";
import { UserMenu } from "../user-menu";
import { AlertsNavBadge } from "../alerts-nav-badge";
import { isAdminEmail } from "@/lib/admin";

export type NavKey = "dashboard" | "analise" | "ao-vivo" | "monitor" | "historico" | "alertas" | "track-record";

const ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "analise", label: "Análise", href: "/analise" },
  { key: "ao-vivo", label: "Trading ao vivo", href: "/ao-vivo" },
  { key: "monitor", label: "Monitor", href: "/monitor" },
  { key: "track-record", label: "Track record", href: "/track-record" },
  { key: "historico", label: "Histórico", href: "/historico" },
  { key: "alertas", label: "Alertas", href: "/alertas" },
];

/** Ícone por item de navegação (stroke 1.7, grid 24). */
function NavIcon({ k }: { k: NavKey }) {
  const p = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (k) {
    case "dashboard": return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "analise": return <svg {...p}><path d="M4 19V5M4 19h16" /><path d="m7 14 3-3 3 2 4-6" /></svg>;
    case "ao-vivo": return <svg {...p}><path d="M7 4v3M7 14v3M17 6v2M17 16v2" /><rect x="5" y="7" width="4" height="7" rx="1" /><rect x="15" y="8" width="4" height="8" rx="1" /></svg>;
    case "monitor": return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></svg>;
    case "track-record": return <svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
    case "historico": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "alertas": return <svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
  }
}
const CoinsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="9" cy="6" rx="6" ry="2.6" /><path d="M3 6v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V6" /><path d="M9 13.6V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5c0-1.3-2.3-2.4-5.3-2.6" />
  </svg>
);
const ChevIcon = () => (
  <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
);

/** App-bar superior sticky compartilhada pelas telas. Mostra créditos/plano +
 *  menu do usuário quando logado (`email` presente); senão, um link "Entrar". */
export function AppBar({
  active,
  credits,
  plan,
  initials,
  email,
}: {
  active?: NavKey;
  credits?: number;
  plan?: string;
  initials?: string;
  email?: string;
}) {
  return (
    <>
    <header className="appbar">
      <div className="wrap row">
        <div className="brand">
          <Logo size={28} />
          <span className="name">Overtrader</span>
          <span className="ia">IA</span>
        </div>
        <nav className="nav">
          {ITEMS.map((it) => (
            <a key={it.key} className={it.key === active ? "on" : undefined} href={it.href}>
              <NavIcon k={it.key} />
              <span className="nav-lbl">{it.label}</span>
              {it.key === "alertas" ? <AlertsNavBadge /> : null}
            </a>
          ))}
        </nav>
        <div className="ab-right">
          {typeof credits === "number" ? (
            <details className="cred">
              <summary className="cred-btn" title="Meus créditos">
                <span className="cred-coin"><CoinsIcon /></span>
                <span className="cred-txt"><b className="am">{credits.toLocaleString("pt-BR")}</b><span className="cred-lbl">créditos</span></span>
                <ChevIcon />
              </summary>
              <div className="cred-pop">
                <div className="cred-bal"><b>{credits.toLocaleString("pt-BR")}</b> créditos disponíveis</div>
                <a className="cred-item" href="/creditos">Comprar créditos</a>
                <a className="cred-item" href="/historico">Histórico de uso</a>
                <a className="cred-item" href="/planos">Planos &amp; assinatura</a>
              </div>
            </details>
          ) : null}
          {plan ? <Chip variant="plan">{plan}</Chip> : null}
          {email ? (
            <UserMenu initials={initials ?? "?"} email={email} isAdmin={isAdminEmail(email)} />
          ) : (
            <a className="btn ghost" href="/login">Entrar</a>
          )}
        </div>
      </div>
    </header>
    <div className="risk-strip">
      <div className="wrap">
        Conteúdo educativo · <b>não é recomendação de investimento</b> · toda operação envolve risco de perda · resultados passados não garantem resultados futuros · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a>
      </div>
    </div>
    </>
  );
}
