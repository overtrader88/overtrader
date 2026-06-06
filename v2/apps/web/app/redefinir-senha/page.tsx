import { Logo, ConfidenceBadge } from "@/components/ui";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic = "force-dynamic";

export default function RedefinirSenhaPage() {
  return (
    <div className="auth-page">
      <div className="auth">
        <div className="left">
          <div className="brand">
            <Logo size={28} />
            <span className="name">Overtrader</span><span className="ia">IA</span>
          </div>
          <h2>Quase lá.</h2>
          <p>Defina uma nova senha e você já entra direto no painel.</p>
          <div className="proof">
            <div className="bar">
              BTCUSDT · 4H
              <span className="seal"><span className="led" />VALIDADO</span>
            </div>
            <ConfidenceBadge label="Profit factor · backtest" value={1.89} ci={[1.42, 2.51]} n={142} method="bootstrap" min={0} max={3.5} />
          </div>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
