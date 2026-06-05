import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth/admin";
import { AdminCreditsClient } from "@/components/admin/credits-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Créditos",
};

export default async function AdminCreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdmin(user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Créditos (Admin)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Creditar manualmente, ativar planos e visualizar saldos. Apenas para
          administradores configurados em <code>ADMIN_EMAILS</code>.
        </p>
      </div>
      <AdminCreditsClient adminEmail={user.email ?? ""} />
    </div>
  );
}
