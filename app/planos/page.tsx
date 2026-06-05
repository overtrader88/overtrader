import { createClient } from "@/lib/supabase/server";
import { PlanosClient } from "@/components/planos/planos-client";
import type { PlanTier } from "@/lib/plans/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planos · Trading IA",
  description:
    "Free vitalício, PRO R$ 59/mês e PRO+ R$ 99/mês. Anuais com desconto. IA generativa, backtest validado e multi-mercado.",
};

export default async function PlanosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Plano atual do usuario (se logado)
  let currentPlan: PlanTier = "free";
  if (user) {
    const { data } = await supabase.rpc("get_active_plan", {
      p_user_id: user.id,
    });
    if (data === "pro" || data === "pro_plus") {
      currentPlan = data;
    }
  }

  return (
    <PlanosClient currentPlan={currentPlan} isLogged={!!user} />
  );
}
