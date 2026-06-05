import { Logo, ConfidenceBadge } from "@/components/ui";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth">
        {/* ESQUERDA — prova de valor */}
        <div className="left">
          <div className="brand">
            <Logo size={28} />
            <span className="name">Overtrader</span><span className="ia">IA</span>
          </div>
          <h2>Bom te ver<br />de novo.</h2>
          <p>O motor continua medindo: amostra, intervalo de confiança e período em cada número.</p>
          <div className="proof">
            <div className="bar">
              BTCUSDT · 4H
              <span className="seal"><span className="led" />VALIDADO</span>
            </div>
            <ConfidenceBadge
              label="Profit factor · backtest"
              value={1.89}
              ci={[1.42, 2.51]}
              n={142}
              method="bootstrap"
              min={0}
              max={3.5}
            />
          </div>
        </div>

        {/* DIREITA — formulário (client) */}
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}
