import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AlertsClient } from "@/components/alerts/alerts-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alertas · Trading IA",
};

interface SearchParams {
  tab?: string;
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Carrega ambos em paralelo
  const [{ data: alertsData }, { data: watchlistData }] = await Promise.all([
    supabase
      .from("alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AlertsClient
      initialAlerts={alertsData ?? []}
      initialWatchlist={watchlistData ?? []}
      initialTab={tab === "watchlist" ? "watchlist" : "alerts"}
    />
  );
}
