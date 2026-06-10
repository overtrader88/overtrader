import { Logo } from "./logo";
import { Chip } from "./chip";
import { UserMenu } from "../user-menu";
import { AlertsNavBadge } from "../alerts-nav-badge";
import { MobileNav } from "./mobile-nav";
import { NAV_ITEMS, NavIcon, type NavKey } from "./nav-items";
import { isAdminEmail } from "@/lib/admin";

export type { NavKey };

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
          {NAV_ITEMS.map((it) => (
            <a key={it.key} className={it.key === active ? "on" : undefined} href={it.href}>
              <NavIcon k={it.key} />
              <span className="nav-lbl">{it.label}</span>
              {it.key === "alertas" ? <AlertsNavBadge /> : null}
            </a>
          ))}
        </nav>
        <div className="ab-right">
          <MobileNav active={active} />
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
