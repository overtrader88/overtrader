import { AppBar } from "@/components/ui";
import { getCurrentUser, planLabel, initialsOf } from "@/lib/supabase/auth";
import { checkSimulatorGate } from "@/lib/simulator/gate";
import { SimuladorClient } from "./simulador-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulador — Máquina do Tempo" };

/**
 * /simulador — Máquina do Tempo (logada; protegida no middleware).
 * A página (RSC) só resolve usuário + cota do dia; a viagem em si acontece no
 * client component contra POST /api/simulator. Reusa a casca visual da análise
 * (.analysis-page) + estilos próprios .sim-*.
 */
export default async function SimuladorPage() {
  const user = await getCurrentUser();
  const gate = user ? await checkSimulatorGate(user.id) : null;
  return (
    <>
      <AppBar
        active="simulador"
        credits={user?.credits}
        plan={user ? planLabel(user.plan) : undefined}
        initials={user ? initialsOf(user) : undefined}
        email={user?.email}
      />
      <div className="analysis-page sim-page">
        <div className="wrap">
          <header className="sim-head">
            <span className="sim-eyebrow">máquina do tempo</span>
            <h1 className="sim-title">Simulador <span className="grad">histórico</span></h1>
            <p className="sim-sub">
              Volte a qualquer dia do passado, veja o que a IA teria dito naquele dia — e então avance o tempo
              para descobrir o que o mercado fez em seguida. Prova, não promessa.
            </p>
          </header>
          <SimuladorClient initialUsedToday={gate?.usedToday ?? 0} initialCredits={user?.credits ?? 0} />
        </div>
      </div>
    </>
  );
}
