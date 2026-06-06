import { Logo } from "./logo";
import { Chip } from "./chip";
import { UserMenu } from "../user-menu";
import { AlertsNavBadge } from "../alerts-nav-badge";

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
              {it.label}
              {it.key === "alertas" ? <AlertsNavBadge /> : null}
            </a>
          ))}
        </nav>
        <div className="ab-right">
          {typeof credits === "number" ? (
            <Chip>
              <b className="am">{credits}</b> créditos
            </Chip>
          ) : null}
          {plan ? <Chip variant="plan">{plan}</Chip> : null}
          {email ? (
            <UserMenu initials={initials ?? "?"} email={email} />
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
