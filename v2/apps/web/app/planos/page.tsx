import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { PlanosPlans } from "@/components/planos-plans";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const user = await getCurrentUser();
  const urls = {
    proMonthly: process.env.HUBLA_CHECKOUT_URL_PRO_MONTHLY,
    proAnnual: process.env.HUBLA_CHECKOUT_URL_PRO_ANNUAL,
    proPlusMonthly: process.env.HUBLA_CHECKOUT_URL_PRO_PLUS_MONTHLY,
    proPlusAnnual: process.env.HUBLA_CHECKOUT_URL_PRO_PLUS_ANNUAL,
  };
  const plan = user?.plan ?? "free";
  return (
    <div className="planos-page">
      <AppBar
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />

      <div className="wrap">
        <div className="head">
          <span className="label">Planos e assinatura</span>
          <h2>Escolha quanto rigor você quer.</h2>
          <p>Sem fidelidade. Cancele quando quiser. Faça upgrade quando o motor já tiver provado o valor.</p>
          <div className="cur">
            Plano atual: <b>{planLabel(plan)}</b>
            {user ? <> · {user.credits} {user.credits === 1 ? "crédito" : "créditos"} restantes</> : null}
          </div>
        </div>

        <PlanosPlans urls={urls} currentPlan={plan} />

        <div className="assurance">
          <span><span className="c">✓</span> Cancele a qualquer momento</span>
          <span><span className="c">✓</span> Pagamento seguro</span>
          <span><span className="c">✓</span> Algoritmos auditáveis</span>
          <span><span className="c">✓</span> Sem recomendação personalizada · conteúdo informativo</span>
        </div>
      </div>
    </div>
  );
}
